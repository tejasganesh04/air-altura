const CrudRepository = require('./crud-repository.js');
const { Flight, Airplane, Airport, City, FlightClass, FlightStop } = require('../models/index.js');
const db = require('../models')
const AppError = require('../utils/errors/app-error');
const { StatusCodes } = require('http-status-codes');
const { addRowLockOnFlightClass } = require('./queries');

class FlightRepository extends CrudRepository {
    constructor(){
        super(Flight);
    }

    /**
     * Fetches all flights matching the given filter and sort criteria.
     * Eagerly loads Airplane, departure/arrival Airports (with Cities), all FlightClasses,
     * and FlightStops so the response is self-contained.
     *
     * When classFilter is non-empty an INNER JOIN is applied on FlightClasses, meaning only
     * flights that have at least one class satisfying the filter (price range, seat count) are
     * returned.  When classFilter is empty all FlightClass rows are included (LEFT JOIN).
     *
     * @param {Object} flightFilter - Sequelize WHERE conditions on the Flights table (trips, tripDate).
     * @param {Object} classFilter  - Sequelize WHERE conditions on the FlightClasses table (price, travellers).
     * @param {Array}  sort         - Sequelize ORDER clause (e.g. [['price','ASC'],['departureTime','DESC']]).
     * @returns {Promise<Flight[]>} Array of Flight instances with nested associations.
     */
    async getAllFlights(flightFilter, classFilter, sort){
        const hasClassFilter = Object.keys(classFilter).length > 0;

        // 'price' now lives on FlightClasses, not Flights — a plain
        // ['price', 'ASC'] order entry defaults to the root Flight model's
        // own column, which no longer exists. Qualify it with the
        // association so Sequelize orders by the joined table's column
        // instead. Other sort fields (e.g. departureTime) are still real
        // Flights columns and pass through unchanged.
        const qualifiedSort = sort.map(([field, direction]) =>
            field === 'price'
                ? [{ model: FlightClass, as: 'FlightClasses' }, field, direction]
                : [field, direction]
        );

        const response = await Flight.findAll({
            where: flightFilter,
            order: qualifiedSort,
            // Safety cap — independent of whatever filters were (or weren't)
            // supplied. Without this, a request with no trips/tripDate filter
            // tries to hydrate every matching row (162k+ Flights, each with
            // 5 eager-loaded associations) in memory at once, which is what
            // crashed the service with a JS heap OOM. A normal, real search
            // through the site's own SearchWidget never comes close to this
            // limit (trips+tripDate together return ~10 rows) — this only
            // ever engages for an unfiltered or very broad request.
            limit: 100,
            include: [
                {
                    model: Airplane,
                    required: true,
                    as: 'airplaneDetails'
                },
                {
                    model: Airport,
                    required: true,
                    as: 'departureAirport',
                    include: { model: City, required: true }
                },
                {
                    model: Airport,
                    required: true,
                    as: 'arrivalAirport',
                    include: { model: City, required: true }
                },
                {
                    model: FlightClass,
                    as: 'FlightClasses',
                    required: true,   // always INNER JOIN — flights without any class rows are excluded
                    ...(hasClassFilter && { where: classFilter })
                },
                {
                    model: FlightStop,
                    as: 'FlightStops',
                    required: false
                }
            ]
        });
        return response;
    }

    /**
     * Fetches a single flight by primary key with all associations eager-loaded.
     * Used by the Booking Service (via GET /flights/:id) to retrieve cabin-class pricing
     * and seat availability before creating a booking.
     *
     * Overrides the base CrudRepository.get() which returns a bare Flight instance with
     * no includes — insufficient for the booking flow.
     *
     * @param {number} id - Primary key of the flight to fetch.
     * @returns {Promise<Flight>} Flight instance with Airplane, Airports, Cities, FlightClasses, FlightStops.
     * @throws {AppError} NOT_FOUND if no flight exists with this id.
     */
    async getFlight(id){
        const response = await Flight.findByPk(id, {
            include: [
                {
                    model: Airplane,
                    required: true,
                    as: 'airplaneDetails'
                },
                {
                    model: Airport,
                    required: true,
                    as: 'departureAirport',
                    include: { model: City, required: true }
                },
                {
                    model: Airport,
                    required: true,
                    as: 'arrivalAirport',
                    include: { model: City, required: true }
                },
                {
                    model: FlightClass,
                    as: 'FlightClasses',
                    required: false
                },
                {
                    model: FlightStop,
                    as: 'FlightStops',
                    required: false
                }
            ]
        });
        if(!response){
            throw new AppError('Not able to find a resource', StatusCodes.NOT_FOUND);
        }
        return response;
    }

    /**
     * Creates a flight together with its cabin-class inventory rows in a single transaction.
     * seatClasses is required — price and seat count live entirely on FlightClasses now.
     *
     * @param {Object}   data             - All flight fields plus a seatClasses array.
     * @param {Array}    data.seatClasses - [{ seatClass, price, totalSeats }, ...] — one entry per cabin.
     * @returns {Promise<Flight>} The newly created Flight instance.
     */
    async createFlightWithClasses(data){
        const transaction = await db.sequelize.transaction();
        try {
            const { seatClasses, ...flightData } = data;

            const flight = await Flight.create(flightData, { transaction });

            const classRows = seatClasses.map(c => ({
                flightId:   flight.id,
                seatClass:  c.seatClass,
                price:      c.price,
                totalSeats: c.totalSeats
            }));
            await FlightClass.bulkCreate(classRows, { transaction });

            await transaction.commit();
            return flight;
        } catch(error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Atomically increments or decrements the totalSeats count for a specific cabin class.
     * Uses a SELECT ... FOR UPDATE row lock, scoped to FlightClasses, since seat inventory
     * lives at the cabin-class level.
     *
     * @param {number}  flightId  - FK of the flight whose class is being updated.
     * @param {string}  seatClass - Cabin class: 'economy' | 'premium-economy' | 'business' | 'first-class'.
     * @param {number}  seats     - Number of seats to add or subtract.
     * @param {boolean} dec       - true → decrement (booking), false → increment (cancellation). Defaults to true.
     * @returns {Promise<FlightClass>} The updated FlightClass instance reflecting the new seat count.
     */
    async updateRemainingClassSeats(flightId, seatClass, seats, dec = true){
        const transaction = await db.sequelize.transaction();
        try {
            await db.sequelize.query(addRowLockOnFlightClass(flightId, seatClass), { transaction });

            const flightClass = await FlightClass.findOne({
                where: { flightId, seatClass },
                transaction
            });

            if(!flightClass){
                throw new AppError(
                    `No ${seatClass} class found for flight ${flightId}`,
                    StatusCodes.NOT_FOUND
                );
            }

            // Bounds check — only on decrement (booking), never on increment
            // (restoration should never be blocked). This read happened AFTER
            // the row lock above was acquired, so flightClass.totalSeats here
            // is guaranteed fresh and uncontested — the lock alone only
            // serializes access to this row; it doesn't stop an over-large
            // decrement from being applied. This check is what actually
            // prevents overselling the last seat under concurrent requests.
            if(+dec && flightClass.totalSeats < seats){
                throw new AppError(
                    `Not enough seats available in ${seatClass}`,
                    StatusCodes.BAD_REQUEST
                );
            }

            if(+dec){
                await flightClass.decrement('totalSeats', { by: seats, transaction });
            } else {
                await flightClass.increment('totalSeats', { by: seats, transaction });
            }

            await transaction.commit();
            await flightClass.reload();
            return flightClass;
        } catch(error) {
            await transaction.rollback();
            throw error;
        }
    }
}

module.exports = FlightRepository;

// All raw SQL queries are centralised here to avoid raw strings scattered across repositories.
// When a query needs to change, there is exactly one place to update it.

/**
 * Generates a SELECT ... FOR UPDATE SQL statement targeting a single FlightClass row.
 *
 * Scoped to a specific cabin class, since seat counts live on FlightClasses rather than Flights.
 * Prevents double-booking when concurrent requests try to book the same class on the same flight.
 *
 * Must be executed within an active Sequelize transaction — pass {transaction} to the query call.
 *
 * @param {number} flightId   - Foreign key linking the FlightClass row to its Flight.
 * @param {string} seatClass  - Cabin class value: 'economy' | 'premium-economy' | 'business' | 'first-class'.
 * @returns {string} Raw SQL string ready to be passed to db.sequelize.query().
 */
function addRowLockOnFlightClass(flightId, seatClass){
    return `SELECT * FROM FlightClasses WHERE FlightClasses.flightId = ${flightId} AND FlightClasses.seatClass = '${seatClass}' FOR UPDATE;`
}

module.exports = {
    addRowLockOnFlightClass
}

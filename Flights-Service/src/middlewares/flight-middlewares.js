const {StatusCodes} = require('http-status-codes');
const {ErrorResponse} = require('../utils/common');
const AppError = require('../utils/errors/app-error');
/**
 * Middleware: validateCreateRequest (Flights)
 * Guards the POST /flights route by checking that all required fields are present in req.body.
 *
 * Required: flightNumber, airplaneId, departureAirportId, arrivalAirportId, arrivalTime,
 *           departureTime, and a non-empty seatClasses array (price/seat count live per
 *           cabin on FlightClasses — there is no flat price/totalSeats path anymore).
 * Responds 400 BAD_REQUEST immediately with a descriptive message if any field is missing.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateCreateRequest(req, res, next){
    if(!req.body.flightNumber){
        ErrorResponse.message = 'Something went wrong while creating flight';
        ErrorResponse.error = new AppError('Flight number not found in the oncoming request', StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    if(!req.body.airplaneId){
        ErrorResponse.message = 'Something went wrong while creating flight';
        ErrorResponse.error = new AppError('Airplane ID not found in the oncoming request', StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    if(!req.body.departureAirportId){
        ErrorResponse.message = 'Something went wrong while creating flight';
        ErrorResponse.error = new AppError('Departure airport ID not found in the oncoming request', StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    if(!req.body.arrivalAirportId){
        ErrorResponse.message = 'Something went wrong while creating flight';
        ErrorResponse.error = new AppError('Arrival airport ID not found in the oncoming request', StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    if(!req.body.arrivalTime){
        ErrorResponse.message = 'Something went wrong while creating flight';
        ErrorResponse.error = new AppError('Arrival time not found in the oncoming request', StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    if(!req.body.departureTime){
        ErrorResponse.message = 'Something went wrong while creating flight';
        ErrorResponse.error = new AppError('Departure time not found in the oncoming request', StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    // seatClasses is required — price and seat count live entirely on FlightClasses now,
    // the legacy v1 (flat price/totalSeats) creation path has been removed.
    const hasSeatClasses = Array.isArray(req.body.seatClasses) && req.body.seatClasses.length > 0;
    if(!hasSeatClasses){
        ErrorResponse.message = 'Something went wrong while creating flight';
        ErrorResponse.error = new AppError('seatClasses array is required', StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    next();
}


/**
 * Middleware: validateUpdateSeatsRequest (Flights)
 * Guards the PATCH /flights/:id/seats route by ensuring `seats` and `seatClass` are
 * both present in req.body. seatClass used to be optional (a missing value fell back
 * to a flight-level seat update) — that legacy path was removed since it targeted a
 * column (Flights.totalSeats) that no longer exists, so seatClass is now required here
 * too. This is a fast-fail nicety for the HTTP route specifically — the real enforcement
 * lives in flight-service.js's updateSeats(), since the seat-restoration RabbitMQ
 * subscriber calls that function directly and never passes through this middleware.
 * Responds 400 BAD_REQUEST if either field is missing; calls next() otherwise.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateUpdateSeatsRequest(req,res,next){

    if(!req.body.seats){
        ErrorResponse.message = 'Something went wrong while updating flight';
        ErrorResponse.error = new AppError('seats not found in the oncoming request',StatusCodes.BAD_REQUEST)
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    if(!req.body.seatClass){
        ErrorResponse.message = 'Something went wrong while updating flight';
        ErrorResponse.error = new AppError('seatClass not found in the oncoming request',StatusCodes.BAD_REQUEST)
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }

    next();
}



/**
 * Middleware: validateSearchRequest (Flights)
 * Guards GET /flights by requiring `trips` and `tripDate` in req.query — mirrors
 * the frontend SearchWidget's own requirement, now enforced server-side too so
 * a direct API call can't skip it.
 * Responds 400 BAD_REQUEST if either is missing; calls next() otherwise.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateSearchRequest(req, res, next){
    if(!req.query.trips){
        ErrorResponse.message = 'Something went wrong while searching flights';
        ErrorResponse.error = new AppError('trips not found in the oncoming request', StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    if(!req.query.tripDate){
        ErrorResponse.message = 'Something went wrong while searching flights';
        ErrorResponse.error = new AppError('tripDate not found in the oncoming request', StatusCodes.BAD_REQUEST);
        return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    next();
}


module.exports = {validateCreateRequest,validateUpdateSeatsRequest,validateSearchRequest};
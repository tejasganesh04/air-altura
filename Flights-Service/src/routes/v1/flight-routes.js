/**
 * Flight Routes — mounted at /api/v1/flights
 *
 * POST   /              → create a new flight (requires all flight fields in body)
 * GET    /              → fetch all flights (requires trips + tripDate; also supports price, travellers, sort)
 * GET    /:id           → fetch a single flight by primary key (used by Booking Service)
 * PATCH  /:id/seats     → atomically update remaining seat count (used by Booking Service on payment/cancellation)
 */
const express = require('express');
const router = express.Router();
const {FlightMiddlewares} = require('../../middlewares');
const {FlightController} = require('../../controllers');

// Validate required fields before allowing flight creation
router.post('/', FlightMiddlewares.validateCreateRequest, FlightController.createFlight);

// Require trips + tripDate — mirrors the frontend's own search requirement,
// now enforced server-side too so a direct API call can't skip it
router.get('/', FlightMiddlewares.validateSearchRequest, FlightController.getAllFlights);

// Fetch a specific flight by id — consumed by the Booking Service
router.get('/:id', FlightController.getFlight);

// Validate that `seats` is present in body before updating seat count
router.patch('/:id/seats', FlightMiddlewares.validateUpdateSeatsRequest, FlightController.updateSeats);

module.exports = router;



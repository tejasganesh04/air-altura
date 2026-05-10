const { Router } = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticate } = require('../../middlewares/auth-middleware');
const { rateLimiter } = require('../../middlewares/rate-limiter');
const authRouter = require('./auth-router');
const { FLIGHTS_SERVICE, BOOKING_SERVICE } = require('../../config/server-config');

const router = Router();

// Auth routes — no JWT required
router.use('/auth', authRouter);

// When Express matches router.use('/flights', ...), it strips '/flights' from req.url.
// http-proxy-middleware uses req.url, so it would forward to the wrong path (e.g. '/' instead of '/api/v1/flights').
// Fix: restore the full original path via req.originalUrl in the proxyReq event.
const restorePath = {
    on: {
        proxyReq: (proxyReq, req) => {
            proxyReq.path = req.originalUrl;
        }
    }
};

// Flights Service routes — public, rate limited
// Proxies: /api/v1/flights/*, /api/v1/airplanes/*, /api/v1/airports/*, /api/v1/cities/*
const flightsProxy = createProxyMiddleware({
    target: FLIGHTS_SERVICE,
    changeOrigin: true,
    ...restorePath,
});

router.use('/flights', rateLimiter, flightsProxy);
router.use('/airplanes', rateLimiter, flightsProxy);
router.use('/airports', rateLimiter, flightsProxy);
router.use('/cities', rateLimiter, flightsProxy);

// Booking Service routes — protected, rate limited
router.use('/booking', rateLimiter, authenticate, createProxyMiddleware({
    target: BOOKING_SERVICE,
    changeOrigin: true,
    ...restorePath,
}));

module.exports = router;

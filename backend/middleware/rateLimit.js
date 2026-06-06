// backend/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limiter for link creation
const createLinkLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Limit each IP to 20 link creations per hour
    message: { error: 'Too many links created. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Premium users get higher limits (applied after auth)
function premiumRateLimit(req, res, next) {
    if (req.user && req.user.is_premium) {
        // Premium users skip rate limit
        return next();
    }
    return createLinkLimiter(req, res, next);
}

module.exports = { apiLimiter, createLinkLimiter, premiumRateLimit };
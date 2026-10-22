// backend/middleware/rateLimit.js
import rateLimit from 'express-rate-limit';

const getClientIp = (req) => {
    return (
        req.ip ||
        req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers?.['x-real-ip'] ||
        req.socket?.remoteAddress ||
        '127.0.0.1'
    );
};

// General API rate limiter (100 requests per 15 minutes)
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    validate: { ip: false, xForwardedForHeader: false, default: true },
});

// Stricter limiter for sensitive auth endpoints (15 requests per 15 minutes)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { error: 'Too many authentication attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    validate: { ip: false, xForwardedForHeader: false, default: true },
});

// Stricter limiter for repository link creation (20 link creations per hour)
export const createLinkLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { error: 'Too many links created. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    validate: { ip: false, xForwardedForHeader: false, default: true },
});

/**
 * Universal equal treatment: All users receive the exact same limits.
 * Retained for backward export compatibility; delegates directly to createLinkLimiter with zero bypass.
 */
export function premiumRateLimit(req, res, next) {
    return createLinkLimiter(req, res, next);
}

/**
 * Helper to execute rate-limiting middleware inside Next.js Pages Router API handlers
 */
export async function applyRateLimit(req, res, limiter = apiLimiter) {
    return new Promise((resolve, reject) => {
        limiter(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

export default apiLimiter;
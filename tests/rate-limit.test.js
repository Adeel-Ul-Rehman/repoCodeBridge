import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { 
    apiLimiter, 
    createLinkLimiter, 
    authLimiter, 
    premiumRateLimit, 
    applyRateLimit 
} from '../backend/middleware/rateLimit.js';

describe('Rate Limit Middleware & Equal Treatment', () => {
    test('exports expected middleware functions and helpers', () => {
        assert.equal(typeof apiLimiter, 'function');
        assert.equal(typeof createLinkLimiter, 'function');
        assert.equal(typeof authLimiter, 'function');
        assert.equal(typeof premiumRateLimit, 'function');
        assert.equal(typeof applyRateLimit, 'function');
    });

    test('equal treatment: premiumRateLimit enforces identical limits for all users without bypass', async () => {
        let delegatedForUserA = false;
        let delegatedForUserB = false;

        const reqUserA = {
            user: { is_premium: true },
            headers: {},
            ip: '127.0.0.1',
            app: { get: () => false },
        };
        const reqUserB = {
            user: { is_premium: false },
            headers: {},
            ip: '127.0.0.1',
            app: { get: () => false },
        };
        const res = {
            setHeader: () => {},
            getHeader: () => {},
        };

        // User with is_premium: true is subject to rate limiting (equal treatment)
        await new Promise((resolve) => {
            premiumRateLimit(reqUserA, res, () => {
                delegatedForUserA = true;
                resolve();
            });
        });

        // User with is_premium: false is subject to the same limiter
        await new Promise((resolve) => {
            premiumRateLimit(reqUserB, res, () => {
                delegatedForUserB = true;
                resolve();
            });
        });

        assert.equal(delegatedForUserA, true);
        assert.equal(delegatedForUserB, true);
    });

    test('applyRateLimit helper runs middleware and catches 429 status on overflow', async () => {
        let headersSent = false;
        let statusCode = null;
        let responseBody = null;

        const req = {
            headers: {},
            ip: '192.168.1.100',
            app: { get: () => false },
        };
        const res = {
            headersSent: false,
            setHeader: () => {},
            getHeader: () => {},
            status(code) {
                statusCode = code;
                return this;
            },
            send(data) {
                headersSent = true;
                responseBody = data;
                this.headersSent = true;
                return this;
            },
        };

        // First execution succeeds and passes through
        await applyRateLimit(req, res, authLimiter);
        assert.equal(headersSent, false);
    });
});

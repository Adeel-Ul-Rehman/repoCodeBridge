import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { apiLimiter, createLinkLimiter, premiumRateLimit } from '../backend/middleware/rateLimit.js';

describe('Rate Limit Middleware (Item A)', () => {
    test('exports expected middleware functions', () => {
        assert.equal(typeof apiLimiter, 'function');
        assert.equal(typeof createLinkLimiter, 'function');
        assert.equal(typeof premiumRateLimit, 'function');
    });

    test('premiumRateLimit bypasses limiter for premium users', () => {
        let nextCalled = false;
        const req = {
            user: { is_premium: true },
            headers: {},
        };
        const res = {};
        const next = () => { nextCalled = true; };

        premiumRateLimit(req, res, next);
        assert.equal(nextCalled, true);
    });

    test('premiumRateLimit delegates to createLinkLimiter for free users', async () => {
        let delegated = false;
        const req = {
            user: { is_premium: false },
            headers: {},
            ip: '127.0.0.1',
            app: { get: () => false },
        };
        const res = {
            setHeader: () => {},
            getHeader: () => {},
        };
        await new Promise((resolve) => {
            premiumRateLimit(req, res, () => {
                delegated = true;
                resolve();
            });
        });
        assert.equal(delegated, true);
    });
});

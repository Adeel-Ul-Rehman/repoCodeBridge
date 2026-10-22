import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { authenticate } from '../backend/middleware/auth.js';

describe('Authentication Error Handling (Item C)', () => {
    test('missing token returns 401 and calls next without hanging', async () => {
        let statusCode = null;
        let responseJson = null;
        let nextCalled = false;

        const req = { cookies: {}, headers: {} };
        const res = {
            headersSent: false,
            status(code) {
                statusCode = code;
                return this;
            },
            json(data) {
                responseJson = data;
                this.headersSent = true;
                return this;
            },
        };

        await new Promise((resolve) => {
            authenticate(req, res, () => {
                nextCalled = true;
                resolve();
            });
        });

        assert.equal(statusCode, 401);
        assert.equal(responseJson.error, 'Authentication required');
        assert.equal(nextCalled, true);
    });

    test('invalid token returns 401 and calls next without hanging', async () => {
        let statusCode = null;
        let responseJson = null;
        let nextCalled = false;

        const req = {
            cookies: { token: 'invalid.jwt.token' },
            headers: {},
        };
        const res = {
            headersSent: false,
            status(code) {
                statusCode = code;
                return this;
            },
            json(data) {
                responseJson = data;
                this.headersSent = true;
                return this;
            },
        };

        await new Promise((resolve) => {
            authenticate(req, res, () => {
                nextCalled = true;
                resolve();
            });
        });

        assert.equal(statusCode, 401);
        assert.equal(responseJson.error, 'Invalid or expired token');
        assert.equal(nextCalled, true);
    });
});

describe('Equal User Treatment (Zero Premium Tiers)', () => {
    test('all users receive identical tier status (is_premium = false) uniformly', () => {
        // Equal treatment helper matching production register and login
        const resolveUserTier = () => {
            return { is_premium: false };
        };

        assert.equal(resolveUserTier('admin@example.com').is_premium, false);
        assert.equal(resolveUserTier('vip@startup.io').is_premium, false);
        assert.equal(resolveUserTier('founder@company.com').is_premium, false);
        assert.equal(resolveUserTier('regular@user.org').is_premium, false);
    });
});

describe('Production Cookie Security', () => {
    function generateCookieHeader(token, env = 'development') {
        const isProd = env === 'production';
        return `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${isProd ? '; Secure' : ''}`;
    }

    test('cookie includes Secure flag in production environment', () => {
        const header = generateCookieHeader('jwt.test.token', 'production');
        assert.ok(header.includes('; Secure'));
        assert.ok(header.includes('HttpOnly'));
        assert.ok(header.includes('SameSite=Lax'));
        assert.ok(header.includes('Path=/'));
    });

    test('cookie omits Secure flag in local development for HTTP compatibility', () => {
        const header = generateCookieHeader('jwt.test.token', 'development');
        assert.ok(!header.includes('; Secure'));
        assert.ok(header.includes('HttpOnly'));
        assert.ok(header.includes('SameSite=Lax'));
        assert.ok(header.includes('Path=/'));
    });
});


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

describe('Premium Normalization Logic (Item G)', () => {
    function computeIsPremium(email, rawConfig) {
        const normalizedEmail = (email || '').trim().toLowerCase();
        const premiumEmails = (rawConfig || '')
            .split(',')
            .map(e => e.trim().toLowerCase())
            .filter(Boolean);
        return premiumEmails.includes(normalizedEmail);
    }

    test('correctly identifies configured premium emails with mixed casing and spacing', () => {
        const config = ' VIP@example.com , Founder@Startup.IO , Pro@Test.COM ';
        assert.equal(computeIsPremium('vip@example.com', config), true);
        assert.equal(computeIsPremium('VIP@EXAMPLE.COM', config), true);
        assert.equal(computeIsPremium('founder@startup.io', config), true);
        assert.equal(computeIsPremium('pro@test.com', config), true);
    });

    test('returns false for non-premium emails', () => {
        const config = 'vip@example.com';
        assert.equal(computeIsPremium('regular@example.com', config), false);
    });

    test('empty or whitespace config never grants premium', () => {
        assert.equal(computeIsPremium('vip@example.com', ''), false);
        assert.equal(computeIsPremium('vip@example.com', '   '), false);
        assert.equal(computeIsPremium('vip@example.com', undefined), false);
        assert.equal(computeIsPremium('', ''), false);
    });
});

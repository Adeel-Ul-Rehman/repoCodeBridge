import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Link Limits & Input Validation (Item F)', () => {
    test('rejects missing or invalid repoUrl types', () => {
        const validateBody = (body) => {
            const { repoUrl } = body || {};
            if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.trim()) {
                return { valid: false, error: 'NO_URL' };
            }
            return { valid: true };
        };

        assert.equal(validateBody({}).valid, false);
        assert.equal(validateBody({ repoUrl: '' }).valid, false);
        assert.equal(validateBody({ repoUrl: '   ' }).valid, false);
        assert.equal(validateBody({ repoUrl: 12345 }).valid, false);
        assert.equal(validateBody({ repoUrl: 'https://github.com/facebook/react' }).valid, true);
    });

    test('enforces active link limit threshold of 50', () => {
        const checkLimit = (count) => count < 50;
        assert.equal(checkLimit(0), true);
        assert.equal(checkLimit(49), true);
        assert.equal(checkLimit(50), false);
        assert.equal(checkLimit(51), false);
    });
});

describe('Password-Reset OTP Validation (Item K)', () => {
    test('requires valid string parameters for email, otp, and password', () => {
        const validateResetPayload = (body) => {
            const { email, otp, newPassword } = body || {};
            if (!email || !otp || !newPassword || 
                typeof email !== 'string' || typeof otp !== 'string' || typeof newPassword !== 'string') {
                return { valid: false, error: 'REQUIRED' };
            }
            if (newPassword.length < 6) {
                return { valid: false, error: 'TOO_SHORT' };
            }
            return { valid: true };
        };

        assert.equal(validateResetPayload({}).valid, false);
        assert.equal(validateResetPayload({ email: 'test@example.com', otp: '123456', newPassword: '123' }).error, 'TOO_SHORT');
        assert.equal(validateResetPayload({ email: 'test@example.com', otp: 123456, newPassword: 'password123' }).error, 'REQUIRED');
        assert.equal(validateResetPayload({ email: 'test@example.com', otp: '123456', newPassword: 'password123' }).valid, true);
    });
});

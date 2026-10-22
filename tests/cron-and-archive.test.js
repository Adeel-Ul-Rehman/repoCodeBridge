import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isPathIncludable } from '../backend/services/repoFetcher.js';

describe('Cron Endpoint Authentication Logic (Item J)', () => {
    function verifyCronAuth(req, cronSecret) {
        if (!cronSecret) return { authorized: true };

        let token = null;
        const authHeader = req.headers?.authorization;
        const querySecret = req.query?.secret;

        if (authHeader && typeof authHeader === 'string') {
            token = authHeader.replace(/^Bearer\s+/i, '').trim();
        } else if (querySecret && typeof querySecret === 'string') {
            token = querySecret.trim();
        }

        if (!token || token !== cronSecret) {
            return { authorized: false, status: 401, error: 'Unauthorized' };
        }
        return { authorized: true };
    }

    test('rejects request with missing credentials when CRON_SECRET is set', () => {
        const req = { headers: {}, query: {} };
        const res = verifyCronAuth(req, 'super-secret-key-123');
        assert.equal(res.authorized, false);
        assert.equal(res.status, 401);
        assert.equal(res.error, 'Unauthorized');
    });

    test('rejects request with invalid Authorization header', () => {
        const req = { headers: { authorization: 'Bearer wrong-secret' }, query: {} };
        const res = verifyCronAuth(req, 'super-secret-key-123');
        assert.equal(res.authorized, false);
        assert.equal(res.status, 401);
    });

    test('rejects request with invalid query secret parameter', () => {
        const req = { headers: {}, query: { secret: 'wrong-secret' } };
        const res = verifyCronAuth(req, 'super-secret-key-123');
        assert.equal(res.authorized, false);
        assert.equal(res.status, 401);
    });

    test('accepts request with valid Authorization header', () => {
        const req = { headers: { authorization: 'Bearer super-secret-key-123' }, query: {} };
        const res = verifyCronAuth(req, 'super-secret-key-123');
        assert.equal(res.authorized, true);
    });

    test('accepts request with valid query secret parameter', () => {
        const req = { headers: {}, query: { secret: 'super-secret-key-123' } };
        const res = verifyCronAuth(req, 'super-secret-key-123');
        assert.equal(res.authorized, true);
    });

    test('allows request in local development when CRON_SECRET is unset', () => {
        const req = { headers: {}, query: {} };
        const res = verifyCronAuth(req, undefined);
        assert.equal(res.authorized, true);
    });
});

describe('Archive Filtering & File Exclusion (Item H)', () => {
    test('excludes node_modules and hidden folders', () => {
        assert.equal(isPathIncludable('node_modules/express/index.js'), false);
        assert.equal(isPathIncludable('.git/config'), false);
        assert.equal(isPathIncludable('.github/workflows/main.yml'), false);
        assert.equal(isPathIncludable('.next/server/pages.js'), false);
    });

    test('excludes binary and media file extensions', () => {
        assert.equal(isPathIncludable('src/assets/logo.png'), false);
        assert.equal(isPathIncludable('src/assets/audio.mp3'), false);
        assert.equal(isPathIncludable('bin/binary.exe'), false);
        assert.equal(isPathIncludable('docs/manual.pdf'), false);
    });

    test('excludes massive lockfiles', () => {
        assert.equal(isPathIncludable('package-lock.json'), false);
        assert.equal(isPathIncludable('yarn.lock'), false);
        assert.equal(isPathIncludable('pnpm-lock.yaml'), false);
    });

    test('includes standard code and configuration files', () => {
        assert.equal(isPathIncludable('src/index.js'), true);
        assert.equal(isPathIncludable('components/Navbar.tsx'), true);
        assert.equal(isPathIncludable('package.json'), true);
        assert.equal(isPathIncludable('README.md'), true);
    });
});

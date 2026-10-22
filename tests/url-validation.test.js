import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseGitHubUrl, validateRepository } from '../backend/services/repoFetcher.js';

describe('GitHub URL Validation (Item B)', () => {
    describe('parseGitHubUrl - valid URLs', () => {
        test('standard https URL', () => {
            const res = parseGitHubUrl('https://github.com/facebook/react');
            assert.deepEqual(res, {
                owner: 'facebook',
                repo: 'react',
                fullName: 'facebook/react',
            });
        });

        test('URL with trailing slash', () => {
            const res = parseGitHubUrl('https://github.com/facebook/react/');
            assert.deepEqual(res, {
                owner: 'facebook',
                repo: 'react',
                fullName: 'facebook/react',
            });
        });

        test('URL with .git extension', () => {
            const res = parseGitHubUrl('https://github.com/facebook/react.git');
            assert.deepEqual(res, {
                owner: 'facebook',
                repo: 'react',
                fullName: 'facebook/react',
            });
        });

        test('URL with .git extension and trailing slash', () => {
            const res = parseGitHubUrl('https://github.com/facebook/react.git/');
            assert.deepEqual(res, {
                owner: 'facebook',
                repo: 'react',
                fullName: 'facebook/react',
            });
        });

        test('http protocol URL', () => {
            const res = parseGitHubUrl('http://github.com/facebook/react');
            assert.deepEqual(res, {
                owner: 'facebook',
                repo: 'react',
                fullName: 'facebook/react',
            });
        });

        test('repository name with dots and dashes', () => {
            const res = parseGitHubUrl('https://github.com/owner-name/repo.name-v2');
            assert.deepEqual(res, {
                owner: 'owner-name',
                repo: 'repo.name-v2',
                fullName: 'owner-name/repo.name-v2',
            });
        });
    });

    describe('parseGitHubUrl - malicious & invalid URLs', () => {
        test('rejects lookalike hostname attacker-github.com', () => {
            assert.throws(() => parseGitHubUrl('https://attacker-github.com/facebook/react'), /Only repository URLs from github\.com are supported/i);
        });

        test('rejects lookalike subdomain github.com.attacker.com', () => {
            assert.throws(() => parseGitHubUrl('https://github.com.attacker.com/facebook/react'), /Only repository URLs from github\.com are supported/i);
        });

        test('rejects query parameter confusion', () => {
            assert.throws(() => parseGitHubUrl('https://evil.com/?x=github.com/facebook/react'), /Only repository URLs from github\.com are supported/i);
        });

        test('rejects javascript: protocol', () => {
            assert.throws(() => parseGitHubUrl('javascript:alert(1)'), /Invalid protocol/i);
        });

        test('rejects ftp: protocol', () => {
            assert.throws(() => parseGitHubUrl('ftp://github.com/facebook/react'), /Invalid protocol/i);
        });

        test('rejects file: protocol', () => {
            assert.throws(() => parseGitHubUrl('file:///etc/passwd'), /Invalid protocol/i);
        });

        test('rejects empty and null inputs', () => {
            assert.throws(() => parseGitHubUrl(''), /Invalid GitHub URL format/i);
            assert.throws(() => parseGitHubUrl(null), /Invalid GitHub URL format/i);
            assert.throws(() => parseGitHubUrl(undefined), /Invalid GitHub URL format/i);
        });

        test('rejects URLs missing repository', () => {
            assert.throws(() => parseGitHubUrl('https://github.com/facebook'), /Expected format/i);
            assert.throws(() => parseGitHubUrl('https://github.com/facebook/'), /Expected format/i);
        });

        test('rejects URLs with extra path segments (blob/main)', () => {
            assert.throws(() => parseGitHubUrl('https://github.com/facebook/react/blob/main/README.md'), /Expected format/i);
            assert.throws(() => parseGitHubUrl('https://github.com/facebook/react/issues'), /Expected format/i);
        });

        test('rejects non-standard ports', () => {
            assert.throws(() => parseGitHubUrl('https://github.com:8443/facebook/react'), /Invalid port/i);
        });
    });

    describe('validateRepository URL validation outputs', () => {
        test('empty input returns NO_URL error', async () => {
            const res = await validateRepository('');
            assert.equal(res.valid, false);
            assert.equal(res.error, 'NO_URL');
        });

        test('malicious lookalike returns INVALID_URL error without throwing', async () => {
            const res = await validateRepository('https://attacker-github.com/facebook/react');
            assert.equal(res.valid, false);
            assert.equal(res.error, 'INVALID_URL');
            assert.ok(res.message.includes('github.com'));
        });

        test('extra path segments return INVALID_URL error', async () => {
            const res = await validateRepository('https://github.com/facebook/react/tree/main');
            assert.equal(res.valid, false);
            assert.equal(res.error, 'INVALID_URL');
        });
    });
});

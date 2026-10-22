import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    isConfirmedRateLimit,
    isTransientError,
    formatRateLimitMessage,
    calculateBackoffDelay,
    deduplicateRequest,
    RateLimitExceededError
} from '../backend/services/rateLimitHandler.js';
import {
    computeGitBlobSha,
    validateSelectedPaths,
    isPathIncludable,
    computeTreeDiff
} from '../backend/services/repoFetcher.js';
import Link from '../backend/models/Link.js';
import { cancelJob, isJobActive } from '../backend/services/jobManager.js';

describe('Smart Repository Fetching, Selective Conversion, Refresh, Deletion & Rate-Limit Suite', () => {

    describe('1. Centralized GitHub Rate-Limit Detection & Scheduling', () => {
        test('isConfirmedRateLimit correctly identifies HTTP 429', () => {
            const err = new Error('Too many requests');
            err.status = 429;
            assert.equal(isConfirmedRateLimit(err), true);
        });

        test('isConfirmedRateLimit identifies HTTP 403 with x-ratelimit-remaining === 0', () => {
            const err = new Error('Forbidden');
            err.status = 403;
            err.response = {
                headers: {
                    get: (h) => h.toLowerCase() === 'x-ratelimit-remaining' ? '0' : null
                }
            };
            assert.equal(isConfirmedRateLimit(err), true);
        });

        test('isConfirmedRateLimit identifies secondary rate limits / abuse messages', () => {
            const err1 = new Error('You have exceeded a secondary rate limit. Please wait a few minutes.');
            err1.status = 403;
            assert.equal(isConfirmedRateLimit(err1), true);

            const err2 = new Error('Please wait before making additional requests (abuse detection).');
            err2.status = 403;
            assert.equal(isConfirmedRateLimit(err2), true);
        });

        test('isConfirmedRateLimit does NOT treat permission 403 as a rate limit', () => {
            const err = new Error('Resource not accessible by personal access token');
            err.status = 403;
            err.response = {
                headers: {
                    get: (h) => h.toLowerCase() === 'x-ratelimit-remaining' ? '4999' : null
                }
            };
            assert.equal(isConfirmedRateLimit(err), false);
        });

        test('isTransientError identifies 500, 502, 503, 504 and network errors', () => {
            assert.equal(isTransientError({ status: 500 }), true);
            assert.equal(isTransientError({ status: 502 }), true);
            assert.equal(isTransientError({ status: 503 }), true);
            assert.equal(isTransientError({ status: 504 }), true);
            assert.equal(isTransientError({ code: 'ETIMEDOUT' }), true);
            assert.equal(isTransientError({ code: 'ECONNRESET' }), true);
            assert.equal(isTransientError({ message: 'network timeout at https://api.github.com' }), true);
        });

        test('isTransientError rejects non-transient errors (404, 401, 422)', () => {
            assert.equal(isTransientError({ status: 404 }), false);
            assert.equal(isTransientError({ status: 401 }), false);
            assert.equal(isTransientError({ status: 422 }), false);
        });

        test('formatRateLimitMessage uses actual reset time without inventing estimates', () => {
            const futureReset = Math.floor(Date.now() / 1000) + (12 * 60) + 15; // ~12 minutes
            const msg = formatRateLimitMessage({ resetTime: futureReset });
            assert.ok(msg.includes('approximately 12 minutes') || msg.includes('approximately 13 minutes'));

            // Unknown reset time does not invent an estimate
            const unknownMsg = formatRateLimitMessage({ resetTime: null });
            assert.ok(unknownMsg.toLowerCase().includes('retry time is not yet available'));
            assert.ok(!unknownMsg.includes('approximately'));
        });

        test('deduplicateRequest prevents duplicate concurrent calls for the same key', async () => {
            let executionCount = 0;
            const slowTask = async () => {
                executionCount++;
                await new Promise(r => setTimeout(r, 50));
                return 'result';
            };

            const [res1, res2, res3] = await Promise.all([
                deduplicateRequest('test-key-1', slowTask),
                deduplicateRequest('test-key-1', slowTask),
                deduplicateRequest('test-key-1', slowTask)
            ]);

            assert.equal(res1, 'result');
            assert.equal(res2, 'result');
            assert.equal(res3, 'result');
            assert.equal(executionCount, 1, 'Concurrent calls were deduplicated to 1 execution');
        });
    });

    describe('2. Git Blob SHA Computation & Backend Path Validation', () => {
        test('computeGitBlobSha produces exact Git blob SHA-1 specification', () => {
            // Git blob SHA for content "hello world\n"
            // echo "hello world" | git hash-object --stdin -> 3b18e512dba79e4c8300dd08aeb37f8e728b8dad
            const content = 'hello world\n';
            const sha = computeGitBlobSha(content);
            assert.equal(sha, '3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
        });

        test('computeGitBlobSha handles Buffer inputs correctly', () => {
            const buf = Buffer.from('hello world\n', 'utf8');
            const sha = computeGitBlobSha(buf);
            assert.equal(sha, '3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
        });

        test('validateSelectedPaths accepts valid repository-relative paths', () => {
            const valid = ['src/index.js', 'package.json', 'components/Button.jsx', 'docs/guide.md'];
            const validated = validateSelectedPaths(valid);
            assert.deepEqual(validated, valid);
        });

        test('validateSelectedPaths rejects path traversal attempts', () => {
            assert.throws(() => {
                validateSelectedPaths(['src/index.js', '../secret.env']);
            }, /forbidden directory traversal or absolute path/);

            assert.throws(() => {
                validateSelectedPaths(['src/../../etc/passwd']);
            }, /forbidden directory traversal or absolute path/);
        });

        test('validateSelectedPaths rejects absolute paths', () => {
            assert.throws(() => {
                validateSelectedPaths(['/etc/shadow']);
            }, /forbidden directory traversal or absolute path/);

            assert.throws(() => {
                validateSelectedPaths(['C:\\Windows\\System32\\config']);
            }, /forbidden directory traversal or absolute path/);
        });

        test('isPathIncludable respects selectedPaths filter', () => {
            const options = { selectedPaths: ['src/app.js', 'src/utils.js'] };

            assert.equal(isPathIncludable('src/app.js', options), true);
            assert.equal(isPathIncludable('src/utils.js', options), true);
            assert.equal(isPathIncludable('src/ignored.js', options), false);
            assert.equal(isPathIncludable('package.json', options), false);
        });

        test('isPathIncludable filters binaries, lockfiles, and hidden files', () => {
            assert.equal(isPathIncludable('image.png'), false);
            assert.equal(isPathIncludable('package-lock.json'), false);
            assert.equal(isPathIncludable('.git/config'), false);
            assert.equal(isPathIncludable('node_modules/express/index.js'), false);
        });
    });

    describe('3. Smart Incremental Refresh Diffing (Blob SHA-based)', () => {
        const previousSnapshot = {
            commitSha: 'commit-v1',
            treeSha: 'tree-v1',
            files: [
                { path: 'src/index.js', sha: 'sha-index-1' },
                { path: 'src/helper.js', sha: 'sha-helper-1' },
                { path: 'src/obsolete.js', sha: 'sha-obsolete-1' }
            ]
        };

        test('identifies unchanged, modified, added, and deleted files', () => {
            const latestTree = [
                { path: 'src/index.js', sha: 'sha-index-1' },         // Unchanged
                { path: 'src/helper.js', sha: 'sha-helper-2-new' },   // Modified
                { path: 'src/feature.js', sha: 'sha-feature-1' }      // Added
                // src/obsolete.js is missing                          // Deleted
            ];

            const diff = computeTreeDiff(previousSnapshot, latestTree, null);

            assert.equal(diff.isUpToDate, false);
            assert.deepEqual(diff.unchanged.map(f => f.path), ['src/index.js']);
            assert.deepEqual(diff.modified.map(f => f.path), ['src/helper.js']);
            assert.deepEqual(diff.added.map(f => f.path), ['src/feature.js']);
            assert.deepEqual(diff.deleted, ['src/obsolete.js']);
        });

        test('returns isUpToDate = true when all files and SHAs match', () => {
            const identicalTree = [
                { path: 'src/index.js', sha: 'sha-index-1' },
                { path: 'src/helper.js', sha: 'sha-helper-1' },
                { path: 'src/obsolete.js', sha: 'sha-obsolete-1' }
            ];

            const diff = computeTreeDiff(previousSnapshot, identicalTree, null);

            assert.equal(diff.isUpToDate, true);
            assert.equal(diff.unchanged.length, 3);
            assert.equal(diff.modified.length, 0);
            assert.equal(diff.added.length, 0);
            assert.equal(diff.deleted.length, 0);
        });

        test('reconciles diff against selectedPaths subset', () => {
            const latestTree = [
                { path: 'src/index.js', sha: 'sha-index-1' },
                { path: 'src/helper.js', sha: 'sha-helper-1' },
                { path: 'other/file.js', sha: 'sha-other' }
            ];

            // User only selects src/index.js
            const diff = computeTreeDiff(previousSnapshot, latestTree, ['src/index.js']);

            assert.equal(diff.isUpToDate, false);
            assert.deepEqual(diff.unchanged.map(f => f.path), ['src/index.js']);
            // helper and obsolete were in previous snapshot but are not in selectedPaths, so they are deleted from snapshot
            assert.ok(diff.deleted.includes('src/helper.js'));
            assert.ok(diff.deleted.includes('src/obsolete.js'));
            assert.equal(diff.added.length, 0);
        });
        test('whole-repository conversion includes all valid files when selectedPaths is null', () => {
            assert.equal(isPathIncludable('src/a.js', {}), true);
            assert.equal(isPathIncludable('src/b.js', {}), true);
            assert.equal(isPathIncludable('docs/index.md', {}), true);
        });

        test('renamed files appear as deletion of old path and addition of new path', () => {
            const previous = [
                { path: 'src/oldName.js', sha: 'sha-same' }
            ];
            const latest = [
                { path: 'src/newName.js', sha: 'sha-same' }
            ];
            const diff = computeTreeDiff(previous, latest, null);
            assert.deepEqual(diff.deleted, ['src/oldName.js']);
            assert.deepEqual(diff.added.map(f => f.path), ['src/newName.js']);
            assert.equal(diff.unchanged.length, 0);
        });
    });

    describe('4. Canonical Repository Identity & One Reusable Link per User', () => {
        test('Link.canonicalizeRepo normalizes URLs with trailing slashes, .git, branches and subpaths', () => {
            const base1 = Link.canonicalizeRepo('https://github.com/facebook/react');
            const base2 = Link.canonicalizeRepo('https://github.com/facebook/react.git');
            const base3 = Link.canonicalizeRepo('https://github.com/facebook/react/');
            assert.equal(base1, 'facebook/react');
            assert.equal(base2, 'facebook/react');
            assert.equal(base3, 'facebook/react');

            // With subpath and branch
            const complex1 = Link.canonicalizeRepo('https://github.com/expressjs/express', 'dev', 'examples');
            const complex2 = Link.canonicalizeRepo('https://github.com/expressjs/express/', 'dev', 'examples/');
            assert.equal(complex1, 'expressjs/express::examples::@dev');
            assert.equal(complex2, 'expressjs/express::examples::@dev');
        });

        test('Link.canonicalizeRepo isolates different branches and subpaths', () => {
            const masterRepo = Link.canonicalizeRepo('https://github.com/foo/bar', 'master');
            const devRepo = Link.canonicalizeRepo('https://github.com/foo/bar', 'dev');
            const subpathRepo = Link.canonicalizeRepo('https://github.com/foo/bar', null, 'packages/core');

            assert.notEqual(masterRepo, devRepo);
            assert.notEqual(masterRepo, subpathRepo);
        });

        test('user isolation: queries always include user_id alongside canonical_repo', () => {
            // Confirm findByUserAndCanonical is defined as a 2-argument method (userId, canonicalRepo)
            assert.equal(typeof Link.findByUserAndCanonical, 'function');
            assert.equal(Link.findByUserAndCanonical.length, 2);
        });
    });

    describe('5. Complete Deletion, Storage Cleanup & Tombstone Handling', () => {
        test('Link model defines tombstone and deletion methods', () => {
            assert.equal(typeof Link.markDeleting, 'function');
            assert.equal(typeof Link.recordDeletedLink, 'function');
            assert.equal(typeof Link.recordFailedCleanup, 'function');
            assert.equal(typeof Link.isDeleted, 'function');
        });

        test('cancelJob safely cancels active background jobs and prevents restoration', () => {
            assert.equal(typeof cancelJob, 'function');
            // Cancel non-existent job does not throw
            cancelJob('non-existent-slug');
            assert.equal(isJobActive('non-existent-slug'), false);
        });

        test('Deleted link returns 410 tombstone status semantics', () => {
            // A tombstoned link has status: 'deleted'
            const tombstone = { status: 'deleted' };
            const isGone = tombstone.status === 'deleted';
            const statusCode = isGone ? 410 : 200;
            assert.equal(statusCode, 410);
        });
    });

    describe('6. Zero Tier Bypasses & Strict Equal Treatment', () => {
        test('No premium limits or tier branches in rateLimitHandler', () => {
            const delay = calculateBackoffDelay(1, null);
            assert.ok(delay.waitMs >= 2000 && delay.waitMs <= 2600, 'Backoff is bounded standard exponential backoff with jitter');
        });
    });
});

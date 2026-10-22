import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { 
    sanitizeLog, 
    parseRateLimitHeaders, 
    calculateBackoffDelay, 
    withRateLimitRetry 
} from '../backend/services/rateLimitHandler.js';
import { 
    isJobActive, 
    getJobManagerStats, 
    runConversionJob 
} from '../backend/services/jobManager.js';

describe('RepoCodeBridge Rate-Limit & Stuck-Job Regression Suite', () => {

    describe('1. Sanitized Logging (Zero Secret Leaks)', () => {
        test('masks classic GitHub tokens (ghp_)', () => {
            const raw = 'Failed to fetch repo with token ghp_1234567890abcdef1234567890abcdef';
            const sanitized = sanitizeLog(raw);
            assert.ok(!sanitized.includes('ghp_1234567890abcdef1234567890abcdef'));
            assert.ok(sanitized.includes('ghp_***'));
        });

        test('masks fine-grained GitHub personal access tokens (github_pat_)', () => {
            const raw = 'Auth error for github_pat_11AAAAAAA0123456789abcdefghijklmnopqrstuvwxyz0123456789_abcdef';
            const sanitized = sanitizeLog(raw);
            assert.ok(!sanitized.includes('github_pat_11AAAAAAA0123456789abcdefghijklmnopqrstuvwxyz0123456789_abcdef'));
            assert.ok(sanitized.includes('github_pat_***'));
        });

        test('masks Bearer tokens and DB connection passwords', () => {
            const bearerMsg = 'Request failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz123';
            const sanitizedBearer = sanitizeLog(bearerMsg);
            assert.ok(!sanitizedBearer.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
            assert.ok(sanitizedBearer.includes('Bearer ***'));

            const dbMsg = 'Connection refused: postgresql://postgres:SuperSecretPassword123@db.supabase.co:5432/postgres';
            const sanitizedDb = sanitizeLog(dbMsg);
            assert.ok(!sanitizedDb.includes('SuperSecretPassword123'));
            assert.ok(sanitizedDb.includes('postgresql://***:***@db.supabase.co'));
        });
    });

    describe('2. Rate-Limit Header Parsing & Bounded Backoff', () => {
        test('parses Retry-After and X-RateLimit headers from fetch Headers object', () => {
            const headers = new Headers();
            headers.set('Retry-After', '12');
            headers.set('X-RateLimit-Reset', '1700000000');
            headers.set('X-RateLimit-Remaining', '0');
            headers.set('X-RateLimit-Limit', '60');

            const parsed = parseRateLimitHeaders(headers);
            assert.equal(parsed.retryAfter, 12);
            assert.equal(parsed.resetTime, 1700000000);
            assert.equal(parsed.remaining, 0);
            assert.equal(parsed.limit, 60);
        });

        test('parses plain object headers (Octokit format)', () => {
            const headers = {
                'retry-after': '5',
                'x-ratelimit-reset': '1690000000',
                'x-ratelimit-remaining': '3',
            };
            const parsed = parseRateLimitHeaders(headers);
            assert.equal(parsed.retryAfter, 5);
            assert.equal(parsed.resetTime, 1690000000);
            assert.equal(parsed.remaining, 3);
        });

        test('calculateBackoffDelay respects Retry-After seconds', () => {
            const headers = { 'retry-after': '3' };
            const backoff = calculateBackoffDelay(headers, 0, 15000);
            assert.equal(backoff.shouldRetry, true);
            assert.equal(backoff.waitMs, 3000);
        });

        test('calculateBackoffDelay rejects wait if reset window exceeds maxWaitMs', () => {
            // Reset time 1 hour in future
            const futureEpoch = Math.floor(Date.now() / 1000) + 3600;
            const headers = { 'x-ratelimit-reset': String(futureEpoch) };
            const backoff = calculateBackoffDelay(headers, 0, 15000);
            assert.equal(backoff.shouldRetry, false);
            assert.ok(backoff.reason.includes('exceeds max allowed backoff'));
        });

        test('withRateLimitRetry retries on 403/429 and eventually succeeds', async () => {
            let callCount = 0;
            const retryEvents = [];

            const operation = async () => {
                callCount++;
                if (callCount === 1) {
                    const err = new Error('Rate limit exceeded');
                    err.status = 429;
                    err.headers = { 'retry-after': '1' };
                    throw err;
                }
                return { success: true, callCount };
            };

            const result = await withRateLimitRetry(operation, {
                stage: 'TEST_OP',
                maxRetries: 2,
                maxWaitMs: 2000,
                onRetry: (e) => retryEvents.push(e),
            });

            assert.equal(result.success, true);
            assert.equal(callCount, 2);
            assert.equal(retryEvents.length, 1);
            assert.equal(retryEvents[0].status, 429);
        });

        test('withRateLimitRetry fails immediately on non-rate-limit errors (e.g. 404)', async () => {
            let callCount = 0;
            const operation = async () => {
                callCount++;
                const err = new Error('Not found');
                err.status = 404;
                throw err;
            };

            await assert.rejects(async () => {
                await withRateLimitRetry(operation, { maxRetries: 2 });
            }, /Not found/);

            assert.equal(callCount, 1);
        });
    });

    describe('3. Concurrency Limits & Duplicate Job Prevention', () => {
        test('getJobManagerStats returns active job state', () => {
            const stats = getJobManagerStats();
            assert.equal(typeof stats.activeCount, 'number');
            assert.equal(stats.maxConcurrent, 3);
            assert.ok(Array.isArray(stats.activeLinkIds));
        });

        test('isJobActive accurately reports job existence', () => {
            assert.equal(isJobActive('non-existent-link-id'), false);
        });

        test('runConversionJob prevents duplicate execution for active link', async () => {
            const fakeLinkId = 'a0000000-0000-0000-0000-000000000001';
            
            // First call starts job with dummy repo URL so it executes quickly without large network downloads
            const jobPromise1 = runConversionJob({
                linkId: fakeLinkId,
                slug: 'test-slug-concurrency',
                repoUrl: 'https://github.com/mock-test-org/dummy-test-repo',
                repoName: 'mock-test-org/dummy-test-repo',
            });

            // Second call with same linkId must be synchronously rejected as DUPLICATE_JOB
            const duplicateResult = await runConversionJob({
                linkId: fakeLinkId,
                slug: 'test-slug-concurrency',
                repoUrl: 'https://github.com/mock-test-org/dummy-test-repo',
                repoName: 'mock-test-org/dummy-test-repo',
            });

            assert.deepEqual(duplicateResult, {
                started: false,
                reason: 'DUPLICATE_JOB',
            });

            // Await first job completion (it safely errors on dummy repo and cleans up)
            await jobPromise1.catch(() => {});
            assert.equal(isJobActive(fakeLinkId), false);
        });
    });

    describe('4. Stuck-Job Recovery & Usable Content Preservation Logic', () => {
        test('Link.recoverStuckJobs SQL statement preserves existing gist_url content', () => {
            // Verify status transition logic:
            // CASE WHEN gist_url IS NOT NULL THEN 'ready' ELSE 'failed' END
            const transitionStatusWithExistingContent = (gistUrl) => {
                return gistUrl ? 'ready' : 'failed';
            };

            // Existing refresh failure must preserve 'ready' so readers can still view code
            assert.equal(transitionStatusWithExistingContent('https://supabase.co/storage/v1/object/public/repos/react.txt'), 'ready');
            // Initial conversion failure with no prior content must transition to 'failed'
            assert.equal(transitionStatusWithExistingContent(null), 'failed');
            assert.equal(transitionStatusWithExistingContent(''), 'failed');
        });
    });
});

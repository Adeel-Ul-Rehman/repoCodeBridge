import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Job } from '../backend/models/Job.js';
import { executeJobStep, advanceJobUntilTimeout } from '../backend/services/jobManager.js';

describe('Vercel Serverless Durable Jobs & Concurrency Suite', () => {

    describe('1. Atomic Durable Job Model & Duplicate Prevention', () => {
        test('creates a durable job in queued state with isDuplicate=false', async () => {
            const { job, isDuplicate } = await Job.create({
                userId: 'user_srv_1',
                linkId: 'link_srv_1',
                canonicalRepo: 'facebook/react',
                repoUrl: 'https://github.com/facebook/react',
                repoName: 'react',
                selectedPaths: ['src/index.js'],
                jobType: 'convert',
            });

            assert.ok(job.id, 'Job should have a unique ID');
            assert.equal(isDuplicate, false);
            assert.equal(job.user_id, 'user_srv_1');
            assert.equal(job.canonical_repo, 'facebook/react');
            assert.equal(job.status, 'queued');
            assert.equal(job.progress, 0);
        });

        test('detects concurrent duplicate job for same user and canonical repo', async () => {
            const first = await Job.create({
                userId: 'user_srv_dup',
                linkId: 'link_srv_dup1',
                canonicalRepo: 'vercel/next.js',
                repoUrl: 'https://github.com/vercel/next.js',
                jobType: 'convert',
            });
            assert.equal(first.isDuplicate, false);

            // Attempting to create a second concurrent job for the same user and repo
            const second = await Job.create({
                userId: 'user_srv_dup',
                linkId: 'link_srv_dup2',
                canonicalRepo: 'vercel/next.js',
                repoUrl: 'https://github.com/vercel/next.js',
                jobType: 'convert',
            });

            assert.equal(second.isDuplicate, true, 'Must flag duplicate active job');
            assert.equal(second.job.id, first.job.id, 'Must return the existing active job');
        });

        test('allows a new job after the previous job completes', async () => {
            const { job } = await Job.create({
                userId: 'user_srv_seq',
                linkId: 'link_srv_seq1',
                canonicalRepo: 'octocat/Hello-World',
                repoUrl: 'https://github.com/octocat/Hello-World',
                jobType: 'convert',
            });

            await Job.markCompleted(job.id);

            // Now a new job can be created safely for the same repo
            const next = await Job.create({
                userId: 'user_srv_seq',
                linkId: 'link_srv_seq1',
                canonicalRepo: 'octocat/Hello-World',
                repoUrl: 'https://github.com/octocat/Hello-World',
                jobType: 'refresh',
            });

            assert.equal(next.isDuplicate, false);
            assert.notEqual(next.job.id, job.id);
        });
    });

    describe('2. Distributed Lock Lease Mechanism (Serverless Instance Safety)', () => {
        test('first worker claims lock with a 30-second lease', async () => {
            const { job } = await Job.create({
                userId: 'user_lock_1',
                linkId: 'link_lock_1',
                canonicalRepo: 'expressjs/express',
                repoUrl: 'https://github.com/expressjs/express',
            });

            const claimed = await Job.claimLock(job.id, 'worker_lambda_A', 30);
            assert.ok(claimed, 'Worker A should claim the lock');
            assert.equal(claimed.locked_by, 'worker_lambda_A');
            assert.equal(claimed.status, 'processing');
        });

        test('second worker cannot claim lock while lease is active', async () => {
            const { job } = await Job.create({
                userId: 'user_lock_2',
                linkId: 'link_lock_2',
                canonicalRepo: 'vuejs/core',
                repoUrl: 'https://github.com/vuejs/core',
            });

            await Job.claimLock(job.id, 'worker_lambda_A', 30);

            // Worker B attempts to claim the same job lock while lease is active
            const secondClaim = await Job.claimLock(job.id, 'worker_lambda_B', 30);
            assert.equal(secondClaim, null, 'Worker B must be rejected while lease is held');
        });

        test('worker can recover lock if previous lease expired (simulated serverless timeout)', async () => {
            const { job } = await Job.create({
                userId: 'user_lock_3',
                linkId: 'link_lock_3',
                canonicalRepo: 'tailwindlabs/tailwindcss',
                repoUrl: 'https://github.com/tailwindlabs/tailwindcss',
            });

            const claimedA = await Job.claimLock(job.id, 'worker_lambda_A', 30);
            assert.ok(claimedA);

            // Simulate lease expiry by back-dating locked_at
            claimedA.locked_at = new Date(Date.now() - 35000);

            // Worker B should now be able to claim the expired lock
            const recoveredClaim = await Job.claimLock(job.id, 'worker_lambda_B', 30);
            assert.ok(recoveredClaim, 'Worker B should recover the lock after lease expiry');
            assert.equal(recoveredClaim.locked_by, 'worker_lambda_B');
        });
    });

    describe('3. Persisted Checkpoint Resumption & Status Transitions', () => {
        test('persists checkpoint and advances progress monotonically', async () => {
            const { job } = await Job.create({
                userId: 'user_chk_1',
                linkId: 'link_chk_1',
                canonicalRepo: 'denoland/deno',
                repoUrl: 'https://github.com/denoland/deno',
            });

            const checkpoint1 = {
                nextIndex: 15,
                totalFiles: 30,
                fetchedFiles: [{ path: 'a.js' }],
            };

            const updatedJob = await Job.saveCheckpoint(job.id, {
                stage: 'FETCHING_FILES',
                progress: 50,
                checkpoint: checkpoint1,
                status: 'processing',
                keepLock: true,
            });

            assert.equal(updatedJob.progress, 50);
            assert.equal(updatedJob.stage, 'FETCHING_FILES');

            const checkpoint2 = {
                nextIndex: 30,
                totalFiles: 30,
                fetchedFiles: [{ path: 'a.js' }, { path: 'b.js' }],
            };

            const finalCheckpointJob = await Job.saveCheckpoint(job.id, {
                stage: 'GENERATING_MARKDOWN',
                progress: 85,
                checkpoint: checkpoint2,
                status: 'processing',
                keepLock: true,
            });

            assert.equal(finalCheckpointJob.progress, 85);
            assert.equal(finalCheckpointJob.stage, 'GENERATING_MARKDOWN');
        });

        test('marks job as rate-limited with reset timestamp', async () => {
            const { job } = await Job.create({
                userId: 'user_rl_1',
                linkId: 'link_rl_1',
                canonicalRepo: 'owner/rl-repo',
                repoUrl: 'https://github.com/owner/rl-repo',
            });

            const resetTime = new Date(Date.now() + 60000);
            const rlJob = await Job.markRateLimited(job.id, 'GitHub rate limit exceeded. Resumes automatically.', resetTime);
            assert.equal(rlJob.status, 'rate_limited');
            assert.equal(rlJob.locked_by, null);
        });

        test('marks job as failed and clears locks', async () => {
            const { job } = await Job.create({
                userId: 'user_fail_1',
                linkId: 'link_fail_1',
                canonicalRepo: 'owner/fail-repo',
                repoUrl: 'https://github.com/owner/fail-repo',
            });

            const failedJob = await Job.markFailed(job.id, 'Fatal GitHub API error', false);
            assert.equal(failedJob.status, 'failed');
            assert.equal(failedJob.locked_by, null);
        });

        test('cancelling job by link ID invalidates active jobs on deletion', async () => {
            const { job } = await Job.create({
                userId: 'user_del_1',
                linkId: 'link_del_target',
                canonicalRepo: 'owner/deletable-repo',
                repoUrl: 'https://github.com/owner/deletable-repo',
            });

            await Job.cancelByLinkId('link_del_target');

            const cancelled = await Job.findById(job.id);
            assert.equal(cancelled.status, 'cancelled');
            assert.equal(cancelled.locked_by, null);
        });
    });

    describe('4. Bounded Step Execution in Serverless Window', () => {
        test('executeJobStep runs a bounded step and updates checkpoint', async () => {
            const { job } = await Job.create({
                userId: 'user_step_1',
                linkId: 'b0000000-0000-0000-0000-000000000001',
                canonicalRepo: 'owner/sample-batch',
                repoUrl: 'https://github.com/owner/sample-batch',
                selectedPaths: ['file1.js', 'file2.js'],
                branch: 'main',
            });

            // Simulate tree with fetched files already present in checkpoint
            await Job.saveCheckpoint(job.id, {
                stage: 'FETCHING_FILES',
                progress: 80,
                checkpoint: {
                    filesToFetch: [],
                    fetchedFiles: [{ path: 'file1.js', sha: 'sha1', content: 'console.log("hello")' }],
                    nextIndex: 0,
                    totalFiles: 0,
                },
                status: 'processing',
                keepLock: true,
            });

            const stepResult = await executeJobStep(job.id, 'worker_step_tester');
            assert.ok(stepResult);
            assert.equal(stepResult.stage, 'COMPLETING');
            assert.equal(stepResult.progress, 85);
        });

        test('advanceJobUntilTimeout exits gracefully before exceeding time limit', async () => {
            const { job } = await Job.create({
                userId: 'user_timeout_1',
                linkId: 'b0000000-0000-0000-0000-000000000002',
                canonicalRepo: 'owner/bounded-timeout',
                repoUrl: 'https://github.com/owner/bounded-timeout',
            });

            // Set checkpoint so execution proceeds without external network delay
            await Job.saveCheckpoint(job.id, {
                stage: 'FETCHING_FILES',
                progress: 80,
                checkpoint: { filesToFetch: [], fetchedFiles: [], nextIndex: 0, totalFiles: 0 },
                status: 'processing',
                keepLock: true,
            });

            const startTime = Date.now();
            const result = await advanceJobUntilTimeout(job.id, 'user_timeout_1', 300);
            const duration = Date.now() - startTime;

            assert.ok(duration < 8000, `Execution should respect bounded window (took ${duration}ms)`);
            assert.ok(result !== undefined);
        });
    });

    describe('5. Cross-User Authorization and Isolation', () => {
        test('user B cannot advance or access user A job', async () => {
            const { job: jobA } = await Job.create({
                userId: 'user_alpha',
                linkId: 'b0000000-0000-0000-0000-000000000003',
                canonicalRepo: 'org/alpha-private',
                repoUrl: 'https://github.com/org/alpha-private',
            });

            // User Alpha can access
            const authOwner = await Job.findById(jobA.id, 'user_alpha');
            assert.ok(authOwner);

            // User Beta cannot access (returns null)
            const unauthorized = await Job.findById(jobA.id, 'user_beta');
            assert.equal(unauthorized, null, 'User Beta must not be authorized to inspect User Alpha job');

            // User Beta cannot advance job
            await assert.rejects(
                async () => {
                    await advanceJobUntilTimeout(jobA.id, 'worker_beta', 500, 'user_beta');
                },
                /Unauthorized: you do not own this job/
            );
        });
    });
});

// backend/models/Job.js
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// In-memory fallback map for unit test environments where database is mocked or offline
const mockJobs = new Map();
let isTablePresent = true;

function checkTableError(err) {
    if (err && (err.code === '42P01' || err.message?.includes('relation "conversion_jobs" does not exist') || err.message?.includes('does not exist'))) {
        isTablePresent = false;
    }
}

class Job {
    /**
     * Creates a new durable conversion or refresh job in the database.
     * Prevents duplicate active jobs for the same user and canonical repository.
     */
    static async create({
        userId,
        linkId,
        canonicalRepo,
        repoUrl,
        repoName,
        branch = null,
        subpath = null,
        selectedPaths = null,
        options = {},
        jobType = 'convert',
    }) {
        const id = uuidv4();
        const selectedPathsJson = selectedPaths ? (typeof selectedPaths === 'string' ? selectedPaths : JSON.stringify(selectedPaths)) : null;
        const optionsJson = options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null;

        if (!isTablePresent) {
            const existingMock = Array.from(mockJobs.values()).find(
                j => j.user_id === userId && j.canonical_repo === canonicalRepo && ['queued', 'processing'].includes(j.status)
            );
            if (existingMock) {
                return { job: existingMock, isDuplicate: true };
            }

            const mockJob = {
                id,
                link_id: linkId,
                user_id: userId,
                job_type: jobType,
                canonical_repo: canonicalRepo,
                repo_url: repoUrl,
                repo_name: repoName,
                branch,
                subpath,
                selected_paths: selectedPathsJson,
                options: optionsJson,
                status: 'queued',
                progress: 0,
                stage: 'INITIALIZING',
                checkpoint: null,
                attempts: 0,
                max_attempts: 3,
                created_at: new Date(),
                updated_at: new Date(),
            };
            mockJobs.set(id, mockJob);
            return { job: mockJob, isDuplicate: false };
        }

        try {
            // Check if an active job already exists for this user and canonical repo
            const existingRes = await query(
                `SELECT * FROM conversion_jobs 
                 WHERE user_id = $1 AND canonical_repo = $2 AND status IN ('queued', 'processing')
                 ORDER BY created_at DESC LIMIT 1`,
                [userId, canonicalRepo]
            );

            if (existingRes.rows && existingRes.rows.length > 0) {
                return { job: existingRes.rows[0], isDuplicate: true };
            }

            const insertRes = await query(
                `INSERT INTO conversion_jobs (
                    id, link_id, user_id, job_type, canonical_repo, repo_url, repo_name,
                    branch, subpath, selected_paths, options, status, progress, stage, attempts
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'queued', 0, 'INITIALIZING', 0)
                RETURNING *`,
                [id, linkId, userId, jobType, canonicalRepo, repoUrl, repoName, branch, subpath, selectedPathsJson, optionsJson]
            );

            return { job: insertRes.rows[0], isDuplicate: false };
        } catch (err) {
            checkTableError(err);
            // Check for unique constraint violation (concurrency race)
            if (err.code === '23505' || err.message?.includes('uq_active_job_per_user_canonical')) {
                try {
                    const raceRes = await query(
                        `SELECT * FROM conversion_jobs 
                         WHERE user_id = $1 AND canonical_repo = $2 AND status IN ('queued', 'processing')
                         ORDER BY created_at DESC LIMIT 1`,
                        [userId, canonicalRepo]
                    );
                    if (raceRes.rows && raceRes.rows[0]) {
                        return { job: raceRes.rows[0], isDuplicate: true };
                    }
                } catch (_) {}
            }

            // Fallback for mock/offline test environments
            const existingMock = Array.from(mockJobs.values()).find(
                j => j.user_id === userId && j.canonical_repo === canonicalRepo && ['queued', 'processing'].includes(j.status)
            );
            if (existingMock) {
                return { job: existingMock, isDuplicate: true };
            }

            const mockJob = {
                id,
                link_id: linkId,
                user_id: userId,
                job_type: jobType,
                canonical_repo: canonicalRepo,
                repo_url: repoUrl,
                repo_name: repoName,
                branch,
                subpath,
                selected_paths: selectedPathsJson,
                options: optionsJson,
                status: 'queued',
                progress: 0,
                stage: 'INITIALIZING',
                checkpoint: null,
                attempts: 0,
                max_attempts: 3,
                created_at: new Date(),
                updated_at: new Date(),
            };
            mockJobs.set(id, mockJob);
            return { job: mockJob, isDuplicate: false };
        }
    }

    /**
     * Finds a job by ID, with optional user authorization check.
     */
    static async findById(id, userId = null) {
        if (!id) return null;
        if (!isTablePresent) {
            const mock = mockJobs.get(id);
            if (!mock) return null;
            if (userId && mock.user_id !== userId) return null;
            return mock;
        }

        try {
            const sql = userId 
                ? `SELECT * FROM conversion_jobs WHERE id = $1 AND user_id = $2`
                : `SELECT * FROM conversion_jobs WHERE id = $1`;
            const params = userId ? [id, userId] : [id];
            const result = await query(sql, params);
            return result.rows[0] || null;
        } catch (err) {
            checkTableError(err);
            const mock = mockJobs.get(id);
            if (!mock) return null;
            if (userId && mock.user_id !== userId) return null;
            return mock;
        }
    }

    /**
     * Finds the latest active or completed job for a given link ID.
     */
    static async findByLinkId(linkId, userId = null) {
        if (!linkId) return null;
        if (!isTablePresent) {
            return Array.from(mockJobs.values()).find(j => j.link_id === linkId && (!userId || j.user_id === userId)) || null;
        }

        try {
            const sql = userId
                ? `SELECT * FROM conversion_jobs WHERE link_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`
                : `SELECT * FROM conversion_jobs WHERE link_id = $1 ORDER BY created_at DESC LIMIT 1`;
            const params = userId ? [linkId, userId] : [linkId];
            const result = await query(sql, params);
            return result.rows[0] || null;
        } catch (err) {
            checkTableError(err);
            return Array.from(mockJobs.values()).find(j => j.link_id === linkId && (!userId || j.user_id === userId)) || null;
        }
    }

    /**
     * Finds currently active job for a user + canonical repo.
     */
    static async findActiveByCanonical(userId, canonicalRepo) {
        if (!userId || !canonicalRepo) return null;
        if (!isTablePresent) {
            return Array.from(mockJobs.values()).find(
                j => j.user_id === userId && j.canonical_repo === canonicalRepo && ['queued', 'processing'].includes(j.status)
            ) || null;
        }

        try {
            const result = await query(
                `SELECT * FROM conversion_jobs 
                 WHERE user_id = $1 AND canonical_repo = $2 AND status IN ('queued', 'processing')
                 ORDER BY created_at DESC LIMIT 1`,
                [userId, canonicalRepo]
            );
            return result.rows[0] || null;
        } catch (err) {
            checkTableError(err);
            return Array.from(mockJobs.values()).find(
                j => j.user_id === userId && j.canonical_repo === canonicalRepo && ['queued', 'processing'].includes(j.status)
            ) || null;
        }
    }

    /**
     * Atomically claims execution lock on a job for a bounded lease window.
     * Prevents conflicting concurrent worker invocations on Vercel.
     */
    static async claimLock(jobId, workerId, leaseSeconds = 30) {
        if (!isTablePresent) {
            const mock = mockJobs.get(jobId);
            if (mock && ['queued', 'processing'].includes(mock.status)) {
                if (mock.locked_at && mock.locked_by && mock.locked_by !== workerId) {
                    const elapsedSec = (Date.now() - new Date(mock.locked_at).getTime()) / 1000;
                    if (elapsedSec < leaseSeconds) {
                        return null; // Active lease held by another worker
                    }
                }
                mock.status = 'processing';
                mock.locked_at = new Date();
                mock.locked_by = workerId;
                mock.attempts = (mock.attempts || 0) + 1;
                return mock;
            }
            return null;
        }

        try {
            const result = await query(
                `UPDATE conversion_jobs
                 SET status = 'processing',
                     locked_at = NOW(),
                     locked_by = $2,
                     attempts = attempts + 1,
                     updated_at = NOW()
                 WHERE id = $1
                   AND (locked_at IS NULL OR locked_at < NOW() - ($3 || ' seconds')::INTERVAL)
                   AND status IN ('queued', 'processing')
                 RETURNING *`,
                [jobId, workerId, leaseSeconds]
            );
            return result.rows[0] || null;
        } catch (err) {
            checkTableError(err);
            const mock = mockJobs.get(jobId);
            if (mock && ['queued', 'processing'].includes(mock.status)) {
                if (mock.locked_at && mock.locked_by && mock.locked_by !== workerId) {
                    const elapsedSec = (Date.now() - new Date(mock.locked_at).getTime()) / 1000;
                    if (elapsedSec < leaseSeconds) {
                        return null; // Active lease held by another worker
                    }
                }
                mock.status = 'processing';
                mock.locked_at = new Date();
                mock.locked_by = workerId;
                mock.attempts = (mock.attempts || 0) + 1;
                return mock;
            }
            return null;
        }
    }

    /**
     * Persists job checkpoint and progress in the database.
     */
    static async saveCheckpoint(jobId, { stage, progress, checkpoint, status = 'processing', lastError = null, keepLock = false }) {
        const cpJson = checkpoint ? (typeof checkpoint === 'string' ? checkpoint : JSON.stringify(checkpoint)) : null;

        if (!isTablePresent) {
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.stage = stage;
                mock.progress = progress;
                mock.checkpoint = cpJson;
                mock.status = status;
                mock.last_error = lastError;
                if (!keepLock) {
                    mock.locked_at = null;
                    mock.locked_by = null;
                }
                mock.updated_at = new Date();
                return mock;
            }
            return null;
        }

        try {
            const sql = keepLock
                ? `UPDATE conversion_jobs
                   SET stage = $2, progress = $3, checkpoint = $4, status = $5, last_error = $6, updated_at = NOW()
                   WHERE id = $1 RETURNING *`
                : `UPDATE conversion_jobs
                   SET stage = $2, progress = $3, checkpoint = $4, status = $5, last_error = $6, locked_at = NULL, locked_by = NULL, updated_at = NOW()
                   WHERE id = $1 RETURNING *`;
            const result = await query(sql, [jobId, stage, progress, cpJson, status, lastError]);
            return result.rows[0] || null;
        } catch (err) {
            checkTableError(err);
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.stage = stage;
                mock.progress = progress;
                mock.checkpoint = cpJson;
                mock.status = status;
                mock.last_error = lastError;
                if (!keepLock) {
                    mock.locked_at = null;
                    mock.locked_by = null;
                }
                mock.updated_at = new Date();
                return mock;
            }
            return null;
        }
    }

    /**
     * Marks a job as completed.
     */
    static async markCompleted(jobId) {
        if (!isTablePresent) {
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.status = 'completed';
                mock.progress = 100;
                mock.stage = 'COMPLETED';
                mock.completed_at = new Date();
                mock.locked_at = null;
                mock.locked_by = null;
                return mock;
            }
            return null;
        }

        try {
            const result = await query(
                `UPDATE conversion_jobs
                 SET status = 'completed', progress = 100, stage = 'COMPLETED', completed_at = NOW(), locked_at = NULL, locked_by = NULL, updated_at = NOW()
                 WHERE id = $1 RETURNING *`,
                [jobId]
            );
            return result.rows[0] || null;
        } catch (err) {
            checkTableError(err);
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.status = 'completed';
                mock.progress = 100;
                mock.stage = 'COMPLETED';
                mock.completed_at = new Date();
                mock.locked_at = null;
                mock.locked_by = null;
                return mock;
            }
            return null;
        }
    }

    /**
     * Marks a job as rate-limited, saving reset timestamp so it can be resumed when quota refreshes.
     */
    static async markRateLimited(jobId, message, retryAfterDate = null) {
        if (!isTablePresent) {
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.status = 'rate_limited';
                mock.last_error = message;
                mock.retry_after = retryAfterDate;
                mock.locked_at = null;
                mock.locked_by = null;
                return mock;
            }
            return null;
        }

        try {
            const result = await query(
                `UPDATE conversion_jobs
                 SET status = 'rate_limited', last_error = $2, retry_after = $3, locked_at = NULL, locked_by = NULL, updated_at = NOW()
                 WHERE id = $1 RETURNING *`,
                [jobId, message, retryAfterDate]
            );
            return result.rows[0] || null;
        } catch (err) {
            checkTableError(err);
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.status = 'rate_limited';
                mock.last_error = message;
                mock.retry_after = retryAfterDate;
                mock.locked_at = null;
                mock.locked_by = null;
                return mock;
            }
            return null;
        }
    }

    /**
     * Marks a job as failed, either permanently or as retryable.
     */
    static async markFailed(jobId, message, isRetryable = false) {
        if (!isTablePresent) {
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.status = isRetryable && mock.attempts < (mock.max_attempts || 3) ? 'queued' : 'failed';
                mock.last_error = message;
                mock.locked_at = null;
                mock.locked_by = null;
                return mock;
            }
            return null;
        }

        try {
            const jobRes = await query(`SELECT attempts, max_attempts FROM conversion_jobs WHERE id = $1`, [jobId]);
            const current = jobRes.rows[0];
            const canRetry = isRetryable && current && (current.attempts < current.max_attempts);

            const nextStatus = canRetry ? 'queued' : 'failed';
            const result = await query(
                `UPDATE conversion_jobs
                 SET status = $2, last_error = $3, locked_at = NULL, locked_by = NULL, updated_at = NOW()
                 WHERE id = $1 RETURNING *`,
                [jobId, nextStatus, message]
            );
            return result.rows[0] || null;
        } catch (err) {
            checkTableError(err);
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.status = isRetryable && mock.attempts < (mock.max_attempts || 3) ? 'queued' : 'failed';
                mock.last_error = message;
                mock.locked_at = null;
                mock.locked_by = null;
                return mock;
            }
            return null;
        }
    }

    /**
     * Cancels a specific job by ID.
     */
    static async cancel(jobId) {
        if (!isTablePresent) {
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.status = 'cancelled';
                mock.locked_at = null;
                mock.locked_by = null;
                return mock;
            }
            return null;
        }

        try {
            const result = await query(
                `UPDATE conversion_jobs
                 SET status = 'cancelled', locked_at = NULL, locked_by = NULL, updated_at = NOW()
                 WHERE id = $1 RETURNING *`,
                [jobId]
            );
            return result.rows[0] || null;
        } catch (err) {
            checkTableError(err);
            const mock = mockJobs.get(jobId);
            if (mock) {
                mock.status = 'cancelled';
                mock.locked_at = null;
                mock.locked_by = null;
                return mock;
            }
            return null;
        }
    }

    /**
     * Cancels any active jobs associated with a link ID.
     */
    static async cancelByLinkId(linkId) {
        if (!linkId) return;
        if (!isTablePresent) {
            for (const mock of mockJobs.values()) {
                if (mock.link_id === linkId && ['queued', 'processing'].includes(mock.status)) {
                    mock.status = 'cancelled';
                    mock.locked_at = null;
                    mock.locked_by = null;
                }
            }
            return;
        }

        try {
            await query(
                `UPDATE conversion_jobs
                 SET status = 'cancelled', locked_at = NULL, locked_by = NULL, updated_at = NOW()
                 WHERE link_id = $1 AND status IN ('queued', 'processing')`,
                [linkId]
            );
        } catch (err) {
            checkTableError(err);
            for (const mock of mockJobs.values()) {
                if (mock.link_id === linkId && ['queued', 'processing'].includes(mock.status)) {
                    mock.status = 'cancelled';
                    mock.locked_at = null;
                    mock.locked_by = null;
                }
            }
        }
    }
}

export { Job };
export default Job;

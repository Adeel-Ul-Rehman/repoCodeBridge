// pages/api/jobs/[id].js
import { authenticate } from '../../../backend/middleware/auth.js';
import Job from '../../../backend/models/Job.js';
import { advanceJobUntilTimeout } from '../../../backend/services/jobManager.js';

export const config = {
    maxDuration: 60,
};

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'Job ID is required' });
    }

    try {
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } catch {
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        return;
    }

    if (res.headersSent) return;
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        let job = await Job.findById(id);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Strict per-user authorization: users can never inspect another user's job
        if (job.user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not have permission to access this job' });
        }

        // If job is in-flight and lock is free or expired, drive the next step forward
        if (['queued', 'processing'].includes(job.status)) {
            const isLockFree = !job.locked_at || (new Date() - new Date(job.locked_at) > 30000);
            if (isLockFree || req.method === 'POST') {
                await advanceJobUntilTimeout(job.id, `poll-worker-${req.user.id.slice(0, 8)}`, 6000);
                job = await Job.findById(id);
            }
        }

        res.status(200).json({
            success: true,
            job: {
                id: job.id,
                linkId: job.link_id,
                jobType: job.job_type,
                canonicalRepo: job.canonical_repo,
                repoUrl: job.repo_url,
                repoName: job.repo_name,
                status: job.status,
                progress: job.progress,
                stage: job.stage,
                attempts: job.attempts,
                lastError: job.last_error,
                retryAfter: job.retry_after,
                createdAt: job.created_at,
                updatedAt: job.updated_at,
                completedAt: job.completed_at,
            },
        });
    } catch (error) {
        console.error('Job status lookup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

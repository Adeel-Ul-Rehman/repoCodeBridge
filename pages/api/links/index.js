// pages/api/links/index.js
import { authenticate } from '../../../backend/middleware/auth.js';
import Link from '../../../backend/models/Link.js';
import Job from '../../../backend/models/Job.js';
import { advanceJobUntilTimeout } from '../../../backend/services/jobManager.js';

export const config = {
    maxDuration: 60,
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } catch (authErr) {
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
        // Opportunistic recovery: check if any jobs belonging to user have been stuck in 'processing' > 5 mins
        await Link.recoverStuckJobs(5).catch(() => {});

        const links = await Link.findByUser(req.user.id, false);
        
        // Attach active job progress and advance processing links if lock is free
        for (const link of links) {
            if (link.status === 'processing') {
                const job = await Job.findByLinkId(link.id, req.user.id);
                if (job && ['queued', 'processing'].includes(job.status)) {
                    link.active_job_id = job.id;
                    link.progress = job.progress || 15;
                    const isLockFree = !job.locked_at || (new Date() - new Date(job.locked_at) > 30000);
                    if (isLockFree) {
                        advanceJobUntilTimeout(job.id, `poll-${req.user.id.slice(0, 8)}`, 4000).catch(() => {});
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            links: links,
        });
    } catch (error) {
        console.error('Get links error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
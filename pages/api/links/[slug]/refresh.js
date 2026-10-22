import Link from '../../../../backend/models/Link.js';
import Job from '../../../../backend/models/Job.js';
import { authenticate } from '../../../../backend/middleware/auth.js';
import { invalidateRepoCache } from '../../../../backend/services/repoFetcher.js';
import { runConversionJob, advanceJobUntilTimeout } from '../../../../backend/services/jobManager.js';
import { sanitizeLog } from '../../../../backend/services/rateLimitHandler.js';

export const config = {
    maxDuration: 60,
};

export default async function handler(req, res) {
    const slug = req.query?.slug || req.params?.slug;
    
    if (req.method !== 'POST') {
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
        const link = await Link.findBySlug(slug);
        
        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }
        
        if (link.user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not own this link' });
        }
        
        const isExpired = new Date(link.expires_at) < new Date() || link.status === 'expired';
        if (isExpired) {
            return res.status(410).json({ 
                error: 'LINK_EXPIRED', 
                message: 'This repository link has expired. Links remain active for 7 days.' 
            });
        }
        
        // Atomically claim refresh: ensures only one worker processes this link at a time
        const claimedLink = await Link.claimRefresh(link.id, req.user.id);
        if (!claimedLink) {
            return res.status(400).json({ error: 'Link is already being processed. Please wait.' });
        }
        
        console.log(`🔄 Refreshing repository: ${link.repo_name} (${slug})`);
        
        // Targeted cache invalidation only for this repository
        invalidateRepoCache(link.repo_url);
        
        // Preserve applicable branch or subpath if present in repo_name
        const options = {};
        const branchMatch = link.repo_name.match(/\(@([^)]+)\)/);
        if (branchMatch) options.branch = branchMatch[1].trim();
        const subpathMatch = link.repo_name.match(/\[\/([^\]]+)\]/);
        if (subpathMatch) options.subpath = subpathMatch[1].trim();

        const { selectedPaths } = req.body || {};
        if (selectedPaths && Array.isArray(selectedPaths)) {
            options.selectedPaths = selectedPaths;
        } else if (link.selected_paths) {
            try {
                options.selectedPaths = typeof link.selected_paths === 'string' ? JSON.parse(link.selected_paths) : link.selected_paths;
            } catch {}
        }

        // Create durable refresh job
        const canonicalRepo = link.canonical_repo || Link.canonicalizeRepo(link.repo_url, options.branch, options.subpath);
        const { job } = await Job.create({
            userId: req.user.id,
            linkId: link.id,
            canonicalRepo,
            repoUrl: link.repo_url,
            repoName: link.repo_name,
            branch: options.branch,
            subpath: options.subpath,
            selectedPaths: options.selectedPaths,
            options,
            jobType: 'refresh',
        });

        // Advance steps in serverless execution
        const stepPromise = advanceJobUntilTimeout(job.id, 'refresh-worker', 8000);
        if (typeof res.waitUntil === 'function') {
            res.waitUntil(stepPromise);
        } else if (typeof globalThis.waitUntil === 'function') {
            globalThis.waitUntil(stepPromise);
        }

        // Allow up to 2.5s for fast/up-to-date checks to resolve immediately
        await Promise.race([stepPromise, new Promise(r => setTimeout(r, 2500))]);
        const latestJob = await Job.findById(job.id);
        const isReady = latestJob?.status === 'completed';
        
        res.status(isReady ? 200 : 202).json({
            success: true,
            jobId: job.id,
            status: isReady ? 'ready' : (latestJob?.status || 'processing'),
            progress: latestJob?.progress || 10,
            message: isReady ? 'Repository is already up to date.' : 'Refresh started. The link will be updated with latest changes.',
        });
        
    } catch (error) {
        console.error(sanitizeLog(`Refresh error: ${error.message}`));
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to refresh repository' });
        }
    }
}
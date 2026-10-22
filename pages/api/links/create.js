import { authenticate } from '../../../backend/middleware/auth.js';
import Link from '../../../backend/models/Link.js';
import User from '../../../backend/models/User.js';
import Job from '../../../backend/models/Job.js';
import { validateRepository } from '../../../backend/services/repoFetcher.js';
import { runConversionJob, advanceJobUntilTimeout } from '../../../backend/services/jobManager.js';
import { sanitizeLog } from '../../../backend/services/rateLimitHandler.js';
import { createLinkLimiter, applyRateLimit } from '../../../backend/middleware/rateLimit.js';

export const config = {
    maxDuration: 60,
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Apply link creation rate limit (20 creations per hour per IP)
    await applyRateLimit(req, res, createLinkLimiter);
    if (res.headersSent) return;
    
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
    
    const { repoUrl, branch, subpath, selectedPaths, excludeTests, excludeDocs } = req.body || {};
    
    if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.trim()) {
        return res.status(400).json({ 
            error: 'NO_URL',
            message: 'Please enter a GitHub repository URL' 
        });
    }
    
    // STEP 1: Validate repository
    const validation = await validateRepository(repoUrl.trim());
    
    if (!validation.valid) {
        return res.status(400).json({
            error: validation.error,
            message: validation.message,
        });
    }
    
    // STEP 2: General tool limits (150MB max repo size)
    const userLimits = await Link.getUserLimits(req.user.id);
    const repoSizeMB = validation.repoInfo.sizeMB;
    
    if (repoSizeMB > userLimits.maxRepoSizeMB) {
        return res.status(400).json({
            error: 'REPO_TOO_LARGE',
            message: `Repository size (${repoSizeMB.toFixed(1)} MB) exceeds the ${userLimits.maxRepoSizeMB} MB limit.`
        });
    }

    // STEP 3: Validate selected paths if provided (strict security check against directory traversal)
    let validatedPaths = [];
    if (selectedPaths && Array.isArray(selectedPaths) && selectedPaths.length > 0) {
        try {
            for (const p of selectedPaths) {
                if (typeof p !== 'string') continue;
                const clean = p.replace(/\\/g, '/').trim();
                if (clean.startsWith('/') || clean.includes('..') || clean.includes('\0')) {
                    return res.status(400).json({
                        error: 'INVALID_PATH',
                        message: `Invalid path: "${p}" contains forbidden directory traversal or absolute path.`,
                    });
                }
                validatedPaths.push(clean.replace(/^\/+/, '').replace(/\/+$/, ''));
            }
        } catch (valErr) {
            return res.status(400).json({
                error: 'INVALID_SELECTION',
                message: valErr.message,
            });
        }
    }
    
    try {
        const cleanUrl = repoUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
        const urlParts = cleanUrl.replace('https://github.com/', '').split('/');
        let repoName = `${urlParts[0]}/${urlParts[1]}`;
        
        if (subpath && typeof subpath === 'string' && subpath.trim()) {
            repoName += ` [/${subpath.trim().replace(/^\/+/, '')}]`;
        } else if (branch && typeof branch === 'string' && branch.trim()) {
            repoName += ` (@${branch.trim()})`;
        }

        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
        const baseUrl = `${protocol}://${host}`;

        const fetchOptions = {
            branch: typeof branch === 'string' && branch.trim() ? branch.trim() : (validation.repoInfo?.defaultBranch || null),
            subpath: typeof subpath === 'string' && subpath.trim() ? subpath.trim() : null,
            selectedPaths: validatedPaths.length > 0 ? validatedPaths : null,
            excludeTests: Boolean(excludeTests),
            excludeDocs: Boolean(excludeDocs),
        };

        // STEP 4: One reusable link per user for the same canonical repository
        const canonicalRepo = Link.canonicalizeRepo(cleanUrl, branch, subpath);
        const existingLink = await Link.findByUserAndCanonical(req.user.id, canonicalRepo);

        if (existingLink) {
            // If already actively being processed, prevent duplicate work and return current status
            if (existingLink.status === 'processing') {
                return res.status(200).json({
                    success: true,
                    link: {
                        id: existingLink.id,
                        slug: existingLink.slug,
                        repo_url: existingLink.repo_url,
                        repo_name: existingLink.repo_name,
                        expires_at: existingLink.expires_at,
                        status: existingLink.status,
                        ai_url: `${baseUrl}/r/${existingLink.slug}`,
                    },
                    message: 'Repository is already currently being processed. Please wait.',
                });
            }

            // Check if selection and content are identical and up to date
            const existingSelectedPaths = existingLink.selected_paths ? 
                (typeof existingLink.selected_paths === 'string' ? JSON.parse(existingLink.selected_paths) : existingLink.selected_paths) : [];
            const pathsMatch = JSON.stringify(existingSelectedPaths.sort()) === JSON.stringify(validatedPaths.sort());

            if (pathsMatch && existingLink.status === 'ready' && existingLink.gist_url) {
                return res.status(200).json({
                    success: true,
                    link: {
                        id: existingLink.id,
                        slug: existingLink.slug,
                        repo_url: existingLink.repo_url,
                        repo_name: existingLink.repo_name,
                        expires_at: existingLink.expires_at,
                        status: existingLink.status,
                        ai_url: `${baseUrl}/r/${existingLink.slug}`,
                    },
                    message: 'Repository link is already up to date with the selected files.',
                });
            }

            // Selection updated or previous attempt failed/rate-limited: reuse existing link and update
            const claimed = await Link.updateSelectionAndClaim(existingLink.id, req.user.id, validatedPaths);
            if (claimed) {
                const { job } = await Job.create({
                    userId: req.user.id,
                    linkId: existingLink.id,
                    canonicalRepo,
                    repoUrl: cleanUrl,
                    repoName: repoName,
                    branch: fetchOptions.branch,
                    subpath: fetchOptions.subpath,
                    selectedPaths: validatedPaths.length > 0 ? validatedPaths : null,
                    options: fetchOptions,
                    jobType: 'convert',
                });

                const stepPromise = advanceJobUntilTimeout(job.id, 'init-worker', 8000);
                if (typeof res.waitUntil === 'function') {
                    res.waitUntil(stepPromise);
                } else if (typeof globalThis.waitUntil === 'function') {
                    globalThis.waitUntil(stepPromise);
                }

                // If step finishes fast, wait briefly up to 2.5s
                await Promise.race([stepPromise, new Promise(r => setTimeout(r, 2500))]);
                const latestJob = await Job.findById(job.id);
                const isReady = latestJob?.status === 'completed';

                return res.status(isReady ? 200 : 202).json({
                    success: true,
                    jobId: job.id,
                    link: {
                        id: existingLink.id,
                        slug: existingLink.slug,
                        repo_url: existingLink.repo_url,
                        repo_name: existingLink.repo_name,
                        expires_at: claimed.expires_at,
                        status: isReady ? 'ready' : 'processing',
                        progress: latestJob?.progress || 10,
                        ai_url: `${baseUrl}/r/${existingLink.slug}`,
                    },
                    message: isReady ? 'Repository converted successfully.' : `Updating existing repository link with new folder/file selection...`,
                });
            }
        }
        
        // STEP 5: Check active links limit before creating a new link (50 active links)
        const canCreate = await User.canCreateLink(req.user.id);
        if (!canCreate) {
            return res.status(403).json({
                error: 'LIMIT_REACHED',
                message: `You have reached the maximum of ${userLimits.maxLinks} active links. Please delete an older link first.`
            });
        }
        
        // Strictly valid for 7 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        const link = await Link.create({
            userId: req.user.id,
            repoUrl: cleanUrl,
            repoName: repoName,
            canonicalRepo,
            selectedPaths: validatedPaths.length > 0 ? validatedPaths : null,
            expiresAt: expiresAt,
        });
        
        // Concurrency guard: if limit was reached by concurrent requests, link is null
        if (!link) {
            return res.status(403).json({
                error: 'LIMIT_REACHED',
                message: `You have reached the maximum of ${userLimits.maxLinks} active links. Please delete an older link first.`
            });
        }

        // Managed durable asynchronous conversion job with checkpoints and timeouts
        const { job } = await Job.create({
            userId: req.user.id,
            linkId: link.id,
            canonicalRepo,
            repoUrl: cleanUrl,
            repoName: repoName,
            branch: fetchOptions.branch,
            subpath: fetchOptions.subpath,
            selectedPaths: validatedPaths.length > 0 ? validatedPaths : null,
            options: fetchOptions,
            jobType: 'convert',
        });

        const stepPromise = advanceJobUntilTimeout(job.id, 'init-worker', 8000);
        if (typeof res.waitUntil === 'function') {
            res.waitUntil(stepPromise);
        } else if (typeof globalThis.waitUntil === 'function') {
            globalThis.waitUntil(stepPromise);
        }

        // Allow up to 2.5s for fast jobs to finish in initial request
        await Promise.race([stepPromise, new Promise(r => setTimeout(r, 2500))]);
        const latestJob = await Job.findById(job.id);
        const isReady = latestJob?.status === 'completed';

        res.status(isReady ? 200 : 202).json({
            success: true,
            jobId: job.id,
            link: {
                id: link.id,
                slug: link.slug,
                repo_url: link.repo_url,
                repo_name: link.repo_name,
                expires_at: link.expires_at,
                status: isReady ? 'ready' : 'processing',
                progress: latestJob?.progress || 10,
                repo_size_mb: repoSizeMB.toFixed(1),
                ai_url: `${baseUrl}/r/${link.slug}`,
            },
            message: isReady 
                ? 'Repository converted successfully. Your AI link is ready.'
                : `Repository validated successfully. Converting files for AI readability...`,
        });
        
    } catch (error) {
        console.error(sanitizeLog(`Create link error: ${error.message}`));
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'SERVER_ERROR', 
                message: 'Failed to initialize link creation. Please try again.' 
            });
        }
    }
}
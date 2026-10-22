// pages/api/links/[slug].js
import Link from '../../../backend/models/Link.js';
import Job from '../../../backend/models/Job.js';
import { authenticate } from '../../../backend/middleware/auth.js';
import { deleteFromSupabase, deleteAllLinkObjects } from '../../../utils/supabaseStorage.js';
import { cancelJob } from '../../../backend/services/jobManager.js';
import { invalidateRepoCache } from '../../../backend/services/repoFetcher.js';

export const config = {
    maxDuration: 60,
};

export default async function handler(req, res) {
    const slug = req.query?.slug || req.params?.slug;
    const raw = req.query?.raw || req.params?.raw;
    
    if (req.method === 'GET') {
        return getLink(req, res, slug, raw);
    }
    
    if (req.method === 'DELETE') {
        return deleteLink(req, res, slug);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}

async function getLink(req, res, slug, raw) {
    try {
        const link = await Link.findBySlug(slug);
        
        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }

        // Check if link was deleted
        if (link.status === 'deleted') {
            return res.status(410).json({
                error: 'LINK_DELETED',
                message: 'This repository-code link no longer exists.',
            });
        }

        let currentLink = link;
        if (currentLink.status === 'processing') {
            const ageMs = Date.now() - new Date(currentLink.processed_at || currentLink.created_at).getTime();
            if (ageMs > 5 * 60 * 1000) {
                await Link.recoverStuckJobs(5).catch(() => {});
                currentLink = (await Link.findBySlug(slug)) || currentLink;
            }
        }

        // Check 7-day expiration
        const isExpired = new Date(currentLink.expires_at) < new Date() || currentLink.status === 'expired';
        if (isExpired) {
            return res.status(410).json({ 
                error: 'LINK_EXPIRED', 
                message: 'This repository link has expired. All links are valid for 7 days.' 
            });
        }
        
        await Link.incrementViewCount(slug).catch(console.error);

        // If requested with ?raw=true or Accept: text/plain or text/markdown
        const wantsRaw = raw === 'true' || 
            req.headers.accept?.includes('text/markdown') || 
            req.headers.accept?.includes('text/plain');

        if (wantsRaw && currentLink.gist_url && currentLink.status === 'ready') {
            try {
                const storageRes = await fetch(currentLink.gist_url);
                if (storageRes.ok) {
                    const markdownText = await storageRes.text();
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.setHeader('Cache-Control', 'public, max-age=3600');
                    return res.status(200).send(markdownText);
                }
            } catch (fetchErr) {
                console.warn('Could not proxy storage markdown:', fetchErr.message);
                // Fall back to redirect if fetch failed
                return res.redirect(currentLink.gist_url);
            }
        }
        
        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
        const baseUrl = `${protocol}://${host}`;

        res.status(200).json({
            success: true,
            link: {
                id: currentLink.id,
                slug: currentLink.slug,
                repo_url: currentLink.repo_url,
                repo_name: currentLink.repo_name,
                file_count: currentLink.file_count,
                created_at: currentLink.created_at,
                expires_at: currentLink.expires_at,
                view_count: currentLink.view_count,
                status: currentLink.status,
                last_error: currentLink.last_error,
                gist_url: currentLink.gist_url,
                ai_url: `${baseUrl}/r/${currentLink.slug}`,
                raw_url: `${baseUrl}/api/links/${currentLink.slug}?raw=true`,
            },
        });
        
    } catch (error) {
        console.error('Get link error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function deleteLink(req, res, slug) {
    if (!slug) {
        return res.status(400).json({ error: 'Slug is required' });
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
        
        // 1. Mark link as deleting to prevent new work from starting against it
        await Link.markDeleting(link.id, req.user.id);

        // 2. Invalidate active/queued jobs for this link (in-memory and durable database state)
        cancelJob(link.id);
        await Job.cancelByLinkId(link.id);

        // 3. Invalidate memory cache for this repository
        invalidateRepoCache(link.repo_url);

        // 4. Delete external storage objects (index.md, snapshot.json, tree.json, etc.)
        let storageCleanupWarning = null;
        try {
            await deleteAllLinkObjects(slug);
        } catch (err) {
            storageCleanupWarning = err.message;
            console.warn(`[DeleteLink] External storage cleanup failed: ${err.message}`);
            await Link.recordFailedCleanup('supabase_storage', `${slug}/*`, err.message);
        }
        
        // 5. Remove associated database records and record permanent tombstone
        const deleted = await Link.delete(link.id, req.user.id, slug);
        
        if (!deleted) {
            return res.status(404).json({ error: 'Link not found' });
        }
        
        res.status(200).json({
            success: true,
            storageCleaned: !storageCleanupWarning,
            warning: storageCleanupWarning ? `External storage cleanup recorded for retry: ${storageCleanupWarning}` : undefined,
            message: 'Repository link and generated data deleted successfully.',
        });
        
    } catch (error) {
        console.error('Delete link error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
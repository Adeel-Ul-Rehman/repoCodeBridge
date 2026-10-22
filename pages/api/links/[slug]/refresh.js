// pages/api/links/[slug]/refresh.js
import Link from '../../../../backend/models/Link.js';
import { authenticate } from '../../../../backend/middleware/auth.js';
import { fetchRepository, invalidateRepoCache } from '../../../../backend/services/repoFetcher.js';
import { formatToMarkdown } from '../../../../backend/services/codeFormatter.js';
import { uploadToSupabase } from '../../../../utils/supabaseStorage.js';

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
        
        // Process refresh in background
        refreshLinkInBackground(link.id, link.repo_url, link.repo_name, slug);
        
        res.status(202).json({
            success: true,
            message: 'Refresh started. The link will be updated with latest changes.',
        });
        
    } catch (error) {
        console.error('Refresh error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to refresh repository' });
        }
    }
}

async function refreshLinkInBackground(linkId, repoUrl, repoName, slug) {
    const startedAt = new Date();
    try {
        console.log(`🔄 Refreshing link ${linkId} for ${repoName}`);
        
        // Preserve applicable branch or subpath if present in repo_name
        const options = {};
        const branchMatch = repoName.match(/\(@([^)]+)\)/);
        if (branchMatch) options.branch = branchMatch[1].trim();
        const subpathMatch = repoName.match(/\[\/([^\]]+)\]/);
        if (subpathMatch) options.subpath = subpathMatch[1].trim();
        
        // Correct argument placement: 1: url, 2: options, 3: forceRefresh=true
        const repoData = await fetchRepository(repoUrl, options, true);
        console.log(`   Fetched ${repoData.repoInfo.totalFiles} files (fresh from GitHub)`);
        
        const markdownContent = formatToMarkdown(repoData);
        console.log(`   Generated ${markdownContent.length} chars`);
        
        // Upload to Supabase (overwrite existing)
        const result = await uploadToSupabase(slug, markdownContent);
        console.log(`   ✅ Uploaded to Supabase: ${result.publicUrl}`);
        
        await Link.updateWithData(linkId, {
            size: repoData.repoInfo.totalSizeKB * 1024,
            fileCount: repoData.repoInfo.totalFiles,
            gistId: linkId,
            gistUrl: result.publicUrl,
            b2Key: result.key,
        }, startedAt);
        
        console.log(`✅ Link ${linkId} refreshed successfully`);
        console.log(`   File count: ${repoData.repoInfo.totalFiles} files`);
        console.log(`   🤖 AI-READABLE URL: ${result.publicUrl}`);
        
    } catch (error) {
        console.error(`❌ Failed to refresh link ${linkId}:`, error.message);
        // Preserve existing gist_url so user code remains readable if refresh fails
        await Link.markRefreshFailed(linkId, error.message || 'Failed to refresh repository');
    }
}
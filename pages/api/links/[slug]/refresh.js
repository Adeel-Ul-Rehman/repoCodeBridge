// pages/api/links/[slug]/refresh.js
import Link from '../../../../backend/models/Link.js';
import { authenticate } from '../../../../backend/middleware/auth.js';
import { fetchRepository, clearRepoCache } from '../../../../backend/services/repoFetcher.js';
import { formatToMarkdown } from '../../../../backend/services/codeFormatter.js';
import { uploadToSupabase } from '../../../../utils/supabaseStorage.js';

export default async function handler(req, res) {
    const { slug } = req.query;
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
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
        
        if (link.status === 'processing') {
            return res.status(400).json({ error: 'Link is already being processed. Please wait.' });
        }
        
        console.log(`🔄 Refreshing repository: ${link.repo_name} (${slug})`);
        
        // Mark as processing
        await Link.markFailed(link.id, 'Refreshing...');
        
        // Clear cache for fresh fetch
        clearRepoCache();
        
        // Process refresh in background
        refreshLinkInBackground(link.id, link.repo_url, link.repo_name, slug);
        
        res.status(202).json({
            success: true,
            message: 'Refresh started. The link will be updated with latest changes.',
        });
        
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ error: error.message || 'Failed to refresh repository' });
    }
}

async function refreshLinkInBackground(linkId, repoUrl, repoName, slug) {
    try {
        console.log(`🔄 Refreshing link ${linkId} for ${repoName}`);
        
        // Force refresh from GitHub (ignore cache)
        const repoData = await fetchRepository(repoUrl, true);
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
        });
        
        console.log(`✅ Link ${linkId} refreshed successfully`);
        console.log(`   File count: ${repoData.repoInfo.totalFiles} files`);
        console.log(`   🤖 AI-READABLE URL: ${result.publicUrl}`);
        
    } catch (error) {
        console.error(`❌ Failed to refresh link ${linkId}:`, error.message);
        await Link.markFailed(linkId, error.message);
    }
}
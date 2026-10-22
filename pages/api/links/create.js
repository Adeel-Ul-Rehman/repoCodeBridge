// pages/api/links/create.js
import { authenticate } from '../../../backend/middleware/auth.js';
import Link from '../../../backend/models/Link.js';
import User from '../../../backend/models/User.js';
import { validateRepository, fetchRepository } from '../../../backend/services/repoFetcher.js';
import { formatToMarkdown } from '../../../backend/services/codeFormatter.js';
import { uploadToSupabase } from '../../../utils/supabaseStorage.js';

export default async function handler(req, res) {
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
    
    const { repoUrl, branch, subpath, excludeTests, excludeDocs } = req.body || {};
    
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
    
    // STEP 3: Check active links limit (generous 50 active links)
    const canCreate = await User.canCreateLink(req.user.id);
    if (!canCreate) {
        return res.status(403).json({
            error: 'LIMIT_REACHED',
            message: `You have reached the maximum of ${userLimits.maxLinks} active links. Please delete an older link first.`
        });
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
        
        // Strictly valid for 7 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        const link = await Link.create({
            userId: req.user.id,
            repoUrl: cleanUrl,
            repoName: repoName,
            expiresAt: expiresAt,
        });
        
        // Concurrency guard: if limit was reached by concurrent requests, link is null
        if (!link) {
            return res.status(403).json({
                error: 'LIMIT_REACHED',
                message: `You have reached the maximum of ${userLimits.maxLinks} active links. Please delete an older link first.`
            });
        }
        
        const fetchOptions = {
            branch: typeof branch === 'string' && branch.trim() ? branch.trim() : null,
            subpath: typeof subpath === 'string' && subpath.trim() ? subpath.trim() : null,
            excludeTests: Boolean(excludeTests),
            excludeDocs: Boolean(excludeDocs),
        };

        // Fast asynchronous background processing
        processLinkInBackground(link.id, cleanUrl, repoName, link.slug, validation.repoInfo, fetchOptions);
        
        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
        const baseUrl = `${protocol}://${host}`;

        res.status(202).json({
            success: true,
            link: {
                id: link.id,
                slug: link.slug,
                repo_url: link.repo_url,
                repo_name: link.repo_name,
                expires_at: link.expires_at,
                status: 'processing',
                repo_size_mb: repoSizeMB.toFixed(1),
                ai_url: `${baseUrl}/r/${link.slug}`,
            },
            message: `Repository validated successfully. Converting files for AI readability...`,
        });
        
    } catch (error) {
        console.error('Create link error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'SERVER_ERROR', 
                message: 'Failed to initialize link creation. Please try again.' 
            });
        }
    }
}

async function processLinkInBackground(linkId, repoUrl, repoName, slug, repoInfo, options = {}) {
    try {
        console.log(`[Processor] Processing link ${linkId} for ${repoName} (${slug})`);
        
        const repoData = await fetchRepository(repoUrl, options);
        console.log(`   Fetched ${repoData.repoInfo.totalFiles} files in ~${repoData.repoInfo.totalSizeKB} KB`);
        
        const markdownContent = formatToMarkdown(repoData);
        console.log(`   Formatted AI markdown: ${markdownContent.length} characters`);
        
        const result = await uploadToSupabase(slug, markdownContent);
        console.log(`   ✅ Stored in Supabase: ${result.publicUrl}`);
        
        await Link.updateWithData(linkId, {
            size: repoData.repoInfo.totalSizeKB * 1024,
            fileCount: repoData.repoInfo.totalFiles,
            gistUrl: result.publicUrl,
            b2Key: result.key,
        });
        
        console.log(`🎉 Link ${linkId} (${slug}) ready for AI!`);
        
    } catch (error) {
        console.error(`❌ Failed to process link ${linkId}:`, error.message);
        await Link.markFailed(linkId, error.message || 'Failed to process repository code');
    }
}
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
    
    await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { repoUrl } = req.body;
    
    // Validate URL presence
    if (!repoUrl || !repoUrl.trim()) {
        return res.status(400).json({ 
            error: 'NO_URL',
            message: '⚠️ Please enter a repository URL' 
        });
    }
    
    // STEP 1: Validate repository
    const validation = await validateRepository(repoUrl.trim());
    
    if (!validation.valid) {
        let userMessage = validation.message;
        
        // Add helpful hints based on error type
        switch(validation.error) {
            case 'INVALID_URL':
            case 'INVALID_URL_FORMAT':
            case 'INVALID_REPO_PATH':
                userMessage = '⚠️ ' + validation.message + '\n\nExample: https://github.com/octocat/Hello-World';
                break;
            case 'REPO_NOT_FOUND':
                userMessage = '🔍 ' + validation.message;
                break;
            case 'PRIVATE_REPO':
                userMessage = '🔒 ' + validation.message;
                break;
            case 'EMPTY_REPO':
                userMessage = '📭 ' + validation.message;
                break;
            case 'RATE_LIMIT':
                userMessage = '⏳ ' + validation.message;
                break;
            default:
                userMessage = '❌ ' + validation.message;
        }
        
        return res.status(400).json({
            error: validation.error,
            message: userMessage
        });
    }
    
    // STEP 2: Check size limit based on user plan
    const repoSizeMB = validation.repoInfo.sizeMB;
    const userLimits = await Link.getUserLimits(req.user.id, req.user.is_premium);
    const maxSizeMB = userLimits.maxRepoSizeMB;
    
    if (repoSizeMB > maxSizeMB) {
        const upgradeMessage = !req.user.is_premium 
            ? ' Upgrade to premium for 200MB limit.' 
            : '';
        return res.status(400).json({
            error: 'REPO_TOO_LARGE',
            message: `📦 Repository size (${repoSizeMB.toFixed(2)} MB) exceeds your plan limit of ${maxSizeMB} MB.${upgradeMessage}`
        });
    }
    
    // STEP 3: Check active links limit
    const canCreate = await User.canCreateLink(req.user.id, req.user.is_premium);
    if (!canCreate) {
        return res.status(403).json({
            error: 'LIMIT_REACHED',
            message: `📌 You have reached the maximum of ${userLimits.maxLinks} active links. Please delete an existing link first.`
        });
    }
    
    try {
        const cleanUrl = repoUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
        const urlParts = cleanUrl.replace('https://github.com/', '').split('/');
        const repoName = `${urlParts[0]}/${urlParts[1]}`;
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + userLimits.expiryDays);
        
        const link = await Link.create({
            userId: req.user.id,
            repoUrl: cleanUrl,
            repoName: repoName,
            expiresAt: expiresAt,
        });
        
        // Process in background
        processLinkInBackground(link.id, cleanUrl, repoName, link.slug, validation.repoInfo);
        
        res.status(202).json({
            success: true,
            link: {
                id: link.id,
                slug: link.slug,
                repo_url: link.repo_url,
                repo_name: link.repo_name,
                expires_at: link.expires_at,
                status: 'processing',
                repo_size_mb: repoSizeMB.toFixed(2),
            },
            message: `✅ Repository validated! Processing ${validation.repoInfo.totalFiles > 0 ? validation.repoInfo.totalFiles : 'files'}...`,
        });
        
    } catch (error) {
        console.error('Create link error:', error);
        res.status(500).json({ 
            error: 'SERVER_ERROR', 
            message: '❌ Internal server error. Please try again.' 
        });
    }
}

async function processLinkInBackground(linkId, repoUrl, repoName, slug, repoInfo) {
    try {
        console.log(`🔄 Processing link ${linkId} for ${repoName}`);
        console.log(`   Repo size: ${repoInfo.sizeMB.toFixed(2)} MB`);
        console.log(`   Default branch: ${repoInfo.defaultBranch}`);
        
        const repoData = await fetchRepository(repoUrl);
        console.log(`   Fetched ${repoData.repoInfo.totalFiles} files`);
        
        const markdownContent = formatToMarkdown(repoData);
        console.log(`   Generated ${markdownContent.length} chars`);
        
        const result = await uploadToSupabase(slug, markdownContent);
        console.log(`   ✅ Uploaded to Supabase: ${result.publicUrl}`);
        
        await Link.updateWithData(linkId, {
            size: repoData.repoInfo.totalSizeKB * 1024,
            fileCount: repoData.repoInfo.totalFiles,
            gistUrl: result.publicUrl,
            b2Key: result.key,
        });
        
        console.log(`✅ Link ${linkId} processed successfully`);
        console.log(`   🤖 AI-READABLE URL: ${result.publicUrl}`);
        
    } catch (error) {
        console.error(`❌ Failed to process link ${linkId}:`, error.message);
        await Link.markFailed(linkId, error.message);
    }
}   
// pages/api/links/[slug]/download-zip.js
import Link from '../../../../backend/models/Link.js';
import { authenticate } from '../../../../backend/middleware/auth.js';
import { createRepoZipFromGitHub, createSimpleZip } from '../../../../backend/services/zipService.js';

export default async function handler(req, res) {
    const { slug } = req.query;
    
    if (req.method !== 'GET') {
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
        
        if (link.status !== 'ready') {
            return res.status(400).json({ error: 'Link is not ready yet. Please wait for processing to complete.' });
        }
        
        console.log(`📦 Downloading repository ZIP for: ${link.repo_name}`);
        
        let zipBuffer;
        
        try {
            zipBuffer = await createRepoZipFromGitHub(link.repo_url, link.repo_name, slug);
        } catch (fetchError) {
            console.error('GitHub fetch failed:', fetchError.message);
            const response = await fetch(link.gist_url);
            if (response.ok) {
                const markdownContent = await response.text();
                zipBuffer = await createSimpleZip(link.repo_name, markdownContent);
            } else {
                throw new Error('Unable to fetch repository content');
            }
        }
        
        const filename = `${link.repo_name.replace('/', '-')}-source-code.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', zipBuffer.length);
        
        res.status(200).send(zipBuffer);
        
    } catch (error) {
        console.error('Download ZIP error:', error);
        res.status(500).json({ error: 'Failed to create ZIP file: ' + error.message });
    }
}
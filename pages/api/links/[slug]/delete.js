// pages/api/links/[slug]/delete.js
const { authenticate } = require('../../../../backend/middleware/auth');
const Link = require('../../../../backend/models/Link');
const { deleteCode } = require('../../../utils/storage');
const { deleteGist } = require('../../../utils/gist');

export default async function handler(req, res) {
    const { slug } = req.query;
    
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Authenticate user
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
        // Get link
        const link = await Link.findBySlug(slug);
        
        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }
        
        // Check ownership
        if (link.user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not own this link' });
        }
        
        // Delete from Backblaze (if exists)
        if (link.b2_key) {
            await deleteCode(slug).catch(console.error);
        }
        
        // Delete from GitHub Gists (if exists)
        if (link.gist_id) {
            await deleteGist(link.gist_id).catch(console.error);
        }
        
        // Delete from database
        const deleted = await Link.delete(link.id, req.user.id);
        
        if (!deleted) {
            return res.status(404).json({ error: 'Link not found' });
        }
        
        res.status(200).json({
            success: true,
            message: 'Link deleted successfully',
        });
    } catch (error) {
        console.error('Delete link error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
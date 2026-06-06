// pages/api/links/[slug].js
import Link from '../../../backend/models/Link.js';
import { authenticate } from '../../../backend/middleware/auth.js';
import { deleteFromSupabase } from '../../../utils/supabaseStorage.js';

export default async function handler(req, res) {
    const { slug } = req.query;
    
    console.log(`📨 API called: ${req.method} /api/links/${slug}`);
    
    if (req.method === 'GET') {
        return getLink(req, res, slug);
    }
    
    if (req.method === 'DELETE') {
        return deleteLink(req, res, slug);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}

async function getLink(req, res, slug) {
    try {
        const link = await Link.findBySlug(slug);
        
        if (!link) {
            return res.status(404).json({ error: 'Link not found' });
        }
        
        await Link.incrementViewCount(slug).catch(console.error);
        
        res.status(200).json({
            success: true,
            link: {
                id: link.id,
                slug: link.slug,
                repo_url: link.repo_url,
                repo_name: link.repo_name,
                file_count: link.file_count,
                created_at: link.created_at,
                expires_at: link.expires_at,
                view_count: link.view_count,
                status: link.status,
                gist_url: link.gist_url,
            },
        });
        
    } catch (error) {
        console.error('Get link error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

async function deleteLink(req, res, slug) {
    console.log(`🗑️ DELETE request for slug: ${slug}`);
    
    if (!slug) {
        return res.status(400).json({ error: 'Slug is required' });
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
        
        // Delete from Supabase storage
        try {
            await deleteFromSupabase(slug);
            console.log(`✅ Deleted from Supabase`);
        } catch (err) {
            console.log(`⚠️ Supabase delete failed: ${err.message}`);
        }
        
        // Delete from database
        const deleted = await Link.delete(link.id, req.user.id);
        
        if (!deleted) {
            return res.status(404).json({ error: 'Link not found' });
        }
        
        console.log(`✅ Successfully deleted link: ${slug}`);
        
        res.status(200).json({
            success: true,
            message: 'Link deleted successfully',
        });
        
    } catch (error) {
        console.error('Delete link error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
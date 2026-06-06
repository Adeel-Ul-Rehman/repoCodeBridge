// pages/api/links/delete.js
import Link from '../../../backend/models/Link.js';
import { authenticate } from '../../../backend/middleware/auth.js';
import { deleteFromSupabase } from '../../../utils/supabaseStorage.js';

export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { slug } = req.query;
    
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
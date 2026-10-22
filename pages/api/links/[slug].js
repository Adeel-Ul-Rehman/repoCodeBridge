// pages/api/links/[slug].js
import Link from '../../../backend/models/Link.js';
import { authenticate } from '../../../backend/middleware/auth.js';
import { deleteFromSupabase } from '../../../utils/supabaseStorage.js';

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

        // Check 7-day expiration
        const isExpired = new Date(link.expires_at) < new Date() || link.status === 'expired';
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

        if (wantsRaw && link.gist_url && link.status === 'ready') {
            try {
                const storageRes = await fetch(link.gist_url);
                if (storageRes.ok) {
                    const markdownText = await storageRes.text();
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.setHeader('Cache-Control', 'public, max-age=3600');
                    return res.status(200).send(markdownText);
                }
            } catch (fetchErr) {
                console.warn('Could not proxy storage markdown:', fetchErr.message);
                // Fall back to redirect if fetch failed
                return res.redirect(link.gist_url);
            }
        }
        
        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
        const baseUrl = `${protocol}://${host}`;

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
                ai_url: `${baseUrl}/r/${link.slug}`,
                raw_url: `${baseUrl}/api/links/${link.slug}?raw=true`,
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
        
        // Delete from Supabase storage
        try {
            await deleteFromSupabase(slug);
        } catch (err) {
            console.warn(`Supabase delete note: ${err.message}`);
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
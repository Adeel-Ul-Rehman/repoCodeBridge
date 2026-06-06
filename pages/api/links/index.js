// pages/api/links/index.js
import { authenticate } from '../../../backend/middleware/auth.js';
import Link from '../../../backend/models/Link.js';

export default async function handler(req, res) {
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
        const links = await Link.findByUser(req.user.id, false);
        
        res.status(200).json({
            success: true,
            links: links,
        });
    } catch (error) {
        console.error('Get links error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
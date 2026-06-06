// pages/api/auth/me.js
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
        const limits = await Link.getUserLimits(req.user.id, req.user.is_premium);
        
        res.status(200).json({
            success: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                is_premium: req.user.is_premium,
                created_at: req.user.created_at,
                last_login: req.user.last_login,
            },
            limits: limits,
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
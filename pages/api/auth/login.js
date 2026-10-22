// pages/api/auth/login.js
import jwt from 'jsonwebtoken';
import User from '../../../backend/models/User.js';
import { authLimiter, applyRateLimit } from '../../../backend/middleware/rateLimit.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Apply rate limiting (15 attempts per 15 min per IP)
    await applyRateLimit(req, res, authLimiter);
    if (res.headersSent) return;
    
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    try {
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (!user.password_hash) {
            return res.status(401).json({ error: 'Please login with Google or GitHub' });
        }
        
        const isValid = await User.verifyPassword(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        await User.updateLastLogin(user.id);
        
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
        
        const isProd = process.env.NODE_ENV === 'production';
        res.setHeader(
            'Set-Cookie', 
            `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${isProd ? '; Secure' : ''}`
        );
        
        res.status(200).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                is_premium: false,
            },
            token: token,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
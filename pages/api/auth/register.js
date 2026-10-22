// pages/api/auth/register.js
import User from '../../../backend/models/User.js';
import { authLimiter, applyRateLimit } from '../../../backend/middleware/rateLimit.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Apply rate limiting (15 attempts per 15 min per IP)
    await applyRateLimit(req, res, authLimiter);
    if (res.headersSent) return;
    
    const { email, password } = req.body || {};
    
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    if (!normalizedEmail.includes('@') || normalizedEmail.length < 5) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    try {
        const existingUser = await User.findByEmail(normalizedEmail);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }
        
        // Equal treatment for all users (zero premium-specific branching)
        const hashedPassword = await User.hashPassword(password);
        const user = await User.create(normalizedEmail, hashedPassword, false);
        
        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                is_premium: false,
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
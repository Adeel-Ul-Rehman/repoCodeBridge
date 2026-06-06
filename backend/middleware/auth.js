// backend/middleware/auth.js - Remove the dev mode section
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return null;
    }
}

async function authenticate(req, res, next) {
    let token = req.cookies?.token;
    
    if (!token && req.headers.authorization) {
        token = req.headers.authorization.replace('Bearer ', '');
    }
    
    // REMOVED the dev mode auto-authentication section
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    const result = await query(
        'SELECT id, email, is_premium, premium_expires_at, created_at FROM users WHERE id = $1',
        [decoded.userId]
    );
    
    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = result.rows[0];
    req.userId = req.user.id;
    next();
}

async function optionalAuth(req, res, next) {
    try {
        let token = req.cookies?.token;
        
        if (!token && req.headers.authorization) {
            token = req.headers.authorization.replace('Bearer ', '');
        }
        
        if (token) {
            const decoded = verifyToken(token);
            if (decoded) {
                const result = await query(
                    'SELECT id, email, is_premium FROM users WHERE id = $1',
                    [decoded.userId]
                );
                if (result.rows.length > 0) {
                    req.user = result.rows[0];
                    req.userId = req.user.id;
                }
            }
        }
    } catch (err) {
        // Ignore auth errors in optional auth
    }
    next();
}

export { authenticate, optionalAuth };
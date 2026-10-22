// backend/middleware/auth.js
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
    try {
        let token = req.cookies?.token;
        
        if (!token && req.headers?.authorization) {
            token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        }
        
        if (!token) {
            if (!res.headersSent) {
                res.status(401).json({ error: 'Authentication required' });
            }
            if (typeof next === 'function') next();
            return;
        }
        
        const decoded = verifyToken(token);
        if (!decoded || !decoded.userId) {
            if (!res.headersSent) {
                res.status(401).json({ error: 'Invalid or expired token' });
            }
            if (typeof next === 'function') next();
            return;
        }
        
        const result = await query(
            'SELECT id, email, created_at, password_hash, is_premium FROM users WHERE id = $1',
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            if (!res.headersSent) {
                res.status(401).json({ error: 'User not found' });
            }
            if (typeof next === 'function') next();
            return;
        }
        
        const user = result.rows[0];
        req.user = user;
        req.userId = user.id;
        if (typeof next === 'function') next();
    } catch (err) {
        console.error('Authentication database error:', err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
        if (typeof next === 'function') next(err);
    }
}

async function optionalAuth(req, res, next) {
    try {
        let token = req.cookies?.token;
        
        if (!token && req.headers?.authorization) {
            token = req.headers.authorization.replace(/^Bearer\s+/i, '');
        }
        
        if (token) {
            const decoded = verifyToken(token);
            if (decoded && decoded.userId) {
                const result = await query(
                    'SELECT id, email, created_at, is_premium FROM users WHERE id = $1',
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
    if (typeof next === 'function') next();
}

export { authenticate, optionalAuth };
// pages/api/auth/google/callback.js
import passport from 'passport';
import '../../../../backend/config/passport.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    return new Promise((resolve, reject) => {
        passport.authenticate('google', { session: false }, (err, user) => {
            if (err || !user) {
                console.error('Google callback error:', err);
                res.redirect('/login?error=google_auth_failed');
                return resolve();
            }
            
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );
            
            res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`);
            res.redirect('/dashboard');
            resolve();
        })(req, res);
    });
}
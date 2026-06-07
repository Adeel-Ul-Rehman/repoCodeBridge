// pages/api/auth/github/callback.js
import passport from 'passport';
import '../../../../backend/config/passport.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    return new Promise((resolve, reject) => {
        passport.authenticate('github', { session: false }, (err, user) => {
            if (err || !user) {
                console.error('GitHub callback error:', err);
                // Redirect to login with error
                res.redirect('/login?error=github_auth_failed');
                return resolve();
            }
            
            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );
            
            // Set cookie
            res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`);
            
            // Redirect to dashboard
            res.redirect('/dashboard');
            resolve();
        })(req, res);
    });
}
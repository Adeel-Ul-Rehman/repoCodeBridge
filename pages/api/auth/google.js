// pages/api/auth/google.js
import passport from 'passport';
import '../../../backend/config/passport.js';

export default async function handler(req, res) {
    return new Promise((resolve, reject) => {
        passport.authenticate('google', {
            scope: ['profile', 'email'],
            session: false,
        })(req, res, (err) => {
            if (err) {
                console.error('Google auth error:', err);
                res.redirect('/login?error=google_auth_failed');
                return resolve();
            }
            resolve();
        });
    });
}
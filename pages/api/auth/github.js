// pages/api/auth/github.js
import passport from 'passport';
import '../../../backend/config/passport.js';

export default async function handler(req, res) {
    return new Promise((resolve, reject) => {
        passport.authenticate('github', {
            scope: ['user:email'],
            session: false,
        })(req, res, (err) => {
            if (err) {
                console.error('GitHub auth error:', err);
                res.redirect('/login?error=github_auth_failed');
                return resolve();
            }
            resolve();
        });
    });
}
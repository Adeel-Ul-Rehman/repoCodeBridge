// pages/api/auth/google.js
import passport from 'passport';
import '../../../backend/config/passport.js';

function getGoogleCallbackUrl(req) {
    if (process.env.GOOGLE_CALLBACK_URL) {
        return process.env.GOOGLE_CALLBACK_URL;
    }
    const host = req.headers.host;
    const isLocalhost = host?.includes('localhost') || host?.includes('127.0.0.1');
    if (!isLocalhost && process.env.APP_URL) {
        return `${process.env.APP_URL.replace(/\/$/, '')}/api/auth/google/callback`;
    }
    const protocol = req.headers['x-forwarded-proto'] || (isLocalhost ? 'http' : 'https');
    return `${protocol}://${host}/api/auth/google/callback`;
}

export default async function handler(req, res) {
    const callbackURL = getGoogleCallbackUrl(req);
    console.log(`🔗 Initiating Google OAuth with callback: ${callbackURL}`);

    return new Promise((resolve) => {
        passport.authenticate('google', {
            scope: ['profile', 'email'],
            session: false,
            callbackURL: callbackURL,
        })(req, res, (err) => {
            if (err) {
                console.error('Google auth error:', err);
                res.redirect('/login?error=google_auth_failed&msg=' + encodeURIComponent(err.message || 'OAuth error'));
                return resolve();
            }
            resolve();
        });
    });
}
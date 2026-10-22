// pages/api/auth/github.js
import passport from 'passport';
import '../../../backend/config/passport.js';

function getGitHubCallbackUrl(req) {
    if (process.env.GITHUB_CALLBACK_URL) {
        return process.env.GITHUB_CALLBACK_URL;
    }
    const host = req.headers.host;
    const isLocalhost = host?.includes('localhost') || host?.includes('127.0.0.1');
    if (!isLocalhost && process.env.APP_URL) {
        return `${process.env.APP_URL.replace(/\/$/, '')}/api/auth/github/callback`;
    }
    const protocol = req.headers['x-forwarded-proto'] || (isLocalhost ? 'http' : 'https');
    return `${protocol}://${host}/api/auth/github/callback`;
}

export default async function handler(req, res) {
    const callbackURL = getGitHubCallbackUrl(req);
    console.log(`🔗 Initiating GitHub OAuth with callback: ${callbackURL}`);

    return new Promise((resolve) => {
        passport.authenticate('github', {
            scope: ['user:email'],
            session: false,
            callbackURL: callbackURL,
        })(req, res, (err) => {
            if (err) {
                console.error('GitHub auth error:', err);
                res.redirect('/login?error=github_auth_failed&msg=' + encodeURIComponent(err.message || 'OAuth error'));
                return resolve();
            }
            resolve();
        });
    });
}
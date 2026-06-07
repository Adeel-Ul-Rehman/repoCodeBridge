// pages/api/auth/debug.js
export default function handler(req, res) {
    res.status(200).json({
        message: 'Debug Info',
        environment: process.env.NODE_ENV,
        googleClientId: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
        githubClientId: process.env.GITHUB_CLIENT_ID ? '✅ Set' : '❌ Missing',
        githubClientSecret: process.env.GITHUB_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
        appUrl: process.env.APP_URL || '❌ Missing',
        host: req.headers.host,
        protocol: req.headers['x-forwarded-proto'] || 'http',
        fullUrl: `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}${req.url}`,
    });
}
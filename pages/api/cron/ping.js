// pages/api/cron/ping.js
import { pingSupabase } from '../../../scripts/ping-supabase.js';

export default async function handler(req, res) {
    // Allow GET and POST
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Require valid secret for every request when CRON_SECRET is configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        let token = null;
        const authHeader = req.headers?.authorization;
        const querySecret = req.query?.secret;

        if (authHeader && typeof authHeader === 'string') {
            token = authHeader.replace(/^Bearer\s+/i, '').trim();
        } else if (querySecret && typeof querySecret === 'string') {
            token = querySecret.trim();
        }

        if (!token || token !== cronSecret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const source = req.headers['user-agent']?.includes('GitHub') ? 'github-actions' : (req.query?.source || 'api-cron');
        const result = await pingSupabase(source);

        if (result.success) {
            return res.status(200).json({
                status: 'ok',
                message: 'Supabase database & storage keep-alive ping successful. Project will remain active.',
                ...result,
            });
        } else {
            return res.status(500).json({
                status: 'error',
                message: 'Keep-alive ping completed with errors',
                ...result,
            });
        }
    } catch (error) {
        console.error('Cron ping endpoint error:', error.message);
        return res.status(500).json({
            status: 'error',
            error: 'Keep-alive ping failed',
        });
    }
}

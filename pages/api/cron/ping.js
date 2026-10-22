// pages/api/cron/ping.js
import { pingSupabase } from '../../../scripts/ping-supabase.js';

export default async function handler(req, res) {
    // Allow GET and POST
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Optional: if CRON_SECRET is configured, check it if passed in Authorization header or query
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;
    const querySecret = req.query.secret;

    if (cronSecret && (authHeader || querySecret)) {
        const token = authHeader ? authHeader.replace('Bearer ', '') : querySecret;
        if (token !== cronSecret) {
            return res.status(401).json({ error: 'Invalid cron secret' });
        }
    }

    try {
        const source = req.headers['user-agent']?.includes('GitHub') ? 'github-actions' : (req.query.source || 'api-cron');
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
        console.error('Cron ping endpoint error:', error);
        return res.status(500).json({
            status: 'error',
            error: error.message,
        });
    }
}

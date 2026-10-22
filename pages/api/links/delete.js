// pages/api/links/delete.js
import linkHandler from './[slug].js';

export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    return linkHandler(req, res);
}
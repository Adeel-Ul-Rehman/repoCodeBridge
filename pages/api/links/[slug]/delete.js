// pages/api/links/[slug]/delete.js
import linkHandler from '../[slug].js';

/**
 * Legacy deletion endpoint: safely delegates to the primary [slug].js handler
 * preserving authentication, ownership checks, and Supabase/database deletion.
 */
export default async function handler(req, res) {
    req.method = 'DELETE';
    return linkHandler(req, res);
}
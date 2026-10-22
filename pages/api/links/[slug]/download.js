// pages/api/links/[slug]/download.js
import downloadZipHandler from './download-zip.js';

/**
 * Legacy download endpoint: safely delegates to download-zip.js
 * preserving authentication, ownership checks, and ZIP generation.
 */
export default async function handler(req, res) {
    return downloadZipHandler(req, res);
}

// pages/api/repo/tree.js
import { authenticate } from '../../../backend/middleware/auth.js';
import { validateRepository, fetchRepoTree, parseGitHubUrl } from '../../../backend/services/repoFetcher.js';
import { apiLimiter, applyRateLimit } from '../../../backend/middleware/rateLimit.js';

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Apply rate limit
    await applyRateLimit(req, res, apiLimiter);
    if (res.headersSent) return;

    // Optional authentication check
    try {
        await new Promise((resolve) => {
            authenticate(req, res, () => resolve());
        });
    } catch {
        // Continue if unauthenticated
    }

    const repoUrl = req.method === 'POST' ? req.body?.repoUrl : req.query?.repoUrl;
    const branch = req.method === 'POST' ? req.body?.branch : req.query?.branch;
    const subpath = req.method === 'POST' ? req.body?.subpath : req.query?.subpath;
    const forceRefresh = req.method === 'POST' ? Boolean(req.body?.forceRefresh) : req.query?.forceRefresh === 'true';

    if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.trim()) {
        return res.status(400).json({
            error: 'NO_URL',
            message: 'Please provide a valid GitHub repository URL',
        });
    }

    // STEP 1: Validate repository URL and accessibility
    const validation = await validateRepository(repoUrl.trim());
    if (!validation.valid) {
        return res.status(400).json({
            error: validation.error,
            message: validation.message,
        });
    }

    try {
        const { owner, repo } = parseGitHubUrl(repoUrl.trim());
        const targetBranch = branch && branch.trim() ? branch.trim() : validation.repoInfo.defaultBranch;

        // STEP 2: Fetch Git tree metadata
        const treeData = await fetchRepoTree(owner, repo, targetBranch, {
            subpath: subpath && subpath.trim() ? subpath.trim() : undefined,
            forceRefresh,
        });

        return res.status(200).json({
            success: true,
            repoInfo: validation.repoInfo,
            branch: targetBranch,
            treeSha: treeData.treeSha,
            isTruncated: treeData.isTruncated,
            totalItems: treeData.totalItems,
            tree: treeData.tree,
        });
    } catch (err) {
        const status = err.status || 500;
        const isRateLimit = err.isRateLimit || status === 403 || status === 429;
        return res.status(isRateLimit ? 429 : (status === 404 ? 404 : 500)).json({
            error: isRateLimit ? 'RATE_LIMIT' : 'TREE_FETCH_ERROR',
            message: err.userFacingMessage || err.message || 'Failed to fetch repository tree metadata',
        });
    }
}

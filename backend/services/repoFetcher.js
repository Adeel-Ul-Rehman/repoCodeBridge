import crypto from 'crypto';
import { Octokit } from '@octokit/rest';
import JSZip from 'jszip';
import { withRateLimitRetry, calculateBackoffDelay, sanitizeLog, deduplicateRequest, RateLimitExceededError } from './rateLimitHandler.js';

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
    userAgent: 'RepoCodeBridge v2.0.0',
});

export function getOctokit() {
    return octokit;
}

// Cache for repository data to avoid unnecessary re-fetches
const repoCache = new Map();
const treeCache = new Map();
const CACHE_TTL = 3600000; // 1 hour
const TREE_CACHE_TTL = 3600000; // 1 hour
const MAX_CACHE_ENTRIES = 100; // Maximum cached repositories to prevent uncontrolled memory growth

/**
 * Computes standard Git blob SHA-1 hash for a content buffer or string.
 * This matches GitHub's Git Trees API blob SHA exactly.
 */
export function computeGitBlobSha(content) {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const header = Buffer.from(`blob ${buf.length}\0`);
    return crypto.createHash('sha1').update(Buffer.concat([header, buf])).digest('hex');
}

// Directories that should always be excluded from AI conversion
const IGNORED_DIRECTORIES = new Set([
    'node_modules',
    '.git',
    '.github',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    'target',
    'bin',
    'obj',
    'vendor',
    '.venv',
    'venv',
    'env',
    '__pycache__',
    '.turbo',
    '.cache',
    '.idea',
    '.vscode',
    'coverage',
    '.nyc_output',
    'tmp',
    'temp',
    'Pods',
    '.svelte-kit',
    '.output',
]);

// Massive lockfiles and generated files that eat AI context without adding logic value
const IGNORED_FILENAMES = new Set([
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    'Cargo.lock',
    'Gemfile.lock',
    'poetry.lock',
    'bun.lockb',
    'flake.lock',
]);

// Binary / media extensions to skip
const BINARY_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp', '.tiff', '.psd', '.ai',
    '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.avi', '.mov', '.mkv', '.webm',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib', '.class', '.pyc',
    '.zip', '.tar', '.gz', '.bz2', '.xz', '.rar', '.7z', '.iso', '.dmg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.ttf', '.woff', '.woff2', '.eot', '.otf',
    '.map', '.min.js', '.min.css', '.bundle.js',
]);

const MAX_FILE_SIZE_BYTES = 300 * 1024; // 300 KB max per individual file

// Parse GitHub URL
export function parseGitHubUrl(url) {
    if (!url || typeof url !== 'string' || !url.trim()) {
        throw new Error('Invalid GitHub URL format. Please use https://github.com/owner/repository');
    }

    let urlObj;
    try {
        urlObj = new URL(url.trim());
    } catch {
        throw new Error('Invalid GitHub URL format. Please use https://github.com/owner/repository');
    }

    // Must use http or https protocol
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        throw new Error('Invalid protocol. GitHub repository URLs must use http:// or https://');
    }

    // Parsed hostname must be exactly github.com
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname !== 'github.com') {
        throw new Error('Invalid host. Only repository URLs from github.com are supported');
    }

    // Must not use unexpected custom ports
    if (urlObj.port && urlObj.port !== '80' && urlObj.port !== '443') {
        throw new Error('Invalid port. Please use standard HTTP/HTTPS ports');
    }

    // Path must contain exactly owner and repository
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) {
        throw new Error('Invalid GitHub URL path. Expected format: https://github.com/owner/repository');
    }

    const owner = parts[0].trim();
    let repo = parts[1].trim().replace(/\.git$/, '');

    if (!owner || !repo || repo === '.' || repo === '..') {
        throw new Error('Missing or invalid repository or owner segment');
    }

    const validOwner = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
    const validRepo = /^[a-zA-Z0-9_.-]{1,100}$/;

    if (!validOwner.test(owner) || !validRepo.test(repo)) {
        throw new Error('Repository URL contains invalid characters in username or repository name');
    }

    return {
        owner,
        repo,
        fullName: `${owner}/${repo}`,
    };
}

// Get repository information from GitHub API
export async function getRepoInfo(owner, repo) {
    const response = await withRateLimitRetry(
        () => octokit.rest.repos.get({ owner, repo }),
        { stage: 'GET_REPO_INFO' }
    );
    return {
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description || '',
        sizeKB: response.data.size,
        sizeMB: (response.data.size / 1024).toFixed(2),
        defaultBranch: response.data.default_branch || 'main',
        private: response.data.private,
        stars: response.data.stargazers_count,
        forks: response.data.forks_count,
        language: response.data.language,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
    };
}

// Validate repository before processing
export async function validateRepository(githubUrl) {
    if (!githubUrl || typeof githubUrl !== 'string' || !githubUrl.trim()) {
        return {
            valid: false,
            error: 'NO_URL',
            message: 'Please enter a GitHub repository URL.',
        };
    }

    let parsed;
    try {
        parsed = parseGitHubUrl(githubUrl);
    } catch (err) {
        return {
            valid: false,
            error: 'INVALID_URL',
            message: err.message || 'Please enter a valid GitHub URL (e.g. https://github.com/facebook/react).',
        };
    }

    try {
        const { owner, repo, fullName } = parsed;
        
        let repoData;
        try {
            const response = await withRateLimitRetry(
                () => octokit.rest.repos.get({ owner, repo }),
                { stage: 'VALIDATE_REPO', maxRetries: 1 }
            );
            repoData = response.data;
        } catch (err) {
            if (err.status === 404) {
                return {
                    valid: false,
                    error: 'REPO_NOT_FOUND',
                    message: `Repository "${fullName}" was not found or is private.`,
                };
            }
            if (err.status === 403) {
                return {
                    valid: false,
                    error: 'RATE_LIMIT',
                    message: 'GitHub API rate limit exceeded. Please wait a minute and try again.',
                };
            }
            return {
                valid: false,
                error: 'GITHUB_API_ERROR',
                message: `Unable to access repository: ${err.message}`,
            };
        }

        if (repoData.private) {
            return {
                valid: false,
                error: 'PRIVATE_REPO',
                message: '🔒 This repository is private. RepoCodeBridge currently supports public repositories.',
            };
        }

        if (repoData.size === 0) {
            return {
                valid: false,
                error: 'EMPTY_REPO',
                message: '📭 This repository is empty. There are no files to convert.',
            };
        }

        const sizeMB = repoData.size / 1024;
        if (sizeMB > 150) {
            return {
                valid: false,
                error: 'REPO_TOO_LARGE',
                message: `📦 Repository size (${sizeMB.toFixed(1)} MB) exceeds the 150 MB limit.`,
            };
        }

        return {
            valid: true,
            error: null,
            message: null,
            repoInfo: {
                name: repoData.name,
                fullName: repoData.full_name,
                description: repoData.description || '',
                sizeKB: repoData.size,
                sizeMB: sizeMB,
                defaultBranch: repoData.default_branch || 'main',
                private: repoData.private,
                stars: repoData.stargazers_count,
                forks: repoData.forks_count,
                language: repoData.language,
            },
        };
    } catch (err) {
        return {
            valid: false,
            error: 'INVALID_URL_FORMAT',
            message: err.message,
        };
    }
}

// Check if file path should be included in the AI codebase output
export function isPathIncludable(filepath, options = {}) {
    const normalized = filepath.replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = normalized.split('/');
    const filename = segments[segments.length - 1];

    // Selective repository conversion filtering
    if (options.selectedPaths && Array.isArray(options.selectedPaths) && options.selectedPaths.length > 0) {
        const isSelected = options.selectedPaths.some(p => {
            if (!p || typeof p !== 'string') return false;
            const cleanP = p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
            return normalized === cleanP || normalized.startsWith(cleanP + '/');
        });
        if (!isSelected) {
            return false;
        }
    }

    // Monorepo subfolder filtering (e.g. packages/client or backend)
    if (options.subpath && options.subpath.trim()) {
        const cleanSubpath = options.subpath.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
        if (!normalized.startsWith(cleanSubpath + '/') && normalized !== cleanSubpath) {
            return false;
        }
    }

    // Exclude test suites if requested
    if (options.excludeTests) {
        if (/(\btest\b|\btests\b|__tests__|cypress|playwright|\.test\.|\.spec\.)/i.test(normalized)) {
            return false;
        }
    }

    // Exclude documentation assets if requested (keeps root README.md)
    if (options.excludeDocs) {
        if (filename.toLowerCase() !== 'readme.md' && (/(\bdocs\b|\bdocumentation\b)/i.test(normalized) || /\.(md|mdx|rst)$/i.test(filename))) {
            return false;
        }
    }

    // Check directory exclusions
    for (let i = 0; i < segments.length - 1; i++) {
        if (IGNORED_DIRECTORIES.has(segments[i])) {
            return false;
        }
    }

    // Check filename exclusions
    if (IGNORED_FILENAMES.has(filename)) {
        return false;
    }

    // Check extensions
    const lowerFilename = filename.toLowerCase();
    for (const ext of BINARY_EXTENSIONS) {
        if (lowerFilename.endsWith(ext)) {
            return false;
        }
    }

    return true;
}

/**
 * Validates client-provided selected paths against repository safety rules
 * and the actual fetched repository tree.
 */
export function validateSelectedPaths(selectedPaths, validTreePaths = null) {
    if (!selectedPaths) return [];
    if (!Array.isArray(selectedPaths)) {
        throw new Error('selectedPaths must be an array of paths');
    }
    const validated = [];
    const validSet = validTreePaths ? (validTreePaths instanceof Set ? validTreePaths : new Set(validTreePaths)) : null;

    for (const raw of selectedPaths) {
        if (typeof raw !== 'string') continue;
        const normalized = raw.replace(/\\/g, '/').trim();
        if (!normalized) continue;

        // Security check: prohibit directory traversal and absolute paths
        if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.includes('..') || normalized.includes('\0')) {
            throw new Error(`Invalid path: "${raw}" contains forbidden directory traversal or absolute path.`);
        }

        const clean = normalized.replace(/^\/+/, '').replace(/\/+$/, '');
        
        // If repository tree paths are provided for verification
        if (validSet && validSet.size > 0) {
            let exists = validSet.has(clean);
            if (!exists) {
                // Check if it's a directory containing files in the tree
                for (const item of validSet) {
                    if (item.startsWith(clean + '/')) {
                        exists = true;
                        break;
                    }
                }
            }
            if (!exists) {
                throw new Error(`Invalid path: "${clean}" does not exist in the repository tree.`);
            }
        }

        validated.push(clean);
    }

    return validated;
}


/**
 * High-Speed Repository Fetching via GitHub Zipball Stream
 * Downloads and parses repository in 1-2 seconds with zero rate limit consumption.
 */
async function fetchViaZipball(owner, repo, branch, options = {}) {
    const candidateUrls = [
        `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`,
        `https://codeload.github.com/${owner}/${repo}/zip/refs/tags/${branch}`,
        `https://codeload.github.com/${owner}/${repo}/zip/${branch}`,
    ];
    
    const headers = {
        'User-Agent': 'RepoCodeBridge v2.0.0',
    };
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    let response = null;
    let successfulUrl = null;

    for (const url of candidateUrls) {
        try {
            let res = await fetch(url, { headers });
            if (res.status === 403 || res.status === 429) {
                const backoff = calculateBackoffDelay(res.headers, 0, 15000);
                if (backoff.shouldRetry) {
                    console.log(sanitizeLog(`[RepoFetcher:Zipball] Rate limit encountered (${res.status}). Waiting ${backoff.waitMs}ms before candidate retry...`));
                    await new Promise(r => setTimeout(r, backoff.waitMs));
                    res = await fetch(url, { headers });
                }
            }
            if (res.ok) {
                response = res;
                successfulUrl = url;
                break;
            }
        } catch (e) {
            // Try next candidate URL
        }
    }

    if (!response || !response.ok) {
        throw new Error(`Zipball download failed for branch/tag "${branch}"`);
    }

    console.log(sanitizeLog(`[RepoFetcher] Streaming zipball from: ${successfulUrl}`));
    const arrayBuffer = await response.arrayBuffer();
    
    // Bound archive download size (150 MB)
    const MAX_ZIPBALL_SIZE = 150 * 1024 * 1024;
    if (arrayBuffer.byteLength > MAX_ZIPBALL_SIZE) {
        throw new Error('Repository archive size exceeds maximum limit of 150 MB');
    }

    const zip = await JSZip.loadAsync(arrayBuffer);
    
    const files = [];
    const entries = Object.keys(zip.files);
    if (entries.length === 0) {
        throw new Error('Empty zip archive returned from GitHub');
    }

    const rootPrefix = entries[0].split('/')[0] + '/';
    const MAX_EXTRACTED_FILES = 5000;
    const MAX_TOTAL_DECOMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB decompressed code limit
    let totalExtractedBytes = 0;

    for (const [entryPath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        if (files.length >= MAX_EXTRACTED_FILES || totalExtractedBytes >= MAX_TOTAL_DECOMPRESSED_BYTES) {
            console.warn(`[RepoFetcher] Hit archive safety bounds (files: ${files.length}, bytes: ${totalExtractedBytes}). Stopping extraction.`);
            break;
        }

        // Strip the root prefix folder
        let relativePath = entryPath;
        if (relativePath.startsWith(rootPrefix)) {
            relativePath = relativePath.slice(rootPrefix.length);
        }
        if (!relativePath) continue;

        if (!isPathIncludable(relativePath, options)) {
            continue;
        }

        try {
            let content = await zipEntry.async('text');
            
            // Skip binary content that contains null bytes
            if (content.slice(0, 8192).includes('\0')) {
                continue;
            }

            let isTruncated = false;

            if (content.length > MAX_FILE_SIZE_BYTES) {
                content = content.slice(0, MAX_FILE_SIZE_BYTES) + 
                    `\n\n// [... Content truncated: File size exceeded ${Math.round(MAX_FILE_SIZE_BYTES / 1024)} KB limit for AI context ...]`;
                isTruncated = true;
            }

            totalExtractedBytes += content.length;

            files.push({
                path: relativePath,
                name: relativePath.split('/').pop(),
                size: zipEntry._data?.uncompressedSize || content.length,
                sha: computeGitBlobSha(content),
                content: content,
                isTruncated,
            });
        } catch (readErr) {
            console.warn(`Could not read text for ${relativePath}:`, readErr.message);
        }
    }

    return files;
}

/**
 * Fallback Fetching using Git Trees API (Single recursive tree call)
 */
async function fetchViaGitTree(owner, repo, branch, options = {}) {
    console.log(sanitizeLog(`[RepoFetcher] Using Git Trees API fallback for ${owner}/${repo}@${branch}`));
    
    const treeRes = await withRateLimitRetry(
        () => octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: branch,
            recursive: 'true',
        }),
        { stage: 'GET_GIT_TREE' }
    );

    if (!treeRes.data || !treeRes.data.tree) {
        throw new Error('Failed to retrieve git tree');
    }

    let candidateFiles = treeRes.data.tree.filter(item => 
        item.type === 'blob' && isPathIncludable(item.path, options)
    );

    const MAX_CANDIDATE_FILES = 5000;
    if (candidateFiles.length > MAX_CANDIDATE_FILES) {
        console.warn(sanitizeLog(`[RepoFetcher] Capping candidate files at ${MAX_CANDIDATE_FILES} (found ${candidateFiles.length})`));
        candidateFiles = candidateFiles.slice(0, MAX_CANDIDATE_FILES);
    }

    console.log(sanitizeLog(`   Found ${candidateFiles.length} candidate files after filtering`));

    // Fetch files in concurrency batches of 10
    const files = [];
    const batchSize = 10;

    for (let i = 0; i < candidateFiles.length; i += batchSize) {
        const batch = candidateFiles.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(async (fileItem) => {
                try {
                    const blobRes = await withRateLimitRetry(
                        () => octokit.rest.git.getBlob({
                            owner,
                            repo,
                            file_sha: fileItem.sha,
                        }),
                        { stage: 'GET_BLOB', maxRetries: 2, maxWaitMs: 10000 }
                    );
                    let content = Buffer.from(blobRes.data.content, 'base64').toString('utf-8');
                    
                    // Skip binary content that contains null bytes
                    if (content.slice(0, 8192).includes('\0')) {
                        return null;
                    }

                    let isTruncated = false;
                    if (content.length > MAX_FILE_SIZE_BYTES) {
                        content = content.slice(0, MAX_FILE_SIZE_BYTES) + 
                            `\n\n// [... Content truncated: File exceeded ${Math.round(MAX_FILE_SIZE_BYTES / 1024)} KB limit ...]`;
                        isTruncated = true;
                    }
                    return {
                        path: fileItem.path,
                        name: fileItem.path.split('/').pop(),
                        size: fileItem.size || content.length,
                        sha: fileItem.sha,
                        content,
                        isTruncated,
                    };
                } catch (err) {
                    console.warn(sanitizeLog(`Failed to fetch blob for ${fileItem.path}: ${err.message}`));
                    return null;
                }
            })
        );

        for (const res of results) {
            if (res) files.push(res);
        }
    }

    return files;
}

/**
 * Fetches an individual file blob via GitHub Git Data API with rate-limit handling and size caps
 */
export async function fetchSingleFileBlob(owner, repo, fileSha, filePath) {
    const blobRes = await withRateLimitRetry(
        () => octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: fileSha,
        }),
        { stage: 'GET_BLOB', maxRetries: 2, maxWaitMs: 10000 }
    );
    let content = Buffer.from(blobRes.data.content, 'base64').toString('utf-8');
    
    // Skip binary content that contains null bytes
    if (content.slice(0, 8192).includes('\0')) {
        return null;
    }

    let isTruncated = false;
    if (content.length > MAX_FILE_SIZE_BYTES) {
        content = content.slice(0, MAX_FILE_SIZE_BYTES) + 
            `\n\n// [... Content truncated: File exceeded ${Math.round(MAX_FILE_SIZE_BYTES / 1024)} KB limit ...]`;
        isTruncated = true;
    }

    return {
        path: filePath,
        name: filePath.split('/').pop(),
        size: content.length,
        sha: fileSha,
        content,
        isTruncated,
    };
}

/**
 * Main Repository Fetcher with Caching and Automatic Fallback
 */
export async function fetchRepository(githubUrl, options = {}, forceRefresh = false) {
    const cleanUrl = githubUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
    const optionsKey = JSON.stringify(options);
    const cacheKey = `${cleanUrl}::${optionsKey}`;

    if (!forceRefresh && repoCache.has(cacheKey)) {
        const cached = repoCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[RepoFetcher] Serving cached repository data: ${cleanUrl}`);
            return cached.data;
        }
        repoCache.delete(cacheKey);
    }

    const { owner, repo, fullName } = parseGitHubUrl(cleanUrl);
    console.log(`[RepoFetcher] Starting high-speed fetch for ${fullName}`);

    const repoInfo = await getRepoInfo(owner, repo);
    const branch = options.branch && options.branch.trim() ? options.branch.trim() : repoInfo.defaultBranch;

    let files = [];
    try {
        files = await fetchViaZipball(owner, repo, branch, options);
        console.log(`[RepoFetcher] Zipball fetch successful: extracted ${files.length} code files`);
    } catch (zipError) {
        console.warn(`[RepoFetcher] Zipball download failed (${zipError.message}), attempting Git Trees fallback...`);
        files = await fetchViaGitTree(owner, repo, branch, options);
        console.log(`[RepoFetcher] Git Trees fetch successful: extracted ${files.length} code files`);
    }

    let totalSize = 0;
    let totalChars = 0;
    files.forEach(f => {
        totalSize += f.size || 0;
        totalChars += f.content ? f.content.length : 0;
    });

    const result = {
        repoInfo: {
            name: repoInfo.name,
            fullName: repoInfo.fullName,
            description: repoInfo.description,
            defaultBranch: repoInfo.defaultBranch,
            activeBranch: branch,
            subpath: options.subpath || null,
            totalFiles: files.length,
            totalSizeKB: Math.round(totalSize / 1024),
            totalChars: totalChars,
            estimatedTokens: Math.round(totalChars / 4),
            stars: repoInfo.stars,
            forks: repoInfo.forks,
            language: repoInfo.language,
        },
        files: files,
        fetchedAt: new Date().toISOString(),
    };

    // Bound cache memory: evict oldest entry if size limit reached
    if (repoCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = repoCache.keys().next().value;
        if (oldestKey) repoCache.delete(oldestKey);
    }

    repoCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
    });

    return result;
}

// Invalidate cache for a specific repository rather than flushing everyone's cache
export function invalidateRepoCache(githubUrl) {
    if (!githubUrl || typeof githubUrl !== 'string') return;
    try {
        const cleanUrl = githubUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
        const prefix = `${cleanUrl}::`;
        for (const key of repoCache.keys()) {
            if (key.startsWith(prefix) || key === cleanUrl) {
                repoCache.delete(key);
            }
        }
        for (const key of treeCache.keys()) {
            if (key.startsWith(cleanUrl) || cleanUrl.includes(key.split('@')[0])) {
                treeCache.delete(key);
            }
        }
        console.log(`[RepoFetcher] Targeted cache invalidation for: ${cleanUrl}`);
    } catch {
        // Safe fallback
    }
}

export function clearRepoCache() {
    repoCache.clear();
    treeCache.clear();
    console.log('🗑️ Repository and tree cache cleared');
}

/**
 * Fetch repository tree metadata before downloading source contents.
 * Includes Git Trees API fallback for truncated responses and memory caching.
 */
export async function fetchRepoTree(owner, repo, branch = 'main', options = {}) {
    const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}@${branch}`;
    
    return deduplicateRequest(`tree::${cacheKey}`, async () => {
        if (!options.forceRefresh && treeCache.has(cacheKey)) {
            const cached = treeCache.get(cacheKey);
            if (Date.now() - cached.timestamp < TREE_CACHE_TTL) {
                console.log(`[RepoFetcher] Serving cached tree for ${cacheKey}`);
                return cached.data;
            }
            treeCache.delete(cacheKey);
        }

        let targetBranch = branch || 'main';
        console.log(sanitizeLog(`[RepoFetcher] Fetching Git tree for ${owner}/${repo}@${targetBranch}`));
        
        let treeRes;
        try {
            treeRes = await withRateLimitRetry(
                () => octokit.rest.git.getTree({
                    owner,
                    repo,
                    tree_sha: targetBranch,
                    recursive: 'true',
                }),
                { stage: 'FETCH_TREE', maxRetries: 2 }
            );
        } catch (treeErr) {
            // If branch name fails with 404/409, try resolving commit SHA or fallback to repo default branch
            if (treeErr.status === 404 || treeErr.status === 409) {
                let branchRes = null;
                try {
                    branchRes = await withRateLimitRetry(
                        () => octokit.rest.repos.getBranch({ owner, repo, branch: targetBranch }),
                        { stage: 'GET_BRANCH', maxRetries: 1 }
                    );
                } catch (bErr) {
                    if (bErr.status === 404) {
                        // The requested/defaulted branch does not exist on this repository.
                        // Query GitHub for the repository's actual default branch (e.g. master instead of main)
                        const repoMeta = await withRateLimitRetry(
                            () => octokit.rest.repos.get({ owner, repo }),
                            { stage: 'GET_REPO_DEFAULT_BRANCH', maxRetries: 1 }
                        );
                        const fallbackBranch = repoMeta.data?.default_branch || 'master';
                        console.log(sanitizeLog(`[RepoFetcher] Branch "${targetBranch}" not found for ${owner}/${repo}. Falling back to default branch "${fallbackBranch}".`));
                        targetBranch = fallbackBranch;
                        branchRes = await withRateLimitRetry(
                            () => octokit.rest.repos.getBranch({ owner, repo, branch: fallbackBranch }),
                            { stage: 'GET_DEFAULT_BRANCH', maxRetries: 1 }
                        );
                    } else {
                        throw bErr;
                    }
                }

                const commitSha = branchRes.data.commit.sha;
                treeRes = await withRateLimitRetry(
                    () => octokit.rest.git.getTree({
                        owner,
                        repo,
                        tree_sha: commitSha,
                        recursive: 'true',
                    }),
                    { stage: 'FETCH_TREE_RECURSIVE', maxRetries: 2 }
                );
            } else {
                throw treeErr;
            }
        }

        let rawTree = treeRes.data?.tree || [];
        const isTruncated = Boolean(treeRes.data?.truncated);

        // Bounded fallback: if tree is truncated by GitHub API (>100k objects or 7MB)
        if (isTruncated) {
            console.warn(sanitizeLog(`[RepoFetcher] Git Trees API returned truncated tree for ${owner}/${repo}. Running bounded fallback...`));
            const subtrees = rawTree.filter(t => t.type === 'tree').slice(0, 25);
            for (const sub of subtrees) {
                try {
                    const subRes = await withRateLimitRetry(
                        () => octokit.rest.git.getTree({
                            owner,
                            repo,
                            tree_sha: sub.sha,
                            recursive: 'true',
                        }),
                        { stage: 'FETCH_SUBTREE', maxRetries: 1, maxWaitMs: 5000 }
                    );
                    if (subRes.data?.tree) {
                        for (const child of subRes.data.tree) {
                            rawTree.push({
                                ...child,
                                path: `${sub.path}/${child.path}`,
                            });
                        }
                    }
                } catch {
                    // Non-fatal fallback continuation
                }
            }
        }

        // Format and annotate tree items
        const formattedItems = [];
        const seenPaths = new Set();

        for (const item of rawTree) {
            if (!item.path || seenPaths.has(item.path)) continue;
            seenPaths.add(item.path);

            const isDir = item.type === 'tree';
            const includable = isDir ? true : isPathIncludable(item.path, options);

            formattedItems.push({
                path: item.path,
                name: item.path.split('/').pop(),
                type: isDir ? 'tree' : 'blob',
                size: item.size || 0,
                sha: item.sha,
                isIncludable: includable,
            });
        }

        // Sort deterministically: alphabetical by path
        formattedItems.sort((a, b) => a.path.localeCompare(b.path));

        const result = {
            owner,
            repo,
            branch,
            treeSha: treeRes.data?.sha,
            isTruncated,
            totalItems: formattedItems.length,
            tree: formattedItems,
            fetchedAt: new Date().toISOString(),
        };

        treeCache.set(cacheKey, {
            data: result,
            timestamp: Date.now(),
        });

        return result;
    });
}

/**
 * Computes difference between previous stored snapshot and latest tree.
 * Determines added, modified, unchanged, and deleted files using Git blob SHAs.
 */
export function computeTreeDiff(oldSnapshotInput = [], newTreeFiles = [], selectedPaths = null) {
    const oldSnapshotFiles = Array.isArray(oldSnapshotInput) 
        ? oldSnapshotInput 
        : (oldSnapshotInput && Array.isArray(oldSnapshotInput.files) ? oldSnapshotInput.files : []);

    const oldMap = new Map();
    for (const file of oldSnapshotFiles) {
        if (file && file.path) {
            oldMap.set(file.path, file);
        }
    }

    const newMap = new Map();
    for (const item of newTreeFiles) {
        const isBlob = item.type ? item.type === 'blob' : true;
        const isIncludable = item.isIncludable !== undefined ? item.isIncludable : true;
        if (isBlob && isIncludable) {
            if (selectedPaths && selectedPaths.length > 0) {
                const isSelected = selectedPaths.some(p => {
                    const cleanP = p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
                    return item.path === cleanP || item.path.startsWith(cleanP + '/');
                });
                if (!isSelected) continue;
            }
            newMap.set(item.path, item);
        }
    }

    const added = [];
    const modified = [];
    const unchanged = [];
    const deleted = [];

    // Check each file in the new candidate tree
    for (const [path, newItem] of newMap.entries()) {
        if (!oldMap.has(path)) {
            added.push(newItem);
        } else {
            const oldFile = oldMap.get(path);
            if (oldFile.sha && newItem.sha && oldFile.sha === newItem.sha) {
                unchanged.push({
                    ...newItem,
                    content: oldFile.content,
                    isTruncated: oldFile.isTruncated || false,
                });
            } else {
                modified.push(newItem);
            }
        }
    }

    // Check files in the old snapshot that are no longer in new candidate map
    for (const [path] of oldMap.entries()) {
        if (!newMap.has(path)) {
            deleted.push(path);
        }
    }

    const isUpToDate = added.length === 0 && modified.length === 0 && deleted.length === 0;

    return {
        added,
        modified,
        unchanged,
        deleted,
        isUpToDate,
    };
}
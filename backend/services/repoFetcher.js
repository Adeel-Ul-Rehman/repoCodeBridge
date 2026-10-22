// backend/services/repoFetcher.js
import { Octokit } from '@octokit/rest';
import JSZip from 'jszip';

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
    userAgent: 'RepoCodeBridge v2.0.0',
});

// Cache for repository data to avoid unnecessary re-fetches
const repoCache = new Map();
const CACHE_TTL = 3600000; // 1 hour
const MAX_CACHE_ENTRIES = 100; // Maximum cached repositories to prevent uncontrolled memory growth

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
    const response = await octokit.rest.repos.get({ owner, repo });
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
            const response = await octokit.rest.repos.get({ owner, repo });
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
            const res = await fetch(url, { headers });
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

    console.log(`[RepoFetcher] Streaming zipball from: ${successfulUrl}`);
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
    console.log(`[RepoFetcher] Using Git Trees API fallback for ${owner}/${repo}@${branch}`);
    
    const treeRes = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: 'true',
    });

    if (!treeRes.data || !treeRes.data.tree) {
        throw new Error('Failed to retrieve git tree');
    }

    let candidateFiles = treeRes.data.tree.filter(item => 
        item.type === 'blob' && isPathIncludable(item.path, options)
    );

    const MAX_CANDIDATE_FILES = 5000;
    if (candidateFiles.length > MAX_CANDIDATE_FILES) {
        console.warn(`[RepoFetcher] Capping candidate files at ${MAX_CANDIDATE_FILES} (found ${candidateFiles.length})`);
        candidateFiles = candidateFiles.slice(0, MAX_CANDIDATE_FILES);
    }

    console.log(`   Found ${candidateFiles.length} candidate files after filtering`);

    // Fetch files in concurrency batches of 10
    const files = [];
    const batchSize = 10;

    for (let i = 0; i < candidateFiles.length; i += batchSize) {
        const batch = candidateFiles.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(async (fileItem) => {
                try {
                    const blobRes = await octokit.rest.git.getBlob({
                        owner,
                        repo,
                        file_sha: fileItem.sha,
                    });
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
                        content,
                        isTruncated,
                    };
                } catch (err) {
                    console.warn(`Failed to fetch blob for ${fileItem.path}:`, err.message);
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
        console.log(`[RepoFetcher] Targeted cache invalidation for: ${cleanUrl}`);
    } catch {
        // Safe fallback
    }
}

export function clearRepoCache() {
    repoCache.clear();
    console.log('🗑️ Repository cache cleared');
}
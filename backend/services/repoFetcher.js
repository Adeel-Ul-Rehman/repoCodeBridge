// backend/services/repoFetcher.js
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined,
    userAgent: 'RepoCodeBridge v1.0.0',
});

// Cache for repository data to avoid rate limits
const repoCache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// Parse GitHub URL
export function parseGitHubUrl(url) {
    try {
        let cleanUrl = url.replace(/\.git$/, '').replace(/\/$/, '');
        const urlObj = new URL(cleanUrl);
        const parts = urlObj.pathname.split('/').filter(p => p);
        
        if (parts.length >= 2) {
            return {
                owner: parts[0],
                repo: parts[1],
                fullName: `${parts[0]}/${parts[1]}`
            };
        }
        throw new Error('Invalid GitHub URL');
    } catch (err) {
        throw new Error('Invalid GitHub URL format');
    }
}

// Get repository information
export async function getRepoInfo(owner, repo) {
    const response = await octokit.rest.repos.get({
        owner,
        repo,
    });
    
    return {
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description,
        size: response.data.size,
        defaultBranch: response.data.default_branch,
        private: response.data.private,
        stars: response.data.stargazers_count,
        forks: response.data.forks_count,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
    };
}

// Validate repository before processing
export async function validateRepository(githubUrl) {
    console.log(`🔍 Validating repository: ${githubUrl}`);
    
    if (!githubUrl || !githubUrl.trim()) {
        return {
            valid: false,
            error: 'NO_URL',
            message: 'Please enter a repository URL'
        };
    }
    
    if (!githubUrl.includes('github.com')) {
        return {
            valid: false,
            error: 'INVALID_URL',
            message: 'Please enter a valid GitHub repository URL (e.g., https://github.com/username/repo)'
        };
    }
    
    try {
        let cleanUrl = githubUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
        let urlParts;
        
        try {
            const urlObj = new URL(cleanUrl);
            urlParts = urlObj.pathname.split('/').filter(p => p);
        } catch (err) {
            return {
                valid: false,
                error: 'INVALID_URL_FORMAT',
                message: 'Invalid URL format. Please use format: https://github.com/username/repo'
            };
        }
        
        if (urlParts.length < 2) {
            return {
                valid: false,
                error: 'INVALID_REPO_PATH',
                message: 'Invalid repository path. Please include both owner and repository name.'
            };
        }
        
        const owner = urlParts[0];
        const repo = urlParts[1];
        
        let repoInfo;
        try {
            const response = await octokit.rest.repos.get({ owner, repo });
            repoInfo = response.data;
        } catch (err) {
            if (err.status === 404) {
                return {
                    valid: false,
                    error: 'REPO_NOT_FOUND',
                    message: `Repository "${owner}/${repo}" does not exist. Please check the URL and try again.`
                };
            }
            if (err.status === 403) {
                return {
                    valid: false,
                    error: 'RATE_LIMIT',
                    message: 'GitHub API rate limit exceeded. Please try again in a few minutes.'
                };
            }
            return {
                valid: false,
                error: 'GITHUB_API_ERROR',
                message: `Unable to access repository: ${err.message}`
            };
        }
        
        // Check if private
        if (repoInfo.private) {
            return {
                valid: false,
                error: 'PRIVATE_REPO',
                message: '🔒 This is a private repository. Only public repositories are supported.'
            };
        }
        
        // Check if empty
        if (repoInfo.size === 0) {
            return {
                valid: false,
                error: 'EMPTY_REPO',
                message: '📭 This repository appears to be empty. No code files to process.'
            };
        }
        
        const sizeMB = repoInfo.size / 1024;
        
        return {
            valid: true,
            error: null,
            message: null,
            repoInfo: {
                name: repoInfo.name,
                fullName: repoInfo.full_name,
                description: repoInfo.description,
                sizeKB: repoInfo.size,
                sizeMB: sizeMB,
                defaultBranch: repoInfo.default_branch,
                private: repoInfo.private,
                stars: repoInfo.stargazers_count,
                forks: repoInfo.forks_count,
            }
        };
        
    } catch (err) {
        console.error('Validation error:', err);
        return {
            valid: false,
            error: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred. Please try again.'
        };
    }
}

// Check if file should be included (skip binaries)
function isIncludableFile(filename) {
    const binaryExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp',
        '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
        '.exe', '.dll', '.so', '.dylib', '.bin',
        '.zip', '.tar', '.gz', '.rar', '.7z',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.ico', '.svg', '.ttf', '.woff', '.woff2', '.eot',
        '.psd', '.ai', '.eps', '.indd'
    ];
    
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return !binaryExtensions.includes(ext);
}

// Get file content
export async function getFileContent(owner, repo, path, branch) {
    try {
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
            ref: branch,
        });
        
        if (response.data.content) {
            const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            return content;
        }
        return null;
    } catch (err) {
        console.error(`Error fetching ${path}:`, err.message);
        return null;
    }
}

// Get all files recursively
export async function getAllFiles(owner, repo, path = '', branch = 'main') {
    let allFiles = [];
    
    try {
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
            ref: branch,
        });
        
        if (!Array.isArray(response.data)) {
            if (isIncludableFile(response.data.name)) {
                const content = await getFileContent(owner, repo, response.data.path, branch);
                allFiles.push({
                    path: response.data.path,
                    name: response.data.name,
                    type: 'file',
                    size: response.data.size,
                    content: content,
                });
            }
            return allFiles;
        }
        
        for (const item of response.data) {
            if (item.type === 'file' && isIncludableFile(item.name)) {
                try {
                    const content = await getFileContent(owner, repo, item.path, branch);
                    allFiles.push({
                        path: item.path,
                        name: item.name,
                        type: 'file',
                        size: item.size,
                        content: content,
                    });
                } catch (err) {
                    console.warn(`Failed to get content for ${item.path}:`, err.message);
                }
            } else if (item.type === 'dir') {
                const subFiles = await getAllFiles(owner, repo, item.path, branch);
                allFiles.push(...subFiles);
            }
        }
    } catch (err) {
        console.error(`Error fetching files from ${path}:`, err.message);
    }
    
    return allFiles;
}

// Main fetch function with caching
export async function fetchRepository(githubUrl, forceRefresh = false) {
    const cacheKey = githubUrl;
    
    // Check cache first
    if (!forceRefresh && repoCache.has(cacheKey)) {
        const cached = repoCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`📦 Using cached data for: ${githubUrl}`);
            return cached.data;
        }
        repoCache.delete(cacheKey);
    }
    
    console.log(`📦 Fetching repository: ${githubUrl}`);
    
    const { owner, repo, fullName } = parseGitHubUrl(githubUrl);
    console.log(`   Owner: ${owner}, Repo: ${repo}`);
    
    const repoInfo = await getRepoInfo(owner, repo);
    console.log(`   Default branch: ${repoInfo.defaultBranch}`);
    console.log(`   Size: ${repoInfo.size} KB`);
    
    if (repoInfo.private) {
        throw new Error('Private repositories are not supported yet');
    }
    
    const files = await getAllFiles(owner, repo, '', repoInfo.defaultBranch);
    console.log(`   Total files found: ${files.length}`);
    
    let totalSize = 0;
    let totalChars = 0;
    files.forEach(file => {
        totalSize += file.size || 0;
        totalChars += file.content ? file.content.length : 0;
    });
    
    const result = {
        repoInfo: {
            name: repoInfo.name,
            fullName: repoInfo.fullName,
            description: repoInfo.description,
            defaultBranch: repoInfo.defaultBranch,
            totalFiles: files.length,
            totalSizeKB: totalSize,
            totalChars: totalChars,
            stars: repoInfo.stars,
            forks: repoInfo.forks,
        },
        files: files,
        fetchedAt: new Date().toISOString(),
    };
    
    // Store in cache
    repoCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
    });
    
    return result;
}

// Clear cache (useful when needed)
export function clearRepoCache() {
    repoCache.clear();
    console.log('🗑️ Repository cache cleared');
}
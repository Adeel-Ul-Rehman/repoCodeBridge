// backend/services/codeFormatter.js

// Comprehensive mapping of file extensions to markdown language specifiers
const LANGUAGE_MAP = {
    // JavaScript / TypeScript
    'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
    'jsx': 'jsx', 'ts': 'typescript', 'tsx': 'tsx',
    
    // Python
    'py': 'python', 'pyw': 'python',
    
    // Systems & Compiled
    'go': 'go',
    'rs': 'rust',
    'c': 'c', 'h': 'c',
    'cpp': 'cpp', 'hpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp',
    'cs': 'csharp',
    'java': 'java',
    'kt': 'kotlin', 'kts': 'kotlin',
    'swift': 'swift',
    'scala': 'scala',
    'zig': 'zig',
    
    // Scripting & Web
    'php': 'php',
    'rb': 'ruby',
    'lua': 'lua',
    'r': 'r',
    'sh': 'bash', 'bash': 'bash', 'zsh': 'bash',
    'sql': 'sql',
    'html': 'html', 'htm': 'html',
    'css': 'css', 'scss': 'scss', 'sass': 'sass', 'less': 'less',
    'vue': 'vue', 'svelte': 'svelte', 'astro': 'astro',
    
    // Data & Config
    'json': 'json',
    'json5': 'json',
    'yaml': 'yaml', 'yml': 'yaml',
    'toml': 'toml',
    'xml': 'xml',
    'md': 'markdown', 'mdx': 'markdown',
    'txt': 'text',
    'env': 'properties',
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
};

// Priority files to present first so AI grasps repo architecture and dependencies upfront
const PRIORITY_MANIFESTS = [
    'README.md',
    'readme.md',
    'package.json',
    'Cargo.toml',
    'requirements.txt',
    'pyproject.toml',
    'setup.py',
    'go.mod',
    'pom.xml',
    'build.gradle',
    'Gemfile',
    'composer.json',
    'tsconfig.json',
];

export function getLanguageFromPath(filepath) {
    const filename = filepath.split('/').pop().toLowerCase();
    if (filename === 'dockerfile' || filename.startsWith('dockerfile.')) return 'dockerfile';
    if (filename === 'makefile') return 'makefile';
    if (filename === '.env.example' || filename === '.env') return 'properties';

    const ext = filename.substring(filename.lastIndexOf('.') + 1);
    return LANGUAGE_MAP[ext] || 'plaintext';
}

// Generate ASCII directory structure tree
export function generateDirectoryTree(files) {
    const tree = {};

    for (const file of files) {
        const parts = file.path.split('/');
        let current = tree;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = null; // file
            } else {
                if (!current[part]) current[part] = {};
                current = current[part];
            }
        }
    }

    function renderNode(node, prefix = '') {
        let result = '';
        const keys = Object.keys(node).sort((a, b) => {
            const aIsDir = node[a] !== null;
            const bIsDir = node[b] !== null;
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
        });

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const isLast = i === keys.length - 1;
            const isDir = node[key] !== null;

            result += prefix;
            result += isLast ? '└── ' : '├── ';
            result += key;
            if (isDir) result += '/';
            result += '\n';

            if (isDir) {
                const childPrefix = prefix + (isLast ? '    ' : '│   ');
                result += renderNode(node[key], childPrefix);
            }
        }
        return result;
    }

    return '```text\n' + renderNode(tree) + '```';
}

// Format entire repository into clean, high-density AI-readable Markdown
export function formatToMarkdown(repoData) {
    const { repoInfo, files, fetchedAt } = repoData;

    const totalLines = files.reduce((acc, f) => acc + (f.content ? f.content.split('\n').length : 0), 0);
    const estTokens = repoInfo.estimatedTokens || Math.round((repoInfo.totalChars || 0) / 4);

    let md = '';

    // 1. Header with Repository Metadata
    md += `# Repository: ${repoInfo.fullName}\n\n`;
    md += `> **RepoCodeBridge AI Codebase Dump**\n`;
    md += `> This single document contains the complete source code and directory hierarchy of \`${repoInfo.fullName}\`.\n`;
    md += `> It is formatted specifically for direct ingestion and reasoning by AI models (ChatGPT, Claude, Gemini, DeepSeek, Cursor, Copilot).\n\n`;

    md += `## 📊 Repository Summary\n`;
    md += `- **Repository URL:** https://github.com/${repoInfo.fullName}\n`;
    if (repoInfo.description) {
        md += `- **Description:** ${repoInfo.description}\n`;
    }
    md += `- **Default Branch:** \`${repoInfo.defaultBranch}\`\n`;
    md += `- **Total Files:** ${repoInfo.totalFiles}\n`;
    md += `- **Total Code Lines:** ~${totalLines.toLocaleString()}\n`;
    md += `- **Total Characters:** ${(repoInfo.totalChars || 0).toLocaleString()}\n`;
    md += `- **Estimated AI Tokens:** ~${estTokens.toLocaleString()}\n`;
    md += `- **Stars:** ⭐ ${repoInfo.stars || 0} | **Forks:** 🍴 ${repoInfo.forks || 0}\n`;
    md += `- **Fetched Date:** ${fetchedAt}\n\n`;

    md += `---\n\n`;

    // 2. Directory Hierarchy Tree
    md += `## 📁 Directory Structure\n\n`;
    md += generateDirectoryTree(files);
    md += `\n\n---\n\n`;

    // 3. Separate priority manifest files (README, package.json, etc.) from other files
    const priorityFiles = [];
    const regularFiles = [];

    for (const file of files) {
        const base = file.path.split('/').pop();
        if (PRIORITY_MANIFESTS.includes(base) || file.path.toLowerCase() === 'readme.md') {
            priorityFiles.push(file);
        } else {
            regularFiles.push(file);
        }
    }

    // Sort regular files alphabetically by path
    regularFiles.sort((a, b) => a.path.localeCompare(b.path));
    priorityFiles.sort((a, b) => {
        const aIndex = PRIORITY_MANIFESTS.indexOf(a.path.split('/').pop());
        const bIndex = PRIORITY_MANIFESTS.indexOf(b.path.split('/').pop());
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });

    const orderedFiles = [...priorityFiles, ...regularFiles];

    // 4. File Contents with Clean Delimiters
    md += `## 📄 Source Code Files (${orderedFiles.length})\n\n`;

    for (const file of orderedFiles) {
        if (!file.content && file.content !== '') continue;

        const lang = getLanguageFromPath(file.path);
        const lineCount = file.content.split('\n').length;
        const sizeKb = (file.size / 1024).toFixed(1);

        // Escape fence backticks if file contains triple backticks
        const fence = file.content.includes('```') ? '````' : '```';

        md += `================================================================\n`;
        md += `File: ${file.path}\n`;
        md += `Language: ${lang} | Lines: ${lineCount} | Size: ${sizeKb} KB\n`;
        md += `================================================================\n`;
        md += `${fence}${lang}\n`;
        md += file.content;
        if (!file.content.endsWith('\n')) md += '\n';
        md += `${fence}\n\n`;
    }

    md += `---\n`;
    md += `*Generated automatically by RepoCodeBridge | Full AI-Readable Format*\n`;

    return md;
}

// Structured JSON export for programmatic consumers
export function formatToJSON(repoData) {
    const { repoInfo, files, fetchedAt } = repoData;

    return JSON.stringify({
        metadata: {
            repository: repoInfo.fullName,
            url: `https://github.com/${repoInfo.fullName}`,
            defaultBranch: repoInfo.defaultBranch,
            description: repoInfo.description || '',
            totalFiles: repoInfo.totalFiles,
            totalChars: repoInfo.totalChars,
            estimatedTokens: repoInfo.estimatedTokens || Math.round(repoInfo.totalChars / 4),
            fetchedAt,
        },
        files: files.map(f => ({
            path: f.path,
            language: getLanguageFromPath(f.path),
            sizeBytes: f.size,
            lines: f.content ? f.content.split('\n').length : 0,
            content: f.content,
        })),
    }, null, 2);
}
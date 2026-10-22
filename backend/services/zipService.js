// backend/services/zipService.js
import JSZip from 'jszip';
import { fetchRepository } from './repoFetcher.js';
import { formatToMarkdown } from './codeFormatter.js';

export async function createRepoZipFromGitHub(repoUrl, repoName, slug) {
    try {
        console.log(`📦 Creating complete source ZIP for: ${repoName}`);
        
        const repoData = await fetchRepository(repoUrl);
        const zip = new JSZip();
        
        for (const file of repoData.files) {
            if (file.content !== undefined && file.content !== null) {
                zip.file(file.path, file.content);
            }
        }
        
        // Include AI-readable single markdown in the zip as well
        const aiMarkdown = formatToMarkdown(repoData);
        zip.file(`${repoName.replace('/', '-')}-AI-Codebase.md`, aiMarkdown);
        
        const readmeContent = `# ${repoName} - Source Code & AI Export

- **Repository:** ${repoUrl}
- **Exported:** ${new Date().toISOString()}
- **Total Code Files:** ${repoData.repoInfo.totalFiles}
- **Estimated AI Tokens:** ~${repoData.repoInfo.estimatedTokens}

Included files:
1. Complete unbundled source files in their native directory structure.
2. \`${repoName.replace('/', '-')}-AI-Codebase.md\`: A single consolidated AI-ready document for pasting into ChatGPT, Claude, DeepSeek, or Gemini.

---
Exported by RepoCodeBridge (https://repo-code-bridge.vercel.app)
`;
        
        zip.file('README-REPOBRIDGE.md', readmeContent);
        const zipBuffer = await zip.generateAsync({ 
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        console.log(`✅ ZIP created: ${repoData.repoInfo.totalFiles} files (${zipBuffer.length} bytes)`);
        return zipBuffer;
        
    } catch (error) {
        console.error('ZIP creation error:', error);
        throw error;
    }
}

export async function createSimpleZip(repoName, markdownContent) {
    try {
        const zip = new JSZip();
        zip.file(`${repoName.replace('/', '-')}-AI-Readable.md`, markdownContent);
        zip.file('README.md', `Repository: ${repoName}\nGenerated: ${new Date().toISOString()}\nExported by RepoCodeBridge`);
        return await zip.generateAsync({ 
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    } catch (error) {
        console.error('Simple ZIP error:', error);
        throw error;
    }
}
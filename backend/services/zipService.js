// backend/services/zipService.js
import JSZip from 'jszip';
import { fetchRepository } from './repoFetcher.js';

export async function createRepoZipFromGitHub(repoUrl, repoName, slug) {
    try {
        console.log(`📦 Creating ZIP with actual code files for: ${repoName}`);
        
        const repoData = await fetchRepository(repoUrl);
        const zip = new JSZip();
        
        for (const file of repoData.files) {
            if (file.content) {
                zip.file(file.path, file.content);
                console.log(`   Added: ${file.path}`);
            }
        }
        
        const readmeContent = `# ${repoName} - Repository Export

Repository: ${repoUrl}
Exported: ${new Date().toISOString()}
Total Files: ${repoData.repoInfo.totalFiles}
Total Size: ${(repoData.repoInfo.totalSizeKB / 1024).toFixed(2)} MB

---
Exported by RepoCodeBridge
`;
        
        zip.file('README.md', readmeContent);
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        
        console.log(`✅ ZIP created: ${repoData.repoInfo.totalFiles} files`);
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
        zip.file('README.md', `Repository: ${repoName}\nGenerated: ${new Date().toISOString()}`);
        return await zip.generateAsync({ type: 'nodebuffer' });
    } catch (error) {
        console.error('Simple ZIP error:', error);
        throw error;
    }
}
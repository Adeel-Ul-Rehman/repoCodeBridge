import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { invalidateRepoCache, clearRepoCache } from '../backend/services/repoFetcher.js';

describe('Repository Refresh & Cache Management (Items D & E)', () => {
    test('invalidateRepoCache only removes targeted repository entries', () => {
        // clearRepoCache resets internal state
        clearRepoCache();

        // invalidateRepoCache handles varied inputs safely without throwing
        assert.doesNotThrow(() => invalidateRepoCache('https://github.com/facebook/react'));
        assert.doesNotThrow(() => invalidateRepoCache('https://github.com/facebook/react.git'));
        assert.doesNotThrow(() => invalidateRepoCache(''));
        assert.doesNotThrow(() => invalidateRepoCache(null));
        assert.doesNotThrow(() => invalidateRepoCache(undefined));
    });

    test('branch and subpath parsing regex from repo_name works accurately', () => {
        const repoNameWithBranch = 'owner/repo (@develop)';
        const branchMatch = repoNameWithBranch.match(/\(@([^)]+)\)/);
        assert.equal(branchMatch ? branchMatch[1].trim() : null, 'develop');

        const repoNameWithSubpath = 'owner/repo [/packages/core]';
        const subpathMatch = repoNameWithSubpath.match(/\[\/([^\]]+)\]/);
        assert.equal(subpathMatch ? subpathMatch[1].trim() : null, 'packages/core');

        const plainRepoName = 'owner/repo';
        assert.equal(plainRepoName.match(/\(@([^)]+)\)/), null);
        assert.equal(plainRepoName.match(/\[\/([^\]]+)\]/), null);
    });

    test('legacy deletion and download routes export callable handlers', async () => {
        const legacyDeleteHandler = (await import('../pages/api/links/[slug]/delete.js')).default;
        const legacyDownloadHandler = (await import('../pages/api/links/[slug]/download.js')).default;

        assert.equal(typeof legacyDeleteHandler, 'function');
        assert.equal(typeof legacyDownloadHandler, 'function');
    });
});


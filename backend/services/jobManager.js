// backend/services/jobManager.js
import { sanitizeLog, RateLimitExceededError } from './rateLimitHandler.js';
import Link from '../models/Link.js';
import Job from '../models/Job.js';
import { 
    fetchRepository, 
    fetchRepoTree, 
    computeTreeDiff, 
    parseGitHubUrl, 
    fetchSingleFileBlob 
} from './repoFetcher.js';
import { formatToMarkdown } from './codeFormatter.js';
import { uploadToSupabase, uploadSnapshot, getSnapshot } from '../../utils/supabaseStorage.js';

const activeJobs = new Map();
const MAX_CONCURRENT_JOBS = 3;
const JOB_TIMEOUT_MS = 90000;
const BATCH_SIZE = 15;

/**
 * Checks whether a job is currently in progress for the specified linkId
 */
export function isJobActive(linkId) {
    return activeJobs.has(linkId);
}

/**
 * Cancels an active job both in-memory and in the durable database table
 */
export function cancelJob(linkId) {
    if (activeJobs.has(linkId)) {
        const job = activeJobs.get(linkId);
        job.cancelled = true;
        activeJobs.delete(linkId);
        console.log(`[JobManager] Cancelled in-memory active job for link: ${linkId}`);
    }
    // Also cancel durably in database
    Job.cancelByLinkId(linkId).catch(() => {});
    return true;
}

/**
 * Returns current job queue status for monitoring
 */
export function getJobManagerStats() {
    return {
        activeCount: activeJobs.size,
        maxConcurrent: MAX_CONCURRENT_JOBS,
        activeLinkIds: Array.from(activeJobs.keys()),
    };
}

/**
 * Executes a single bounded, resumable step of a conversion/refresh job.
 * Designed to fit within Vercel Function execution and memory limits.
 */
export async function executeJobStep(jobId, workerId = 'worker') {
    const job = await Job.findById(jobId);
    if (!job) return { error: 'JOB_NOT_FOUND' };

    if (job.status === 'completed' || job.status === 'cancelled') {
        return { status: job.status, progress: job.progress || 100, completed: job.status === 'completed' };
    }

    // Try to acquire the execution lock
    const lockedJob = await Job.claimLock(jobId, workerId, 30);
    if (!lockedJob) {
        return { running: true, status: job.status, progress: job.progress, message: 'Step is currently being processed' };
    }

    const logStage = (stage, details = '') => {
        console.log(sanitizeLog(
            `[DurableJob] Job: ${jobId} | Stage: ${stage} | Progress: ${lockedJob.progress}% ${details ? '| ' + details : ''}`
        ));
    };

    try {
        let link = await Link.findById(lockedJob.link_id);
        if (link && (link.status === 'deleting' || link.status === 'deleted')) {
            await Job.cancel(jobId);
            return { cancelled: true, message: 'Link was deleted' };
        }
        if (!link) {
            link = { id: lockedJob.link_id, slug: (lockedJob.repo_name || 'repo').replace('/', '-') };
        }

        const options = typeof lockedJob.options === 'string' ? JSON.parse(lockedJob.options) : (lockedJob.options || {});
        if (lockedJob.selected_paths) {
            options.selectedPaths = typeof lockedJob.selected_paths === 'string' ? JSON.parse(lockedJob.selected_paths) : lockedJob.selected_paths;
        }
        if (lockedJob.branch) options.branch = lockedJob.branch;
        if (lockedJob.subpath) options.subpath = lockedJob.subpath;

        const currentStage = lockedJob.stage || 'INITIALIZING';

        // =========================================================================
        // STAGE 1: INITIALIZING / FETCHING_TREE
        // =========================================================================
        if (currentStage === 'INITIALIZING' || currentStage === 'FETCHING_TREE') {
            logStage('FETCHING_TREE', `Target: ${lockedJob.repo_url}`);
            const { owner, repo } = parseGitHubUrl(lockedJob.repo_url);
            const branch = options.branch || 'main';

            const treeMetadata = await fetchRepoTree(owner, repo, branch, options);
            let filesToFetch = [];
            let reusedFiles = [];

            // Incremental Refresh Branch
            if (lockedJob.job_type === 'refresh') {
                logStage('REFRESH_DIFF', `Comparing latest tree against stored snapshot`);
                const prevSnapshot = await getSnapshot(link.slug);
                const prevFiles = prevSnapshot?.files || [];

                const diff = computeTreeDiff(prevFiles, treeMetadata.tree, options.selectedPaths);

                if (diff.isUpToDate && prevFiles.length > 0) {
                    logStage('ALREADY_UP_TO_DATE', 'Latest commit SHA and file contents are identical to stored snapshot');
                    await Link.updateWithData(lockedJob.link_id, {
                        size: prevSnapshot.totalSize || 0,
                        fileCount: prevFiles.length,
                        gistId: lockedJob.link_id,
                        commitSha: treeMetadata.treeSha,
                    });
                    await Job.markCompleted(jobId);
                    return { completed: true, isUpToDate: true, progress: 100 };
                }

                filesToFetch = [...diff.added, ...diff.modified];
                reusedFiles = diff.unchanged;
            } else {
                // New Conversion Branch
                filesToFetch = treeMetadata.tree.filter(item => item.type === 'blob' && item.isIncludable);
                reusedFiles = [];
            }

            const checkpoint = {
                commitSha: treeMetadata.commitSha || treeMetadata.treeSha,
                treeSha: treeMetadata.treeSha,
                filesToFetch: filesToFetch.map(f => ({ path: f.path, sha: f.sha, size: f.size })),
                reusedFiles: reusedFiles,
                fetchedFiles: [],
                nextIndex: 0,
                totalFiles: filesToFetch.length,
            };

            if (filesToFetch.length === 0) {
                await Job.saveCheckpoint(jobId, {
                    stage: 'COMPLETING',
                    progress: 80,
                    checkpoint,
                    keepLock: true,
                });
                return { status: 'processing', stage: 'COMPLETING', progress: 80 };
            }

            await Job.saveCheckpoint(jobId, {
                stage: 'FETCHING_FILES',
                progress: 20,
                checkpoint,
                keepLock: false,
            });

            return { status: 'processing', stage: 'FETCHING_FILES', progress: 20, nextIndex: 0, totalFiles: filesToFetch.length };
        }

        // =========================================================================
        // STAGE 2: FETCHING_FILES (Chunked & Resumable)
        // =========================================================================
        if (currentStage === 'FETCHING_FILES') {
            const checkpoint = typeof lockedJob.checkpoint === 'string' ? JSON.parse(lockedJob.checkpoint) : (lockedJob.checkpoint || {});
            const { filesToFetch = [], fetchedFiles = [], nextIndex = 0, totalFiles = filesToFetch.length } = checkpoint;

            const endIndex = Math.min(nextIndex + BATCH_SIZE, totalFiles);
            const batch = filesToFetch.slice(nextIndex, endIndex);

            logStage('FETCHING_FILES_BATCH', `Files ${nextIndex + 1}-${endIndex} of ${totalFiles}`);
            const { owner, repo } = parseGitHubUrl(lockedJob.repo_url);

            const batchResults = await Promise.all(
                batch.map(fileItem => fetchSingleFileBlob(owner, repo, fileItem.sha, fileItem.path))
            );

            for (const res of batchResults) {
                if (res) fetchedFiles.push(res);
            }

            checkpoint.fetchedFiles = fetchedFiles;
            checkpoint.nextIndex = endIndex;

            const progress = totalFiles > 0 ? 20 + Math.floor((endIndex / totalFiles) * 60) : 80;

            if (endIndex >= totalFiles) {
                await Job.saveCheckpoint(jobId, {
                    stage: 'COMPLETING',
                    progress: 85,
                    checkpoint,
                    keepLock: true,
                });
                return { status: 'processing', stage: 'COMPLETING', progress: 85 };
            }

            await Job.saveCheckpoint(jobId, {
                stage: 'FETCHING_FILES',
                progress,
                checkpoint,
                keepLock: false,
            });

            return { status: 'processing', stage: 'FETCHING_FILES', progress, nextIndex: endIndex, totalFiles };
        }

        // =========================================================================
        // STAGE 3: COMPLETING (Format, Storage Upload & Link Ready)
        // =========================================================================
        if (currentStage === 'COMPLETING') {
            logStage('COMPLETING', `Finalizing markdown and publishing to storage`);
            const checkpoint = typeof lockedJob.checkpoint === 'string' ? JSON.parse(lockedJob.checkpoint) : (lockedJob.checkpoint || {});
            const allFiles = [...(checkpoint.reusedFiles || []), ...(checkpoint.fetchedFiles || [])];
            allFiles.sort((a, b) => a.path.localeCompare(b.path));

            let totalSize = 0;
            let totalChars = 0;
            allFiles.forEach(f => {
                totalSize += f.size || 0;
                totalChars += f.content ? f.content.length : 0;
            });

            const repoData = {
                repoInfo: {
                    name: lockedJob.repo_name,
                    fullName: lockedJob.repo_name,
                    description: '',
                    defaultBranch: lockedJob.branch || 'main',
                    activeBranch: lockedJob.branch || 'main',
                    subpath: lockedJob.subpath || null,
                    totalFiles: allFiles.length,
                    totalSizeKB: Math.round(totalSize / 1024),
                    totalChars,
                    estimatedTokens: Math.round(totalChars / 4),
                },
                files: allFiles,
                treeSha: checkpoint.treeSha,
                fetchedAt: new Date().toISOString(),
            };

            const markdownContent = formatToMarkdown(repoData);
            const storageResult = await uploadToSupabase(link.slug, markdownContent);

            const fileSnapshots = allFiles.map(f => ({
                path: f.path,
                name: f.name,
                size: f.size,
                sha: f.sha,
                content: f.content,
                isTruncated: f.isTruncated || false,
            }));

            await uploadSnapshot(link.slug, {
                files: fileSnapshots,
                totalSize,
                commitSha: checkpoint.commitSha || checkpoint.treeSha || null,
                updatedAt: new Date().toISOString(),
            });

            await Link.updateWithData(lockedJob.link_id, {
                size: totalSize,
                fileCount: allFiles.length,
                gistId: lockedJob.link_id,
                gistUrl: storageResult.publicUrl,
                b2Key: storageResult.key,
                commitSha: checkpoint.commitSha || checkpoint.treeSha || null,
                selectedPaths: lockedJob.selected_paths || null,
            });

            await Job.markCompleted(jobId);
            logStage('COMPLETED', `Successfully published ${link.slug}`);
            return { completed: true, progress: 100, linkSlug: link.slug };
        }

        return { status: lockedJob.status, progress: lockedJob.progress };
    } catch (err) {
        console.error(sanitizeLog(`[JobManager:ERROR] Job ${jobId} failed at stage ${lockedJob.stage}: ${err.message}`));

        if (err.isRateLimit || err instanceof RateLimitExceededError) {
            const userMsg = err.userFacingMessage || err.message;
            const resetDate = err.resetTime ? new Date(err.resetTime * 1000) : null;
            await Job.markRateLimited(jobId, userMsg, resetDate);
            await Link.markRateLimited(lockedJob.link_id, userMsg, err.resetTime);
            return { rateLimited: true, message: userMsg };
        }

        const isRetryable = err.code === 'JOB_TIMEOUT' || err.status >= 500 || err.code === 'ECONNRESET';
        await Job.markFailed(jobId, err.message, isRetryable);
        
        if (lockedJob.job_type === 'refresh') {
            await Link.markRefreshFailed(lockedJob.link_id, err.message);
        } else if (!isRetryable) {
            await Link.markFailed(lockedJob.link_id, err.message);
        }

        return { error: err.message, isRetryable };
    }
}

/**
 * Loops through steps until a maximum invocation duration is reached.
 * Allows small jobs to complete in the initial request, while checkpointing large jobs for resumption.
 */
export async function advanceJobUntilTimeout(jobId, workerId = 'worker', maxDurationMs = 8000, authorizedUserId = null) {
    if (authorizedUserId) {
        const job = await Job.findById(jobId);
        if (!job || job.user_id !== authorizedUserId) {
            throw new Error('Unauthorized: you do not own this job');
        }
    }

    const startTime = Date.now();
    let result = null;

    while (Date.now() - startTime < maxDurationMs) {
        result = await executeJobStep(jobId, workerId);
        if (!result || result.completed || result.rateLimited || result.error || result.running || result.cancelled || result.locked === false) {
            break;
        }
    }

    return result;
}

/**
 * Executes a repository conversion or refresh job with concurrency limits,
 * durable checkpoints, and backwards compatibility with existing test suites.
 */
export async function runConversionJob({
    linkId,
    slug,
    repoUrl,
    repoName,
    options = {},
    isRefresh = false,
    startedAt = new Date(),
}) {
    if (activeJobs.has(linkId)) {
        console.warn(sanitizeLog(`[JobManager] Job for link ${linkId} (${slug}) is already running. Skipping duplicate.`));
        return { started: false, reason: 'DUPLICATE_JOB' };
    }

    const jobState = {
        linkId,
        slug,
        stage: 'INITIALIZING',
        startedAt: Date.now(),
        stageStartedAt: Date.now(),
        cancelled: false,
    };
    activeJobs.set(linkId, jobState);

    let timeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            const err = new Error(`Conversion exceeded maximum timeout of ${JOB_TIMEOUT_MS / 1000}s at stage: ${jobState.stage}`);
            err.code = 'JOB_TIMEOUT';
            reject(err);
        }, JOB_TIMEOUT_MS);
        if (timeoutHandle.unref) timeoutHandle.unref();
    });

    const executionPromise = (async () => {
        const canonicalRepo = Link.canonicalizeRepo(repoUrl, options.branch, options.subpath);
        const { job } = await Job.create({
            userId: (await Link.findById(linkId))?.user_id || '00000000-0000-0000-0000-000000000001',
            linkId,
            canonicalRepo,
            repoUrl,
            repoName,
            branch: options.branch,
            subpath: options.subpath,
            selectedPaths: options.selectedPaths,
            options,
            jobType: isRefresh ? 'refresh' : 'convert',
        });

        // Advance steps until complete or timed out
        let result = await advanceJobUntilTimeout(job.id, 'local-worker', 8000);
        while (result && !result.completed && !result.rateLimited && !result.error && !result.cancelled && result.locked !== false && !jobState.cancelled) {
            result = await advanceJobUntilTimeout(job.id, 'local-worker', 8000);
        }

        return { success: result?.completed || false, isUpToDate: result?.isUpToDate || false };
    })();

    try {
        return await Promise.race([executionPromise, timeoutPromise]);
    } catch (err) {
        console.error(sanitizeLog(`[JobManager:FATAL] Job failed for link ${linkId}: ${err.message}`));
        if (err.isRateLimit || err instanceof RateLimitExceededError) {
            await Link.markRateLimited(linkId, err.userFacingMessage || err.message, err.resetTime);
        } else if (isRefresh) {
            await Link.markRefreshFailed(linkId, err.message);
        } else {
            await Link.markFailed(linkId, err.message);
        }
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        activeJobs.delete(linkId);
    }
}

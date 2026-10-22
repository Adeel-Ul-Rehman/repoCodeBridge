// backend/models/Link.js
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUuid = (id) => typeof id === 'string' && UUID_REGEX.test(id);

class Link {
    static async findById(id) {
        if (!isValidUuid(id)) return null;
        try {
            const result = await query(`SELECT * FROM links WHERE id = $1`, [id]);
            return result.rows[0] || null;
        } catch {
            return null;
        }
    }

    static generateSlug() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let slug = '';
        for (let i = 0; i < 8; i++) {
            slug += chars[Math.floor(Math.random() * chars.length)];
        }
        return slug;
    }
    
    static canonicalizeRepo(repoUrl, branch = null, subpath = null) {
        if (!repoUrl) return '';
        let clean = repoUrl.trim().toLowerCase().replace(/\.git$/, '').replace(/\/+$/, '');
        clean = clean.replace(/^https?:\/\/github\.com\//, '');
        const parts = clean.split('/').filter(Boolean);
        if (parts.length < 2) return clean;
        let canonical = `${parts[0]}/${parts[1]}`;
        if (subpath && typeof subpath === 'string' && subpath.trim()) {
            const cleanSub = subpath.trim().toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '');
            canonical += `::${cleanSub}`;
        }
        if (branch && typeof branch === 'string' && branch.trim()) {
            canonical += `::@${branch.trim().toLowerCase()}`;
        }
        return canonical;
    }

    static async findByUserAndCanonical(userId, canonicalRepo) {
        if (!userId || !canonicalRepo) return null;
        try {
            const result = await query(
                `SELECT * FROM links 
                 WHERE user_id = $1 
                   AND (canonical_repo = $2 OR repo_url ILIKE '%' || $2 || '%')
                   AND status != 'deleted' 
                   AND expires_at > NOW()
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [userId, canonicalRepo]
            );
            return result.rows[0] || null;
        } catch (err) {
            // Column canonical_repo might not exist in old mocks
            const fallback = await query(
                `SELECT * FROM links 
                 WHERE user_id = $1 AND expires_at > NOW() AND status != 'deleted'
                 ORDER BY created_at DESC`,
                [userId]
            );
            return fallback.rows.find(r => r.repo_url && r.repo_url.toLowerCase().includes(canonicalRepo.split('::')[0])) || null;
        }
    }

    static async isDeleted(slug) {
        if (!slug) return false;
        try {
            const result = await query(
                `SELECT slug FROM deleted_links WHERE slug = $1`,
                [slug]
            );
            return (result.rows && result.rows.length > 0);
        } catch {
            return false;
        }
    }

    static async markDeleting(id, userId) {
        const result = await query(
            `UPDATE links SET status = 'deleting' WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );
        return result.rows[0] || null;
    }

    static async recordDeletedLink(slug, userId = null) {
        if (!slug) return;
        try {
            await query(
                `INSERT INTO deleted_links (slug, user_id, deleted_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (slug) DO NOTHING`,
                [slug, userId]
            );
        } catch (err) {
            console.warn(`[LinkModel] Failed to insert deleted_links tombstone: ${err.message}`);
        }
    }

    static async recordFailedCleanup(resourceType, resourceKey, error) {
        try {
            await query(
                `INSERT INTO cleanup_tasks (resource_type, resource_key, error)
                 VALUES ($1, $2, $3)`,
                [resourceType, resourceKey, String(error)]
            );
        } catch (err) {
            console.warn(`[LinkModel] Failed to record cleanup task: ${err.message}`);
        }
    }
    
    static async create(data) {
        const id = uuidv4();
        const slug = this.generateSlug();
        const canonicalRepo = data.canonicalRepo || this.canonicalizeRepo(data.repoUrl, data.branch, data.subpath);
        const selectedPaths = data.selectedPaths ? (typeof data.selectedPaths === 'string' ? data.selectedPaths : JSON.stringify(data.selectedPaths)) : null;
        
        // Strict 7 days validity for all links
        const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        // Concurrency-safe atomic insert enforcing the 50 active links limit
        let result;
        try {
            result = await query(
                `INSERT INTO links (id, user_id, repo_url, repo_name, slug, expires_at, status, created_at, canonical_repo, selected_paths)
                 SELECT $1, $2, $3, $4, $5, $6, 'processing', NOW(), $7, $8
                 WHERE (
                     SELECT COUNT(*) FROM links 
                     WHERE user_id = $2 AND expires_at > NOW() AND status IN ('ready', 'processing', 'rate_limited')
                 ) < 50
                 RETURNING id, slug, repo_url, repo_name, expires_at, status, canonical_repo, selected_paths`,
                [id, data.userId, data.repoUrl, data.repoName, slug, expiresAt, canonicalRepo, selectedPaths]
            );
        } catch (insertErr) {
            // Fallback for schemas without canonical_repo/selected_paths column
            result = await query(
                `INSERT INTO links (id, user_id, repo_url, repo_name, slug, expires_at, status, created_at)
                 SELECT $1, $2, $3, $4, $5, $6, 'processing', NOW()
                 WHERE (
                     SELECT COUNT(*) FROM links 
                     WHERE user_id = $2 AND expires_at > NOW() AND status IN ('ready', 'processing', 'rate_limited')
                 ) < 50
                 RETURNING id, slug, repo_url, repo_name, expires_at, status`,
                [id, data.userId, data.repoUrl, data.repoName, slug, expiresAt]
            );
        }
        
        return result.rows[0] || null;
    }

    static async findById(id) {
        if (!id) return null;
        try {
            const result = await query(
                `SELECT l.*, u.email as user_email 
                 FROM links l 
                 JOIN users u ON l.user_id = u.id 
                 WHERE l.id = $1`,
                [id]
            );
            return result.rows[0] || null;
        } catch {
            return null;
        }
    }
    
    static async findBySlug(slug) {
        if (!slug) return null;
        const result = await query(
            `SELECT l.*, u.email as user_email 
             FROM links l 
             JOIN users u ON l.user_id = u.id 
             WHERE l.slug = $1`,
            [slug]
        );
        if (result.rows[0]) return result.rows[0];

        // Check tombstone table if link was deleted
        const isDel = await this.isDeleted(slug);
        if (isDel) {
            return { slug, status: 'deleted' };
        }
        return null;
    }
    
    static async findByUser(userId, includeExpired = false) {
        let sql = `SELECT * FROM links WHERE user_id = $1 AND status != 'deleted'`;
        if (!includeExpired) {
            sql += ` AND expires_at > NOW() AND status != 'expired'`;
        }
        sql += ` ORDER BY created_at DESC`;
        
        const result = await query(sql, [userId]);
        return result.rows;
    }
    
    // Atomically claim link for refresh, preventing concurrent competing refresh jobs
    static async claimRefresh(id, userId) {
        const result = await query(
            `UPDATE links 
             SET status = 'processing', last_error = NULL, retry_after = NULL
             WHERE id = $1 AND user_id = $2 AND status NOT IN ('processing', 'deleting', 'deleted')
             RETURNING *`,
            [id, userId]
        );
        return result.rows[0] || null;
    }

    // Update existing link's selection and launch new conversion
    static async updateSelectionAndClaim(id, userId, selectedPaths) {
        const pathsStr = selectedPaths ? (typeof selectedPaths === 'string' ? selectedPaths : JSON.stringify(selectedPaths)) : null;
        let result;
        try {
            result = await query(
                `UPDATE links 
                 SET status = 'processing', 
                     last_error = NULL, 
                     retry_after = NULL,
                     selected_paths = $3,
                     expires_at = NOW() + INTERVAL '7 days'
                 WHERE id = $1 AND user_id = $2 AND status NOT IN ('processing', 'deleting', 'deleted')
                 RETURNING *`,
                [id, userId, pathsStr]
            );
        } catch {
            result = await query(
                `UPDATE links 
                 SET status = 'processing', 
                     last_error = NULL,
                     expires_at = NOW() + INTERVAL '7 days'
                 WHERE id = $1 AND user_id = $2 AND status NOT IN ('processing', 'deleting', 'deleted')
                 RETURNING *`,
                [id, userId]
            );
        }
        return result.rows[0] || null;
    }
    
    static async updateWithData(id, data, startedAt = null) {
        const selectedPaths = data.selectedPaths ? (typeof data.selectedPaths === 'string' ? data.selectedPaths : JSON.stringify(data.selectedPaths)) : null;
        const treeCache = data.treeCache ? (typeof data.treeCache === 'string' ? data.treeCache : JSON.stringify(data.treeCache)) : null;
        
        let sql = `UPDATE links 
             SET repo_size_bytes = COALESCE($2, repo_size_bytes),
                 file_count = COALESCE($3, file_count),
                 gist_id = COALESCE($4, gist_id),
                 gist_url = COALESCE($5, gist_url),
                 b2_key = COALESCE($6, b2_key),
                 status = 'ready',
                 last_error = NULL,
                 retry_after = NULL,
                 last_fetched_at = NOW(),
                 processed_at = NOW()`;
        
        const params = [id, data.size, data.fileCount, data.gistId, data.gistUrl, data.b2Key];
        let pIndex = 7;
        
        if (data.commitSha) {
            sql += `, commit_sha = $${pIndex++}`;
            params.push(data.commitSha);
        }
        if (selectedPaths !== undefined) {
            sql += `, selected_paths = $${pIndex++}`;
            params.push(selectedPaths);
        }
        if (treeCache) {
            sql += `, tree_cache = $${pIndex++}`;
            params.push(treeCache);
        }
        
        if (startedAt) {
            sql += ` WHERE id = $1 AND (processed_at IS NULL OR processed_at <= $${pIndex++})`;
            params.push(startedAt);
        } else {
            sql += ` WHERE id = $1`;
        }
        
        sql += ` RETURNING *`;
        
        try {
            const result = await query(sql, params);
            return result.rows[0] || null;
        } catch (err) {
            // Fallback for minimal schemas
            const simpleSql = `UPDATE links 
                 SET repo_size_bytes = COALESCE($2, repo_size_bytes),
                     file_count = COALESCE($3, file_count),
                     gist_id = COALESCE($4, gist_id),
                     gist_url = COALESCE($5, gist_url),
                     b2_key = COALESCE($6, b2_key),
                     status = 'ready',
                     last_error = NULL,
                     last_fetched_at = NOW(),
                     processed_at = NOW()
                 WHERE id = $1 RETURNING *`;
            const simpleResult = await query(simpleSql, [id, data.size, data.fileCount, data.gistId, data.gistUrl, data.b2Key]);
            return simpleResult.rows[0] || null;
        }
    }
    
    static async markFailed(id, errorMessage) {
        if (!isValidUuid(id)) return null;
        try {
            const result = await query(
                `UPDATE links 
                 SET status = 'failed', last_error = $2, processed_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [id, errorMessage]
            );
            return result.rows[0];
        } catch {
            return null;
        }
    }

    static async markRateLimited(id, message, resetTime = null) {
        if (!isValidUuid(id)) return null;
        const retryAfter = resetTime ? new Date(resetTime * 1000) : null;
        try {
            const result = await query(
                `UPDATE links 
                 SET status = 'rate_limited', 
                     last_error = $2, 
                     retry_after = $3,
                     processed_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [id, message, retryAfter]
            );
            return result.rows[0] || null;
        } catch {
            const fallback = await query(
                `UPDATE links 
                 SET status = 'rate_limited', 
                     last_error = $2, 
                     processed_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [id, message]
            );
            return fallback.rows[0] || null;
        }
    }
    
    // For refresh failures: keep existing gist_url content accessible if present
    static async markRefreshFailed(id, errorMessage) {
        if (!isValidUuid(id)) return null;
        try {
            const result = await query(
                `UPDATE links 
                 SET status = CASE WHEN gist_url IS NOT NULL THEN 'ready' ELSE 'failed' END,
                     last_error = $2,
                     processed_at = NOW()
                 WHERE id = $1
                 RETURNING *`,
                [id, errorMessage]
            );
            return result.rows[0] || null;
        } catch {
            return null;
        }
    }
    
    static async delete(id, userId, slug = null) {
        if (slug) {
            await this.recordDeletedLink(slug, userId);
        }
        const result = await query(
            `DELETE FROM links WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, userId]
        );
        return result.rows[0];
    }
    
    static async incrementViewCount(slug) {
        await query(
            `UPDATE links SET view_count = view_count + 1 WHERE slug = $1`,
            [slug]
        );
    }
    
    static async getExpiredLinks() {
        const result = await query(
            `SELECT * FROM links WHERE expires_at < NOW() AND status != 'expired'`
        );
        return result.rows;
    }

    // Recover jobs that have remained in 'processing' status longer than timeoutMinutes
    static async recoverStuckJobs(timeoutMinutes = 5) {
        const result = await query(
            `UPDATE links 
             SET status = CASE WHEN gist_url IS NOT NULL THEN 'ready' ELSE 'failed' END,
                 last_error = 'Processing timed out. Please try again.',
                 processed_at = NOW()
             WHERE status = 'processing' 
               AND (
                   (processed_at IS NOT NULL AND processed_at < NOW() - ($1 || ' minutes')::INTERVAL)
                   OR
                   (processed_at IS NULL AND created_at < NOW() - ($1 || ' minutes')::INTERVAL)
               )
             RETURNING id, slug, repo_name, status, last_error`,
            [timeoutMinutes]
        );
        if (result.rows.length > 0) {
            console.log(`[LinkModel] Recovered ${result.rows.length} stuck job(s) older than ${timeoutMinutes}m:`, 
                result.rows.map(r => `${r.slug}(${r.status})`).join(', ')
            );
        }
        return result.rows;
    }
    
    // General free tool limits for all users: 7 days validity, 150MB repository size
    static async getUserLimits(userId) {
        const result = await query(
            `SELECT COUNT(*) FROM links WHERE user_id = $1 AND expires_at > NOW() AND status = 'ready'`,
            [userId]
        );
        
        return {
            maxLinks: 50,
            usedLinks: parseInt(result.rows[0]?.count || 0, 10),
            maxRepoSizeMB: 150,
            expiryDays: 7,
        };
    }
}

export default Link;
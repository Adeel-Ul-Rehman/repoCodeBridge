// backend/models/Link.js
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class Link {
    static generateSlug() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let slug = '';
        for (let i = 0; i < 8; i++) {
            slug += chars[Math.floor(Math.random() * chars.length)];
        }
        return slug;
    }
    
    static async create(data) {
        const id = uuidv4();
        const slug = this.generateSlug();
        
        const result = await query(
            `INSERT INTO links (id, user_id, repo_url, repo_name, slug, expires_at, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'processing', NOW())
             RETURNING id, slug, repo_url, repo_name, expires_at, status`,
            [id, data.userId, data.repoUrl, data.repoName, slug, data.expiresAt]
        );
        
        return result.rows[0];
    }
    
    static async findBySlug(slug) {
        const result = await query(
            `SELECT l.*, u.email as user_email 
             FROM links l 
             JOIN users u ON l.user_id = u.id 
             WHERE l.slug = $1`,
            [slug]
        );
        return result.rows[0] || null;
    }
    
    static async findByUser(userId, includeExpired = false) {
        let sql = `SELECT * FROM links WHERE user_id = $1`;
        if (!includeExpired) {
            sql += ` AND expires_at > NOW() AND status = 'ready'`;
        }
        sql += ` ORDER BY created_at DESC`;
        
        const result = await query(sql, [userId]);
        return result.rows;
    }
    
    static async updateWithData(id, data) {
        const result = await query(
            `UPDATE links 
             SET repo_size_bytes = COALESCE($2, repo_size_bytes),
                 file_count = COALESCE($3, file_count),
                 gist_id = COALESCE($4, gist_id),
                 gist_url = COALESCE($5, gist_url),
                 b2_key = COALESCE($6, b2_key),
                 status = 'ready',
                 last_fetched_at = NOW(),
                 processed_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, data.size, data.fileCount, data.gistId, data.gistUrl, data.b2Key]
        );
        return result.rows[0];
    }
    
    static async markFailed(id, errorMessage) {
        const result = await query(
            `UPDATE links 
             SET status = 'failed', last_error = $2, processed_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id, errorMessage]
        );
        return result.rows[0];
    }
    
    static async delete(id, userId) {
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
            `SELECT * FROM links WHERE expires_at < NOW() AND status = 'ready'`
        );
        return result.rows;
    }
    
    static async getUserLimits(userId, isPremium) {
        if (isPremium) {
            return {
                maxLinks: null,
                maxRepoSizeMB: 200,
                expiryDays: 30,
            };
        }
        
        const result = await query(
            `SELECT COUNT(*) FROM links WHERE user_id = $1 AND expires_at > NOW() AND status = 'ready'`,
            [userId]
        );
        
        return {
            maxLinks: 5,
            usedLinks: parseInt(result.rows[0].count),
            maxRepoSizeMB: 100,
            expiryDays: 7,
        };
    }
}

export default Link;
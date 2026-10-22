// backend/models/User.js
import bcrypt from 'bcrypt';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class User {
    static async create(email, passwordHash = null, isPremium = false) {
        const id = uuidv4();
        const normalizedEmail = (email || '').trim().toLowerCase();
        const result = await query(
            `INSERT INTO users (id, email, password_hash, is_premium, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING id, email, is_premium, created_at`,
            [id, normalizedEmail, passwordHash, Boolean(isPremium)]
        );
        return result.rows[0];
    }
    
    static async findByEmail(email) {
        if (!email || typeof email !== 'string') return null;
        const normalizedEmail = email.trim().toLowerCase();
        const result = await query(
            'SELECT * FROM users WHERE email = $1',
            [normalizedEmail]
        );
        return result.rows[0] || null;
    }
    
    static async findById(id) {
        if (!id) return null;
        const result = await query(
            'SELECT id, email, is_premium, created_at, last_login FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    static async updateLastLogin(id) {
        if (!id) return;
        await query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [id]
        );
    }
    
    static async hashPassword(password) {
        return await bcrypt.hash(password, 10);
    }
    
    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
    
    static async getActiveLinkCount(userId) {
        const result = await query(
            `SELECT COUNT(*) FROM links 
             WHERE user_id = $1 AND expires_at > NOW() AND status IN ('ready', 'processing')`,
            [userId]
        );
        return parseInt(result.rows[0]?.count || 0, 10);
    }
    
    // General free tool: generous active link allowance (up to 50 active links at once)
    static async canCreateLink(userId) {
        const activeCount = await this.getActiveLinkCount(userId);
        return activeCount < 50;
    }
}

export default User;
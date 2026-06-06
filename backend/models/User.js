// backend/models/User.js
import bcrypt from 'bcrypt';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class User {
    static async create(email, passwordHash = null, isPremium = false) {
        const id = uuidv4();
        const result = await query(
            `INSERT INTO users (id, email, password_hash, is_premium, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING id, email, is_premium, created_at`,
            [id, email.toLowerCase(), passwordHash, isPremium]
        );
        return result.rows[0];
    }
    
    static async findByEmail(email) {
        const result = await query(
            'SELECT * FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        return result.rows[0] || null;
    }
    
    static async findById(id) {
        const result = await query(
            'SELECT id, email, is_premium, premium_expires_at, created_at, last_login FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
    
    static async updateLastLogin(id) {
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
             WHERE user_id = $1 AND expires_at > NOW() AND status = 'ready'`,
            [userId]
        );
        return parseInt(result.rows[0].count);
    }
    
    static async canCreateLink(userId, isPremium) {
        if (isPremium) return true;
        
        const activeCount = await this.getActiveLinkCount(userId);
        return activeCount < 5;
    }
}

export default User;
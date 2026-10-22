// pages/api/auth/reset-password.js
import bcrypt from 'bcrypt';
import { query, getPool } from '../../../backend/config/database.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { email, otp, newPassword } = req.body || {};
    
    if (!email || !otp || !newPassword || 
        typeof email !== 'string' || typeof otp !== 'string' || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    try {
        // Get user
        const userResult = await query(
            'SELECT id FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        // Hash new password before opening transaction to minimize transaction duration
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Atomic OTP consumption and password update in a single transaction
        const pool = getPool();
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Atomically delete and claim the valid OTP row
            const deleteOtpResult = await client.query(
                `DELETE FROM password_resets 
                 WHERE user_id = $1 AND token = $2 AND expires_at > NOW() 
                 RETURNING token`,
                [user.id, otp.trim()]
            );
            
            if (deleteOtpResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Invalid or expired OTP' });
            }
            
            // Update password
            await client.query(
                'UPDATE users SET password_hash = $1 WHERE id = $2',
                [hashedPassword, user.id]
            );
            
            // Clean up any remaining reset tokens for this user
            await client.query(
                'DELETE FROM password_resets WHERE user_id = $1',
                [user.id]
            );
            
            await client.query('COMMIT');
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
        
        res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.',
        });
        
    } catch (error) {
        console.error('Reset password error:', error.message);
        res.status(500).json({ error: 'Failed to reset password. Please try again.' });
    }
}
// pages/api/auth/reset-password.js
import bcrypt from 'bcrypt';
import { query, getPool } from '../../../backend/config/database.js';
import { authLimiter, applyRateLimit } from '../../../backend/middleware/rateLimit.js';

const MAX_OTP_ATTEMPTS = 5;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Apply rate limiting (15 attempts per 15 min per IP)
    await applyRateLimit(req, res, authLimiter);
    if (res.headersSent) return;
    
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
        
        // Atomic OTP verification and password update in a single transaction with row locking
        const pool = getPool();
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Ensure attempts column exists
            await client.query('ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0').catch(() => {});
            
            // Atomically lock active reset challenge row for this user
            const challengeRes = await client.query(
                `SELECT id, token, expires_at, COALESCE(attempts, 0) as attempts 
                 FROM password_resets 
                 WHERE user_id = $1 
                 FOR UPDATE`,
                [user.id]
            );

            if (challengeRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Invalid or expired OTP' });
            }

            const challenge = challengeRes.rows[0];

            // Check expiration
            if (new Date(challenge.expires_at) <= new Date()) {
                await client.query('DELETE FROM password_resets WHERE id = $1', [challenge.id]);
                await client.query('COMMIT');
                return res.status(400).json({ error: 'This OTP has expired. Please request a new one.' });
            }

            // Check if already reached or exceeded max attempts
            if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
                await client.query('DELETE FROM password_resets WHERE id = $1', [challenge.id]);
                await client.query('COMMIT');
                return res.status(400).json({ 
                    error: 'Too many failed attempts. This OTP has been invalidated for security. Please request a new one.' 
                });
            }

            // Verify OTP code
            if (challenge.token !== otp.trim()) {
                const updatedAttempts = challenge.attempts + 1;
                if (updatedAttempts >= MAX_OTP_ATTEMPTS) {
                    // Reached 5 attempts: invalidate challenge
                    await client.query('DELETE FROM password_resets WHERE id = $1', [challenge.id]);
                    await client.query('COMMIT');
                    return res.status(400).json({ 
                        error: 'Too many failed attempts. This OTP has been invalidated for security. Please request a new one.' 
                    });
                } else {
                    await client.query(
                        'UPDATE password_resets SET attempts = $1 WHERE id = $2',
                        [updatedAttempts, challenge.id]
                    );
                    await client.query('COMMIT');
                    const remaining = MAX_OTP_ATTEMPTS - updatedAttempts;
                    return res.status(400).json({ 
                        error: `Invalid OTP. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` 
                    });
                }
            }
            
            // Valid OTP: Update password
            await client.query(
                'UPDATE users SET password_hash = $1 WHERE id = $2',
                [hashedPassword, user.id]
            );
            
            // Clean up reset token for this user
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
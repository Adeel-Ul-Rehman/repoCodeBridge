// pages/api/auth/reset-password.js
import bcrypt from 'bcrypt';
import { query } from '../../../backend/config/database.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    try {
        // Get user
        const userResult = await query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        // Verify OTP
        const otpResult = await query(
            `SELECT token, expires_at FROM password_resets 
             WHERE user_id = $1 AND token = $2 AND expires_at > NOW()`,
            [user.id, otp]
        );
        
        if (otpResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await query(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [hashedPassword, user.id]
        );
        
        // Delete used OTP
        await query(
            'DELETE FROM password_resets WHERE user_id = $1',
            [user.id]
        );
        
        res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.',
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password. Please try again.' });
    }
}
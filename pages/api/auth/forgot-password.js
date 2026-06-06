// pages/api/auth/forgot-password.js
import nodemailer from 'nodemailer';
import { query } from '../../../backend/config/database.js';

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email transporter - FIXED: createTransport not createTransporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    try {
        // Check if user exists
        const result = await query(
            'SELECT id, email FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        
        if (result.rows.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: 'If an account exists with this email, you will receive an OTP.' 
            });
        }
        
        const user = result.rows[0];
        const otp = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);
        
        // Delete existing OTP and insert new
        await query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
        await query(
            `INSERT INTO password_resets (user_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, otp, expiresAt]
        );
        
        // Send email
        await transporter.sendMail({
            from: `"RepoCodeBridge" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Password Reset OTP - RepoCodeBridge',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #2563eb;">🔐 Password Reset Request</h2>
                    <p>You requested to reset your password for your RepoCodeBridge account.</p>
                    <p>Your OTP code is:</p>
                    <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 32px; letter-spacing: 5px; font-weight: bold; border-radius: 8px;">
                        ${otp}
                    </div>
                    <p>This code will expire in <strong>15 minutes</strong>.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <hr style="margin: 20px 0;" />
                    <p style="color: #666; font-size: 12px;">RepoCodeBridge - Making GitHub repositories AI-readable</p>
                </div>
            `,
        });
        
        res.status(200).json({
            success: true,
            message: 'If an account exists with this email, you will receive an OTP.',
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
}
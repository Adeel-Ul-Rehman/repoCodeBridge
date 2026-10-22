// pages/api/auth/logout.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Clear the cookie
    const isProd = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProd ? '; Secure' : ''}`);
    
    // Also clear any session data
    res.status(200).json({ success: true, message: 'Logged out successfully' });
}
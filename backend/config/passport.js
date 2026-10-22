// backend/config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';
import { query } from './database.js';
import 'dotenv/config';

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Helper to record OAuth account linkage
async function linkOAuthAccount(userId, provider, providerId) {
    try {
        await query(
            `INSERT INTO oauth_accounts (user_id, provider, provider_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (provider, provider_id) DO NOTHING`,
            [userId, provider, String(providerId)]
        );
    } catch (e) {
        console.warn(`OAuth account link note (${provider}):`, e.message);
    }
}

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback';
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: googleCallbackURL,
        scope: ['profile', 'email'],
        proxy: true, // Crucial for reverse proxies & HTTPS (Vercel/Cloudflare)
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const rawEmail = profile.emails?.[0]?.value;
            if (!rawEmail) {
                return done(new Error('No email found in your Google profile. Please allow email access.'), null);
            }
            const email = rawEmail.trim().toLowerCase();
            
            let user = await User.findByEmail(email);
            if (!user) {
                try {
                    user = await User.create(email, null);
                    console.log(`✅ New user registered via Google: ${email}`);
                } catch (createErr) {
                    // Handle concurrent registration race condition
                    user = await User.findByEmail(email);
                    if (!user) throw createErr;
                }
            }
            
            await linkOAuthAccount(user.id, 'google', profile.id);
            await User.updateLastLogin(user.id).catch(() => {});
            
            return done(null, user);
        } catch (err) {
            console.error('Google Strategy error:', err.message);
            return done(err, null);
        }
    }));
    console.log('✅ Google OAuth configured with proxy support');
} else {
    console.log('⚠️ Google OAuth credentials not configured in environment');
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    const githubCallbackURL = process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback';
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: githubCallbackURL,
        scope: ['user:email'],
        proxy: true, // Crucial for reverse proxies & HTTPS (Vercel/Cloudflare)
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let email = profile.emails?.[0]?.value;
            
            // If primary email is private on GitHub, use GitHub's standard noreply address
            if (!email) {
                email = `${profile.username}@users.noreply.github.com`;
            }
            email = email.trim().toLowerCase();
            
            let user = await User.findByEmail(email);
            if (!user) {
                try {
                    user = await User.create(email, null);
                    console.log(`✅ New user registered via GitHub: ${email}`);
                } catch (createErr) {
                    // Handle concurrent registration race condition
                    user = await User.findByEmail(email);
                    if (!user) throw createErr;
                }
            }
            
            await linkOAuthAccount(user.id, 'github', profile.id);
            await User.updateLastLogin(user.id).catch(() => {});
            
            return done(null, user);
        } catch (err) {
            console.error('GitHub Strategy error:', err.message);
            return done(err, null);
        }
    }));
    console.log('✅ GitHub OAuth configured with proxy support');
} else {
    console.log('⚠️ GitHub OAuth credentials not configured in environment');
}

export default passport;
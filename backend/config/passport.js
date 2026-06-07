// backend/config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';
import dotenv from 'dotenv';

// Force load environment variables
dotenv.config();

console.log('🔍 Checking OAuth credentials:');
console.log('  GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Present' : '❌ Missing');
console.log('  GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Present' : '❌ Missing');
console.log('  GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? '✅ Present' : '❌ Missing');
console.log('  GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? '✅ Present' : '❌ Missing');

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

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        scope: ['profile', 'email'],
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error('No email found from Google'), null);
            }
            
            let user = await User.findByEmail(email);
            if (!user) {
                const premiumEmails = (process.env.PREMIUM_USERS || '').split(',');
                const isPremium = premiumEmails.includes(email);
                user = await User.create(email, null, isPremium);
                console.log(`✅ New user via Google: ${email}`);
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
    console.log('✅ Google OAuth configured');
} else {
    console.log('⚠️ Google OAuth credentials not configured');
    console.log('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
    console.log('   GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'exists' : 'missing');
}

// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: '/api/auth/github/callback',
        scope: ['user:email'],
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let email = profile.emails?.[0]?.value;
            if (!email) {
                email = `${profile.username}@github.com`;
            }
            
            let user = await User.findByEmail(email);
            if (!user) {
                const premiumEmails = (process.env.PREMIUM_USERS || '').split(',');
                const isPremium = premiumEmails.includes(email);
                user = await User.create(email, null, isPremium);
                console.log(`✅ New user via GitHub: ${email}`);
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
    console.log('✅ GitHub OAuth configured');
} else {
    console.log('⚠️ GitHub OAuth credentials not configured');
    console.log('   GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID);
    console.log('   GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? 'exists' : 'missing');
}

export default passport;
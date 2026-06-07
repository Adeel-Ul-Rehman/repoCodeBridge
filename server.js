// server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import next from 'next';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { initDatabase } from './backend/config/database.js';
import passport from './backend/config/passport.js';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    const server = express();
    
    // Middleware
    server.use(cors({
        origin: dev ? 'http://localhost:3000' : process.env.VERCEL_URL,
        credentials: true,
    }));
    server.use(express.json());
    server.use(cookieParser());
    
    // Session middleware for Passport
    server.use(session({
        secret: process.env.SESSION_SECRET || 'your-session-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }));
    
    // Initialize Passport
    server.use(passport.initialize());
    server.use(passport.session());
    
    await initDatabase();
    console.log('✅ Database connected');
    
    server.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Import API routes
    const loginHandler = (await import('./pages/api/auth/login.js')).default;
    const registerHandler = (await import('./pages/api/auth/register.js')).default;
    const meHandler = (await import('./pages/api/auth/me.js')).default;
    const logoutHandler = (await import('./pages/api/auth/logout.js')).default;
    const createLinkHandler = (await import('./pages/api/links/create.js')).default;
    const getLinksHandler = (await import('./pages/api/links/index.js')).default;
    const getLinkHandler = (await import('./pages/api/links/[slug].js')).default;
    
    // Auth routes
    server.post('/api/auth/login', loginHandler);
    server.post('/api/auth/register', registerHandler);
    server.get('/api/auth/me', meHandler);
    server.post('/api/auth/logout', logoutHandler);
    
    // OAuth routes
    const googleHandler = (await import('./pages/api/auth/google.js')).default;
    const googleCallbackHandler = (await import('./pages/api/auth/google/callback.js')).default;
    const githubHandler = (await import('./pages/api/auth/github.js')).default;
    const githubCallbackHandler = (await import('./pages/api/auth/github/callback.js')).default;
    
    server.get('/api/auth/google', googleHandler);
    server.get('/api/auth/google/callback', googleCallbackHandler);
    server.get('/api/auth/github', githubHandler);
    server.get('/api/auth/github/callback', githubCallbackHandler);
    
    // Links routes
    server.post('/api/links/create', createLinkHandler);
    server.get('/api/links', getLinksHandler);
    server.all('/api/links/:slug', getLinkHandler);
    
    // Next.js handles all other routes
    server.all('*', (req, res) => {
        return handle(req, res);
    });
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
});
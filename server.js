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
    
    // Enable trust proxy for reverse proxies (Vercel, Cloudflare, Nginx, AWS)
    server.set('trust proxy', 1);

    // Normalize CORS origin for production
    const allowedOrigin = dev 
        ? 'http://localhost:3000' 
        : (process.env.APP_URL || (process.env.VERCEL_URL ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`) : true));

    // Middleware
    server.use(cors({
        origin: allowedOrigin,
        credentials: true,
    }));
    server.use(express.json());
    server.use(cookieParser());
    
    if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
        console.warn('⚠️ WARNING: SESSION_SECRET is not set in production. Using fallback secret.');
    }

    // Session middleware for Passport
    server.use(session({
        secret: process.env.SESSION_SECRET || 'your-session-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'lax',
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
    
    // Rate limiters
    const { authLimiter, createLinkLimiter, apiLimiter } = await import('./backend/middleware/rateLimit.js');
    server.use('/api/', apiLimiter);

    // Import API routes
    const loginHandler = (await import('./pages/api/auth/login.js')).default;
    const registerHandler = (await import('./pages/api/auth/register.js')).default;
    const meHandler = (await import('./pages/api/auth/me.js')).default;
    const logoutHandler = (await import('./pages/api/auth/logout.js')).default;
    const forgotPasswordHandler = (await import('./pages/api/auth/forgot-password.js')).default;
    const resetPasswordHandler = (await import('./pages/api/auth/reset-password.js')).default;
    const createLinkHandler = (await import('./pages/api/links/create.js')).default;
    const getLinksHandler = (await import('./pages/api/links/index.js')).default;
    const getLinkHandler = (await import('./pages/api/links/[slug].js')).default;
    
    // Auth routes with rate limiting
    server.post('/api/auth/login', authLimiter, loginHandler);
    server.post('/api/auth/register', authLimiter, registerHandler);
    server.post('/api/auth/forgot-password', authLimiter, forgotPasswordHandler);
    server.post('/api/auth/reset-password', authLimiter, resetPasswordHandler);
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
    
    const downloadZipHandler = (await import('./pages/api/links/[slug]/download-zip.js')).default;
    const downloadHandler = (await import('./pages/api/links/[slug]/download.js')).default;
    const deleteLegacyHandler = (await import('./pages/api/links/[slug]/delete.js')).default;
    const refreshHandler = (await import('./pages/api/links/[slug]/refresh.js')).default;
    
    // Links routes
    server.post('/api/links/create', createLinkLimiter, createLinkHandler);
    server.get('/api/links', getLinksHandler);
    server.all('/api/links/:slug/download-zip', downloadZipHandler);
    server.all('/api/links/:slug/download', downloadHandler);
    server.all('/api/links/:slug/delete', deleteLegacyHandler);
    server.all('/api/links/:slug/refresh', refreshHandler);
    server.all('/api/links/:slug', getLinkHandler);
    
    // Supabase keep-alive ping route
    const pingHandler = (await import('./pages/api/cron/ping.js')).default;
    server.all('/api/cron/ping', pingHandler);
    
    // Next.js handles all other routes
    server.all('*', (req, res) => {
        return handle(req, res);
    });
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, async () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        
        // Automated daily Supabase keep-alive ping to prevent inactivity pausing
        const initKeepAliveEngine = async () => {
            const PING_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
            const RETRY_INTERVAL_MS = 5 * 60 * 1000;      // 5 minutes if failed

            const runPing = async (source) => {
                try {
                    const { pingSupabase } = await import('./scripts/ping-supabase.js');
                    const res = await pingSupabase(source);
                    if (res.success) {
                        console.log(`[KeepAlive] Supabase keep-alive ping successful (${source}) - Latency: ${res.latencyMs}ms`);
                    } else {
                        console.warn(`[KeepAlive] Ping reported warning (${source}):`, res.errors?.join(', '));
                    }
                    return res.success;
                } catch (err) {
                    console.error(`[KeepAlive] Ping error (${source}):`, err.message);
                    return false;
                }
            };

            // Run initial keep-alive ping on startup
            const initialSuccess = await runPing('server-startup');
            
            // Recursive scheduling for bulletproof execution and error retry
            const scheduleNext = (delayMs) => {
                const timer = setTimeout(async () => {
                    const ok = await runPing('server-daily');
                    // If failed, retry in 5 minutes; otherwise wait 24 hours
                    scheduleNext(ok ? PING_INTERVAL_MS : RETRY_INTERVAL_MS);
                }, delayMs);
                
                if (timer.unref) timer.unref();
            };

            scheduleNext(initialSuccess ? PING_INTERVAL_MS : RETRY_INTERVAL_MS);
        };

        initKeepAliveEngine().catch((err) => {
            console.warn('[KeepAlive] Could not initialize keepalive scheduler:', err.message);
        });

        // Automated watchdog to recover stuck conversion/refresh jobs (>5 minutes in 'processing')
        const initStuckJobRecovery = async () => {
            const RECOVERY_INTERVAL_MS = 2 * 60 * 1000;
            const sweep = async () => {
                try {
                    const Link = (await import('./backend/models/Link.js')).default;
                    await Link.recoverStuckJobs(5);
                } catch (e) {
                    // Safe error absorption
                }
            };
            await sweep();
            const timer = setInterval(sweep, RECOVERY_INTERVAL_MS);
            if (timer.unref) timer.unref();
        };

        initStuckJobRecovery().catch(() => {});
    });
});
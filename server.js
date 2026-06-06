// server.js
import express from 'express';
import next from 'next';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { initDatabase } from './backend/config/database.js';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    const server = express();
    
    server.use(cors({
        origin: dev ? 'http://localhost:3000' : process.env.VERCEL_URL,
        credentials: true,
    }));
    server.use(express.json());
    server.use(cookieParser());
    
    await initDatabase();
    console.log('✅ Database connected');
    
    server.get('/api/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Import API routes dynamically
    const loginHandler = (await import('./pages/api/auth/login.js')).default;
    const registerHandler = (await import('./pages/api/auth/register.js')).default;
    const meHandler = (await import('./pages/api/auth/me.js')).default;
    const logoutHandler = (await import('./pages/api/auth/logout.js')).default;
    const createLinkHandler = (await import('./pages/api/links/create.js')).default;
    const getLinksHandler = (await import('./pages/api/links/index.js')).default;
    const getLinkHandler = (await import('./pages/api/links/[slug].js')).default;
    
    server.post('/api/auth/login', loginHandler);
    server.post('/api/auth/register', registerHandler);
    server.get('/api/auth/me', meHandler);
    server.post('/api/auth/logout', logoutHandler);
    server.post('/api/links/create', createLinkHandler);
    server.get('/api/links', getLinksHandler);
    server.all('/api/links/:slug', getLinkHandler);
    
    server.all('*', (req, res) => {
        return handle(req, res);
    });
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
});
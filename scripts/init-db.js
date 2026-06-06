// scripts/init-db.js
import pg from 'pg';
import dotenv from 'dotenv';
const { Pool } = pg;
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
    console.log('🔍 Creating database tables...');
    
    const queries = [
        `CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            is_premium BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            last_login TIMESTAMP,
            premium_expires_at TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS oauth_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            provider VARCHAR(50) NOT NULL,
            provider_id VARCHAR(255) NOT NULL,
            UNIQUE(provider, provider_id)
        )`,
        
        `CREATE TABLE IF NOT EXISTS links (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            repo_url VARCHAR(500) NOT NULL,
            repo_name VARCHAR(255) NOT NULL,
            slug VARCHAR(50) UNIQUE NOT NULL,
            repo_size_bytes BIGINT,
            file_count INTEGER,
            status VARCHAR(20) DEFAULT 'processing',
            last_fetched_at TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            view_count INTEGER DEFAULT 0,
            download_count INTEGER DEFAULT 0,
            gist_id VARCHAR(255),
            gist_url VARCHAR(500),
            b2_key VARCHAR(500),
            last_error TEXT,
            processed_at TIMESTAMP
        )`,
        
        `CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug)`,
        `CREATE INDEX IF NOT EXISTS idx_links_expires_at ON links(expires_at)`,
        `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
        `CREATE INDEX IF NOT EXISTS idx_links_gist_id ON links(gist_id)`,
        
        `CREATE TABLE IF NOT EXISTS password_resets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL
        )`
    ];
    
    for (let i = 0; i < queries.length; i++) {
        try {
            await pool.query(queries[i]);
            console.log(`✅ Query ${i + 1}/${queries.length} executed`);
        } catch (err) {
            console.error(`❌ Query ${i + 1} failed:`, err.message);
        }
    }
    
    console.log('\n🎉 Database initialization complete!');
    process.exit(0);
}

initDatabase();
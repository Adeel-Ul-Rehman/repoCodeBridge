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
            expires_at TIMESTAMP NOT NULL,
            attempts INTEGER DEFAULT 0
        )`,
        `ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0`,
        `ALTER TABLE links ADD COLUMN IF NOT EXISTS canonical_repo VARCHAR(500)`,
        `ALTER TABLE links ADD COLUMN IF NOT EXISTS selected_paths JSONB`,
        `ALTER TABLE links ADD COLUMN IF NOT EXISTS commit_sha VARCHAR(64)`,
        `ALTER TABLE links ADD COLUMN IF NOT EXISTS tree_cache JSONB`,
        `ALTER TABLE links ADD COLUMN IF NOT EXISTS retry_after TIMESTAMP WITH TIME ZONE`,
        `DROP INDEX IF EXISTS idx_links_user_canonical`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_links_user_canonical_active ON links (user_id, canonical_repo) WHERE (status != 'deleted')`,
        `CREATE TABLE IF NOT EXISTS deleted_links (
            slug VARCHAR(64) PRIMARY KEY,
            user_id UUID,
            deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS cleanup_tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            resource_type VARCHAR(50) NOT NULL,
            resource_key VARCHAR(500) NOT NULL,
            error TEXT,
            attempts INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS conversion_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            link_id UUID REFERENCES links(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            job_type VARCHAR(20) NOT NULL DEFAULT 'convert',
            canonical_repo VARCHAR(500) NOT NULL,
            repo_url VARCHAR(500) NOT NULL,
            repo_name VARCHAR(255) NOT NULL,
            branch VARCHAR(100),
            subpath VARCHAR(500),
            selected_paths JSONB,
            options JSONB,
            status VARCHAR(30) NOT NULL DEFAULT 'queued',
            progress INTEGER DEFAULT 0,
            stage VARCHAR(50) DEFAULT 'INITIALIZING',
            checkpoint JSONB,
            attempts INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 3,
            last_error TEXT,
            retry_after TIMESTAMP WITH TIME ZONE,
            locked_at TIMESTAMP WITH TIME ZONE,
            locked_by VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            completed_at TIMESTAMP WITH TIME ZONE
        )`,
        `CREATE INDEX IF NOT EXISTS idx_conversion_jobs_user_id ON conversion_jobs(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_conversion_jobs_link_id ON conversion_jobs(link_id)`,
        `CREATE INDEX IF NOT EXISTS idx_conversion_jobs_status ON conversion_jobs(status)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_active_job_per_user_canonical ON conversion_jobs (user_id, canonical_repo) WHERE (status IN ('queued', 'processing'))`
    ];
    
    let failedCount = 0;
    for (let i = 0; i < queries.length; i++) {
        try {
            await pool.query(queries[i]);
            console.log(`✅ Query ${i + 1}/${queries.length} executed`);
        } catch (err) {
            failedCount++;
            console.error(`❌ Query ${i + 1} failed:`, err.message);
        }
    }
    
    if (failedCount > 0) {
        console.error(`\n❌ Database initialization completed with ${failedCount} error(s).`);
        process.exit(1);
    }

    console.log('\n🎉 Database initialization complete!');
    process.exit(0);
}

initDatabase();
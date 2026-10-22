-- scripts/migrations/001_durable_jobs_and_unique_canonical.sql
-- Migration: Add durable conversion jobs, unique canonical repository enforcement, and cleanup tasks
-- Safe, idempotent, non-destructive migration for RepoCodeBridge PostgreSQL / Supabase database.

BEGIN;

-- 1. Ensure required columns exist on links table
ALTER TABLE links ADD COLUMN IF NOT EXISTS canonical_repo VARCHAR(500);
ALTER TABLE links ADD COLUMN IF NOT EXISTS selected_paths JSONB;
ALTER TABLE links ADD COLUMN IF NOT EXISTS commit_sha VARCHAR(64);
ALTER TABLE links ADD COLUMN IF NOT EXISTS tree_cache JSONB;
ALTER TABLE links ADD COLUMN IF NOT EXISTS retry_after TIMESTAMP WITH TIME ZONE;
ALTER TABLE links ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE links ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- 2. Backfill canonical_repo for any legacy links missing canonical_repo
UPDATE links
SET canonical_repo = LOWER(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(repo_url, '^https?://github\.com/', '', 'i'),
            '\.git$', '', 'i'
        ),
        '/+$', '', 'g'
    )
)
WHERE canonical_repo IS NULL AND repo_url IS NOT NULL;

-- 3. Resolve any existing duplicates for (user_id, canonical_repo) conservatively
-- If multiple non-deleted links exist for the exact same user and canonical repo,
-- keep the newest active link intact, and suffix older historical duplicates with '::dup-<id>'
-- This guarantees NO user data or historical links are ever deleted.
WITH duplicate_ranked AS (
    SELECT id, user_id, canonical_repo,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, canonical_repo 
               ORDER BY COALESCE(processed_at, created_at) DESC, created_at DESC
           ) as rn
    FROM links
    WHERE canonical_repo IS NOT NULL AND status != 'deleted'
)
UPDATE links l
SET canonical_repo = l.canonical_repo || '::dup-' || SUBSTRING(l.id::text, 1, 8)
FROM duplicate_ranked r
WHERE l.id = r.id AND r.rn > 1;

-- 4. Enforce ONE reusable link per user and canonical repository at database level
-- Uses a partial unique index so permanently deleted links do not block re-creation
DROP INDEX IF EXISTS idx_links_user_canonical;
CREATE UNIQUE INDEX IF NOT EXISTS uq_links_user_canonical_active 
ON links (user_id, canonical_repo) 
WHERE (status != 'deleted');

-- 5. Create durable conversion_jobs table for Vercel serverless execution
CREATE TABLE IF NOT EXISTS conversion_jobs (
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
);

CREATE INDEX IF NOT EXISTS idx_conversion_jobs_user_id ON conversion_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_link_id ON conversion_jobs(link_id);
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_status ON conversion_jobs(status);

-- 6. Enforce that only ONE active job (queued or processing) can run per user and canonical repo
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_job_per_user_canonical 
ON conversion_jobs (user_id, canonical_repo) 
WHERE (status IN ('queued', 'processing'));

-- 7. Ensure permanent tombstones table exists for deleted links (returns 410 Gone)
CREATE TABLE IF NOT EXISTS deleted_links (
    slug VARCHAR(64) PRIMARY KEY,
    user_id UUID,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Ensure durable retry queue exists for external storage cleanup failures
CREATE TABLE IF NOT EXISTS cleanup_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type VARCHAR(50) NOT NULL,
    resource_key VARCHAR(500) NOT NULL,
    error TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMIT;

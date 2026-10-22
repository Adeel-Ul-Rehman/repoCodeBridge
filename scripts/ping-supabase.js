// scripts/ping-supabase.js
import 'dotenv/config';
import { query } from '../backend/config/database.js';
import { createClient } from '@supabase/supabase-js';
import { deleteFromSupabase } from '../utils/supabaseStorage.js';

/**
 * Pings Supabase Postgres database and Supabase Storage to prevent inactivity auto-pause.
 * Also performs routine maintenance (deleting expired 7-day links).
 */
export async function pingSupabase(source = 'manual') {
    const startTime = Date.now();
    const result = {
        success: false,
        timestamp: new Date().toISOString(),
        source,
        database: null,
        storage: null,
        cleanedExpiredLinks: 0,
        latencyMs: 0,
        errors: [],
    };

    // 1. Ping PostgreSQL database
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS system_pings (
                id SERIAL PRIMARY KEY,
                pinged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                source VARCHAR(50) DEFAULT 'system',
                status VARCHAR(20) DEFAULT 'success'
            )
        `);

        await query(
            'INSERT INTO system_pings (source, status) VALUES ($1, $2)',
            [source, 'success']
        );

        // Retain only last 30 days of pings
        await query("DELETE FROM system_pings WHERE pinged_at < NOW() - INTERVAL '30 days'");

        const dbRes = await query('SELECT NOW() as now, current_database() as db_name');
        result.database = {
            connected: true,
            serverTime: dbRes.rows[0]?.now,
            database: dbRes.rows[0]?.db_name,
        };
    } catch (err) {
        console.error('❌ Database ping failed:', err.message);
        result.errors.push(`Database: ${err.message}`);
    }

    // 2. Ping Supabase Client & Storage API
    try {
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY
            );
            const { data, error } = await supabase.storage.listBuckets();
            if (error) throw error;
            result.storage = {
                connected: true,
                bucketCount: data ? data.length : 0,
            };
        } else {
            result.storage = { connected: false, message: 'Supabase credentials not configured' };
        }
    } catch (err) {
        console.error('❌ Supabase storage ping failed:', err.message);
        result.errors.push(`Storage: ${err.message}`);
    }

    // 3. Clean up expired links (links older than 7 days)
    try {
        const expiredLinksRes = await query(
            "SELECT id, slug, user_id FROM links WHERE expires_at < NOW() AND status != 'expired'"
        );
        const expiredLinks = expiredLinksRes.rows || [];

        for (const link of expiredLinks) {
            try {
                await deleteFromSupabase(link.slug);
            } catch (storageErr) {
                // Ignore storage delete errors if already missing
            }
            await query("UPDATE links SET status = 'expired' WHERE id = $1", [link.id]);
        }

        result.cleanedExpiredLinks = expiredLinks.length;
    } catch (cleanupErr) {
        console.warn('⚠️ Expired link cleanup warning:', cleanupErr.message);
    }

    result.latencyMs = Date.now() - startTime;
    result.success = result.database?.connected === true;

    return result;
}

// When executed directly from CLI: node scripts/ping-supabase.js
if (process.argv[1]?.endsWith('ping-supabase.js')) {
    console.log('📡 Pinging Supabase (Postgres & Storage) to prevent inactivity pause...');
    pingSupabase('cli')
        .then((res) => {
            if (res.success) {
                console.log('✅ Supabase Ping Successful!');
                console.log(`   ⏱️ Latency: ${res.latencyMs}ms`);
                console.log(`   🗄️ Database: Connected (${res.database.database})`);
                console.log(`   📦 Storage: ${res.storage.connected ? 'Connected' : 'Unavailable'}`);
                if (res.cleanedExpiredLinks > 0) {
                    console.log(`   🧹 Cleaned up ${res.cleanedExpiredLinks} expired links`);
                }
                process.exit(0);
            } else {
                console.error('❌ Supabase Ping Failed with errors:', res.errors);
                process.exit(1);
            }
        })
        .catch((err) => {
            console.error('❌ Unexpected error in ping script:', err);
            process.exit(1);
        });
}

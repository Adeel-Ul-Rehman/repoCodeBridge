// backend/config/database.js
import pg from 'pg';
const { Pool } = pg;

let pool = null;

function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' 
                ? { rejectUnauthorized: false } 
                : false,
        });
    }
    return pool;
}

async function initDatabase() {
    const db = getPool();
    try {
        await db.query('SELECT NOW()');
        console.log('✅ PostgreSQL connected');
        return true;
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
        throw err;
    }
}

async function query(text, params) {
    const db = getPool();
    try {
        const result = await db.query(text, params);
        return result;
    } catch (err) {
        console.error('Database query error:', err.message);
        throw err;
    }
}

export { getPool, initDatabase, query };
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

let pool = null;

function getPool() {
    if (!pool) {
        const isLocal = !process.env.DATABASE_URL || 
            process.env.DATABASE_URL.includes('localhost') || 
            process.env.DATABASE_URL.includes('127.0.0.1');
            
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: isLocal ? false : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        // Prevent unexpected idle connection errors from crashing the Node.js process
        pool.on('error', (err) => {
            console.error('Unexpected database client error on idle client:', err.message);
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
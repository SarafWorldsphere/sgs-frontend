// lib/db.ts - Shared database connection pool

import { Pool } from 'pg';

let pool: Pool | null = null;

// Get or create the shared pool
export function getPool(): Pool {
  if (!pool) {
    // Read from env, but override if it accidentally reads the local 'postgres' user
    const dbUser = process.env.PGUSER === 'postgres' ? 'swais_app_user' : process.env.PGUSER;

    pool = new Pool({
      host: process.env.PGHOST || 'swais-db-test-env.cri2kcc26kxg.ap-south-2.rds.amazonaws.com',
      user: dbUser || 'swais_app_user',
      password: process.env.PGPASSWORD!,
      database: process.env.PGDATABASE || 'sgs_prod',
      port: parseInt(process.env.PGPORT || '5432'),
      // RDS requires SSL in every environment. Gating this on NODE_ENV broke
      // local dev: `next dev` forces NODE_ENV=development regardless of .env,
      // so the pool connected in plaintext and RDS refused it with
      // "no pg_hba.conf entry ... no encryption". The other two pools
      // (user-role-check.ts, student-access.ts) already connect unconditionally.
      ssl: { rejectUnauthorized: false },
      max: 20, // Maximum connections in the pool
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 5000, // Timeout increased to 5 seconds for remote RDS
    });

    // Log pool events for debugging
    pool.on('connect', () => {
      console.log('🔌 New database connection established');
    });

    pool.on('remove', () => {
      console.log('🔌 Database connection closed');
    });

    pool.on('error', (err) => {
      console.error('⚠️ Database pool error:', err.message);
    });
  }
  return pool;
}

// Close the pool (call this when the app shuts down)
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('🔌 Database pool closed');
    } catch (error) {
      console.error('Error closing pool:', error);
    }
  }
}

// Helper function to get a client from the pool with automatic release
export async function withClient<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    try {
      client.release();
    } catch (releaseError) {
      // Ignore errors when releasing - connection may already be closed
      console.log('Client already released or connection closed');
    }
  }
}

// Helper function to execute a query with automatic connection management
export async function query(text: string, params?: any[]): Promise<any> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    try {
      client.release();
    } catch (releaseError) {
      // Ignore errors when releasing
    }
  }
}
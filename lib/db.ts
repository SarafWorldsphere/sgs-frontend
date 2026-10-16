// lib/db.ts - Shared database connection pool

import { headers } from "next/headers";
import { Pool, PoolClient } from "pg";

const TENANT_HEADER = "x-saraswati-tenant-id";

let pool: Pool | null = null;

// Get or create the shared pool
export function getPool(): Pool {
  if (!pool) {
    const host = process.env.PGHOST;
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD;
    const database = process.env.PGDATABASE;
    if (!host || !user || !password || !database) {
      throw new Error("PGHOST, PGUSER, PGPASSWORD, and PGDATABASE are required.");
    }

    pool = new Pool({
      host,
      user,
      password,
      database,
      port: parseInt(process.env.PGPORT || '5432'),
      ssl: host === 'localhost' ? false : { rejectUnauthorized: false },
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

async function bindTenant(client: PoolClient): Promise<void> {
  const tenantId = (await headers()).get(TENANT_HEADER);
  if (!tenantId) throw new Error("School was not resolved for this request.");
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
}

export async function withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await bindTenant(client);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: unknown[]) {
  const client = await getPool().connect();
  try {
    await bindTenant(client);
    const result = await client.query(text, params);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
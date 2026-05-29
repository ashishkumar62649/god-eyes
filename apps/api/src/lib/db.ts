import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export interface DatabaseStatus {
  status: 'connected' | 'offline';
  latencyMs: number | null;
  message: string | null;
}

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function checkDatabaseStatus(): Promise<DatabaseStatus> {
  const start = Date.now();
  try {
    const client = await getPool().connect();
    const result = await client.query('SELECT 1');
    client.release();
    return {
      status: 'connected',
      latencyMs: Date.now() - start,
      message: null,
    };
  } catch (error) {
    return {
      status: 'offline',
      latencyMs: null,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type UnlistenFn = () => Promise<void>;

export async function listen(
  channel: string,
  onNotification: (payload: string) => void,
): Promise<UnlistenFn> {
  const client = await getPool().connect();
  await client.query(`LISTEN ${channel}`);
  client.on('notification', (msg) => {
    if (msg.channel === channel) {
      onNotification(msg.payload || '');
    }
  });
  return async () => {
    client.removeAllListeners('notification');
    await client.query(`UNLISTEN ${channel}`);
    client.release();
  };
}
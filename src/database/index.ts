import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { CONFIG } from '../config';

export const pool = new Pool(CONFIG.DB);

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function testerConnexion(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 AS connexion_active');
    return res.rows.length > 0 && res.rows[0].connexion_active === 1;
  } catch (error) {
    return false;
  }
}

let promesseFermeturePool: Promise<void> | null = null;

export async function fermerPool(): Promise<void> {
  if (pool.ending || pool.ended) {
    return;
  }
  if (!promesseFermeturePool) {
    promesseFermeturePool = pool.end().catch((err: any) => {
      if (err && err.message && err.message.includes('Called end on pool more than once')) {
        return;
      }
      throw err;
    });
  }
  await promesseFermeturePool;
}


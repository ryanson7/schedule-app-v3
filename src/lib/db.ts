//src/lib/db.ts
import type { Pool, PoolConfig, QueryResult } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

const createPool = async (): Promise<Pool> => {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    throw new Error(
      '데이터베이스 연결 정보(DATABASE_URL 또는 SUPABASE_DB_URL)가 설정되어 있지 않습니다.'
    );
  }

  const { Pool } = await import('pg');

  const poolConfig: PoolConfig = {
    connectionString,
  };

  if (process.env.NODE_ENV === 'production') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  return new Pool(poolConfig);
};

const getPool = async (): Promise<Pool> => {
  if (!global.__dbPool) {
    global.__dbPool = await createPool();
  }

  return global.__dbPool;
};

export async function query<T = unknown>(
  text: string,
  params?: (string | number | boolean | null)[]
): Promise<QueryResult<T>> {
  const pool = await getPool();
  return pool.query<T>(text, params);
}

export async function endPool() {
  if (global.__dbPool) {
    await global.__dbPool.end();
    global.__dbPool = undefined;
  }
}

export type { QueryResult };
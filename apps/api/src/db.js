import pg from "pg";
import { env } from "./config/env.js";

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /supabase\.(co|com)|neon\.tech|render\.com/.test(process.env.DATABASE_URL ?? "")
        ? { rejectUnauthorized: false }
        : undefined,
      max: env.DATABASE_MAX_CONNECTIONS,
      connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS
    });
  }
  return pool;
}

export async function claimIdempotency(key) {
  if (!key) return true;
  const rows = await q(
    "INSERT INTO idempotency_keys (key) VALUES ($1) ON CONFLICT (key) DO NOTHING RETURNING key",
    [key]
  );
  return rows.length > 0;
}

/** Query helper: q("select * from users where id = $1", [id]) -> rows */
export async function q(sql, params = []) {
  const res = await getPool().query(sql, params);
  return res.rows;
}

export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] ?? null;
}

/** Run fn inside a transaction; rolls back on throw. */
export async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn({
      query: async (sql, params = []) => (await client.query(sql, params)).rows,
      one: async (sql, params = []) => (await client.query(sql, params)).rows[0] ?? null
    });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Simple cursor-pagination helper. Returns { rows, total } */
export async function paginate({ table, select = "*", where = "true", params = [], order = "created_at desc", limit = 20, offset = 0, countWhere }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const rows = await q(
    `SELECT ${select} FROM ${table} WHERE ${where} ORDER BY ${order} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );
  const totalRow = await q(`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${countWhere ?? where}`, params);
  return { rows, total: totalRow[0]?.count ?? 0 };
}

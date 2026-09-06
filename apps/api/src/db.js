import pg from "pg";

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /supabase\.(co|com)|neon\.tech|render\.com/.test(process.env.DATABASE_URL ?? "")
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10
    });
  }
  return pool;
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

import pg from "pg";
import { rootCertificates } from "node:tls";
import { env } from "./config/env.js";

const { Pool } = pg;

// Public database CA linked by Supabase's dashboard. Valid through April 2031.
// https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

let pool;

export function getPool() {
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL || env.DATABASE_URL);
    const supabase = /\.supabase\.(co|com)$/.test(url.hostname);
    const tls =
      supabase || /neon\.tech|render\.com/.test(url.hostname) ||
      ["require", "verify-ca", "verify-full", "no-verify"].includes(
        url.searchParams.get("sslmode"),
      ) ||
      process.env.DATABASE_SSL === "true";
    // pg connection-string SSL options must not override certificate verification.
    if (tls)
      for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
        url.searchParams.delete(key);
    pool = new Pool({
      connectionString: url.toString(),
      ssl: tls
        ? {
            rejectUnauthorized: true,
            ...(process.env.DATABASE_CA_CERT
              ? { ca: process.env.DATABASE_CA_CERT.replaceAll("\\n", "\n") }
              : supabase
                ? { ca: [...rootCertificates, SUPABASE_ROOT_CA] }
                : {}),
          }
        : undefined,
      max: env.DATABASE_MAX_CONNECTIONS,
      connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
    });
  }
  return pool;
}

export async function claimIdempotency(key) {
  if (!key) return true;
  const rows = await q(
    "INSERT INTO idempotency_keys (key) VALUES ($1) ON CONFLICT (key) DO NOTHING RETURNING key",
    [key],
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
      one: async (sql, params = []) =>
        (await client.query(sql, params)).rows[0] ?? null,
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
export async function paginate({
  table,
  select = "*",
  where = "true",
  params = [],
  order = "created_at desc",
  limit = 20,
  offset = 0,
  countWhere,
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const rows = await q(
    `SELECT ${select} FROM ${table} WHERE ${where} ORDER BY ${order} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params,
  );
  const totalRow = await q(
    `SELECT COUNT(*)::int AS count FROM ${table} WHERE ${countWhere ?? where}`,
    params,
  );
  return { rows, total: totalRow[0]?.count ?? 0 };
}

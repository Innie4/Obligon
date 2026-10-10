import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";

function options(url, extra = {}) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `
      import pg from 'pg';
      const { getPool } = await import('./src/db.js');
      const pool = getPool();
      const client = new pg.Client(pool.options);
      console.log(JSON.stringify({
        url: pool.options.connectionString,
        ssl: client.connectionParameters.ssl
      }));
      await pool.end();
    `],
    {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        NODE_ENV: "test",
        DOTENV_CONFIG_PATH: "/dev/null",
        DATABASE_URL: url,
        DATABASE_SSL: "",
        DATABASE_CA_CERT: "",
        PGSSLMODE: "",
        ...extra
      },
      encoding: "utf8"
    }
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

test("hosted database TLS verifies certificates despite URI sslmode", () => {
  const result = options("postgresql://fixture@db.example.supabase.co/test?sslmode=no-verify");
  assert.equal(result.ssl.rejectUnauthorized, true);
  assert.equal(new URL(result.url).searchParams.has("sslmode"), false);
});

for (const host of ["db.example.supabase.co", "aws-0-eu-central-1.pooler.supabase.com"]) {
  test(`${host} trusts the official Supabase CA without deployment configuration`, () => {
    const { ssl } = options(`postgresql://fixture@${host}/test`);
    assert.equal(ssl.rejectUnauthorized, true);
    assert.ok(Array.isArray(ssl.ca), "Supabase connections need their private root CA");
    const certificates = ssl.ca.map((pem) => new X509Certificate(pem));
    const supabaseRoot = certificates.find((certificate) =>
      certificate.fingerprint256 === "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA"
    );
    assert.ok(supabaseRoot, "must trust the certificate published by Supabase's dashboard");
    assert.ok(supabaseRoot.ca);
    assert.ok(supabaseRoot.verify(supabaseRoot.publicKey));
    assert.ok(Date.parse(supabaseRoot.validTo) > Date.now());
    for (const root of rootCertificates) assert.ok(ssl.ca.includes(root));
  });
}

test("an explicit Supabase CA takes precedence over bundled trust", () => {
  const { ssl } = options("postgresql://fixture@db.example.supabase.co/test", {
    DATABASE_CA_CERT: "line1\\nline2"
  });
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.ca, "line1\nline2");
});

test("explicit local TLS accepts a configured CA and keeps verification enabled", () => {
  const { ssl } = options("postgresql://fixture@127.0.0.1/test", {
    DATABASE_SSL: "true",
    DATABASE_CA_CERT: "line1\\nline2"
  });
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.ca, "line1\nline2");
});

test("other hosted databases retain their standard certificate trust", () => {
  const { ssl } = options("postgresql://fixture@db.example.neon.tech/test");
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.ca, undefined);
});

test("a hostname containing Supabase's name is not trusted as Supabase", () => {
  const { ssl } = options("postgresql://fixture@db.supabase.com.example.org/test?sslmode=require");
  assert.equal(ssl.rejectUnauthorized, true);
  assert.equal(ssl.ca, undefined);
});

test("ordinary local database connections do not require TLS", () => {
  assert.equal(options("postgresql://fixture@127.0.0.1/test").ssl, false);
});

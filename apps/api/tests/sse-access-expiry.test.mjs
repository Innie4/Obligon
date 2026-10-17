import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { EventEmitter } from "node:events";

process.env.DATABASE_URL = "postgres://localhost:1/unused_sse_fixture";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.NODE_ENV = "test";
const { getPool } = await import("../src/db.js");
const { sseHandler } = await import("../src/lib/sse.js");

test("expiry during an awaited heartbeat cannot write to the ended stream", async () => {
  const pool = getPool();
  const deadline = new Date(Date.now() + 60_000);
  let heartbeat, expire, releaseAuthorization;
  let calls = 0, writesAfterEnd = 0, ended = 0;
  const deferred = new Promise(resolve => { releaseAuthorization = resolve; });
  mock.method(pool, "query", async () => {
    calls++;
    if (calls === 3) return deferred;
    return { rows: [{ id: "synthetic-user", access_expires_at: deadline }] };
  });
  mock.method(globalThis, "setInterval", fn => { heartbeat = fn; return 1; });
  mock.method(globalThis, "setTimeout", fn => { expire = fn; return 2; });
  mock.method(globalThis, "clearInterval", () => {});
  mock.method(globalThis, "clearTimeout", () => {});
  const req = new EventEmitter();
  req.user = { id: "synthetic-user" };
  req.auth = { sid: "synthetic-session", exp: Math.floor(Date.now() / 1000) + 120 };
  const res = {
    writableEnded: false,
    writeHead() {},
    write() { if (this.writableEnded) writesAfterEnd++; },
    end() { this.writableEnded = true; ended++; },
  };
  try {
    await sseHandler(req, res);
    const pending = heartbeat();
    expire();
    releaseAuthorization({ rows: [{ id: "synthetic-user", access_expires_at: deadline }] });
    await pending;
    assert.equal(writesAfterEnd, 0);
    assert.equal(ended, 1);
  } finally {
    req.emit("close");
    mock.restoreAll();
    await pool.end();
  }
});

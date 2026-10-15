import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import dns from "node:dns";
import https from "node:https";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import pg from "pg";
import webpush from "web-push";

Object.assign(process.env, { NODE_ENV: "test", DOTENV_CONFIG_PATH: "/dev/null" });
const { env } = await import("../src/config/env.js");
const vapid = webpush.generateVAPIDKeys();
Object.assign(env, { WEB_PUSH_CONTACT: "mailto:fixture@example.invalid", WEB_PUSH_VAPID_PUBLIC_KEY: vapid.publicKey, WEB_PUSH_VAPID_PRIVATE_KEY: vapid.privateKey });
const router = (await import("../src/routes/push.routes.js")).default;
const { sendPush } = await import("../src/lib/push.js");
const curve = createECDH("prime256v1");
const keys = { p256dh: curve.generateKeys().toString("base64url"), auth: randomBytes(16).toString("base64url") };
const good = "https://fcm.googleapis.com/fcm/send/local-fixture";
const supported = [good, "https://updates.push.services.mozilla.com/wpush/v2/local-fixture", "https://web.push.apple.com/local-fixture", "https://wns2-local.notify.windows.com/w/?token=local-fixture"];
async function route(path, body, user = { id: "owner" }) {
  const handlers = router.stack.find(layer => layer.route?.path === path).route.stack;
  let status = 200, response;
  const req = { body, user }, res = { status(value) { status = value; return this; }, json(value) { response = value; return this; } };
  let error;
  for (const layer of handlers) {
    await layer.handle(req, res, value => { error = value; });
    if (error || response) break;
  }
  if (error) return { status: error.status ?? 500, body: { error: { message: error.message } } };
  return { status, body: response };
}
const invalidEndpoints = {
  http: "http://fcm.googleapis.com/fcm/send/local-fixture",
  loopback: "https://127.0.0.1:8443/internal-fixture",
  integerIPv4: "https://2130706433/internal-fixture",
  hexadecimalIPv4: "https://0x7f000001/internal-fixture",
  privateIPv4: "https://10.0.0.1/private",
  metadata: "https://169.254.169.254/latest/meta-data/",
  loopbackIPv6: "https://[::1]/private",
  mappedIPv6: "https://[::ffff:127.0.0.1]/private",
  privateIPv6: "https://[fd00::1]/private",
  localHost: "https://localhost/private",
  arbitraryHost: "https://attacker.example.invalid/push",
  suffixConfusion: "https://fcm.googleapis.com.attacker.example.invalid/push",
  appleSuffixConfusion: "https://web.push.apple.com.attacker.example.invalid/push",
  microsoftSuffixConfusion: "https://notify.windows.com.attacker.example.invalid/push",
  emptyAppleLabel: "https://.push.apple.com/push",
  doubleAppleLabel: "https://web..push.apple.com/push",
  trailingDot: "https://fcm.googleapis.com./push",
  credentials: "https://user:password@fcm.googleapis.com/fcm/send/fixture",
  encodedCredentials: "https://%75ser%3Apassword@fcm.googleapis.com/fcm/send/fixture",
  nonDefaultPort: "https://fcm.googleapis.com:8443/fcm/send/fixture",
  fragment: "https://fcm.googleapis.com/fcm/send/fixture#https://127.0.0.1/",
  backslash: "https://fcm.googleapis.com\\@127.0.0.1/private",
  whitespace: " https://fcm.googleapis.com/fcm/send/fixture",
  malformed: "not-a-url"
};
for (const [name, endpoint] of Object.entries(invalidEndpoints)) {
  test(`registration rejects ${name} before storing`, async t => {
    let writes = 0;
    t.mock.method(pg.Pool.prototype, "query", async () => { writes++; return { rows: [] }; });
    assert.equal((await route("/subscribe", { endpoint, keys })).status, 400);
    assert.equal(writes, 0);
  });
  test(`delivery skips stored ${name} before invoking Web Push`, async t => {
    t.mock.method(pg.Pool.prototype, "query", async () => ({ rows: [{ id: "invalid", endpoint, keys }] }));
    let sends = 0;
    t.mock.method(webpush, "sendNotification", async () => { sends++; return {}; });
    t.mock.method(console, "warn", () => {});
    assert.equal((await sendPush("owner", { title: "private payload" })).delivered, false);
    assert.equal(sends, 0);
  });
}
for (const endpoint of supported) test(`documented service ${new URL(endpoint).hostname} stores and delivers a valid subscription`, async t => {
  const writes = [], subs = [{ id: "valid", endpoint, keys }], sends = [];
  t.mock.method(pg.Pool.prototype, "query", async (sql, params) => { if (sql.startsWith("INSERT")) writes.push(params); return { rows: sql.startsWith("SELECT") ? subs : [] }; });
  t.mock.method(webpush, "sendNotification", async (...args) => { sends.push(args); return {}; });
  assert.equal((await route("/subscribe", { endpoint, keys })).status, 200);
  assert.equal(writes.length, 1);
  assert.equal((await sendPush("owner", { title: "fixture" })).delivered, true);
  assert.equal(sends[0][0].endpoint, endpoint);
  assert.ok(sends[0][2].agent instanceof https.Agent);
  assert.ok(sends[0][2].timeout > 0 && sends[0][2].timeout <= 10000);
});
const badKeys = { missing: {}, numeric: { p256dh: 12, auth: keys.auth }, shortAuth: { ...keys, auth: "AA" }, longAuth: { ...keys, auth: randomBytes(17).toString("base64url") }, malformedBase64: { ...keys, auth: keys.auth + "!" }, incorrectPadding: { ...keys, auth: keys.auth + "=" }, shortCurve: { ...keys, p256dh: "AA" }, invalidCurve: { ...keys, p256dh: Buffer.alloc(65).toString("base64url") } };
for (const [name, malformedKeys] of Object.entries(badKeys)) test(`malformed ${name} keys cannot be stored or delivered`, async t => {
  let writes = 0, sends = 0;
  t.mock.method(pg.Pool.prototype, "query", async sql => { if (sql.startsWith("INSERT")) writes++; return { rows: sql.startsWith("SELECT") ? [{ id: "invalid", endpoint: good, keys: malformedKeys }] : [] }; });
  t.mock.method(webpush, "sendNotification", async () => { sends++; return {}; });
  t.mock.method(console, "warn", () => {});
  assert.equal((await route("/subscribe", { endpoint: good, keys: malformedKeys })).status, 400);
  assert.equal((await sendPush("owner", {})).delivered, false);
  assert.equal(writes, 0); assert.equal(sends, 0);
});
async function deliveryAgent(t) {
  let options;
  t.mock.method(pg.Pool.prototype, "query", async () => ({ rows: [{ id: "valid", endpoint: good, keys }] }));
  t.mock.method(webpush, "sendNotification", async (_sub, _payload, value) => { options = value; return {}; });
  await sendPush("owner", {});
  return options.agent;
}
for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::1"]) test(`approved service DNS cannot connect to ${address}`, async t => {
  const agent = await deliveryAgent(t);
  t.mock.method(dns, "lookup", (_host, _options, callback) => callback(null, [{ address, family: address.includes(":") ? 6 : 4 }]));
  await assert.rejects(new Promise((resolve, reject) => agent.options.lookup("fcm.googleapis.com", { all: true }, (error, value) => error ? reject(error) : resolve(value))), error => error.code === "PUSH_DESTINATION_REJECTED");
});
test("public DNS result is the address handed directly to the socket, without a second lookup", async t => {
  const agent = await deliveryAgent(t); let lookups = 0;
  const addresses = [{ address: "142.250.190.78", family: 4 }, { address: "2607:f8b0:4009:80b::200e", family: 6 }];
  t.mock.method(dns, "lookup", (_host, _options, callback) => { lookups++; callback(null, addresses); });
  const result = await new Promise((resolve, reject) => agent.options.lookup("fcm.googleapis.com", { all: true }, (error, value) => error ? reject(error) : resolve(value)));
  assert.deepEqual(result, addresses); assert.equal(lookups, 1);
});
test("a service redirect response never triggers a second request", async t => {
  t.mock.method(pg.Pool.prototype, "query", async () => ({ rows: [{ id: "valid", endpoint: good, keys }] }));
  let calls = 0;
  t.mock.method(console, "warn", () => {});
  t.mock.method(https, "request", (options, callback) => {
    calls++; assert.equal(options.hostname, "fcm.googleapis.com");
    const request = new EventEmitter(); request.write = () => {}; request.destroy = () => {};
    request.end = () => queueMicrotask(() => { const response = new EventEmitter(); response.statusCode = 307; response.headers = { location: "https://127.0.0.1/private" }; callback(response); response.emit("end"); });
    return request;
  });
  assert.equal((await sendPush("owner", { title: "fixture" })).delivered, false);
  assert.equal(calls, 1);
});
test("unsubscribe remains owner-scoped and unknown endpoints are idempotent", async t => {
  let statement, params;
  t.mock.method(pg.Pool.prototype, "query", async (sql, values) => { statement = sql; params = values; return { rows: [] }; });
  assert.equal((await route("/unsubscribe", { endpoint: good })).status, 200);
  assert.match(statement, /user_id = \$2/); assert.deepEqual(params, [good, "owner", good]);
});
test("unsubscribe failure is not reported as success and anonymous subscription mutation is denied", async t => {
  t.mock.method(pg.Pool.prototype, "query", async () => { throw Error("local database failure"); });
  assert.equal((await route("/unsubscribe", { endpoint: good })).status, 500);
  assert.equal((await route("/subscribe", { endpoint: good, keys }, null)).status, 401);
});
test("HTTPS port 443 and encoded host spelling are canonicalized before storage and removal", async t => {
  const original = "https://%66cm.googleapis.com:443/fcm/send/local-fixture", statements = [];
  t.mock.method(pg.Pool.prototype, "query", async (sql, params) => { statements.push({ sql, params }); return { rows: [] }; });
  assert.equal((await route("/subscribe", { endpoint: original, keys })).status, 200);
  assert.equal(statements[0].params[1], good);
  assert.equal((await route("/unsubscribe", { endpoint: original })).status, 200);
  assert.deepEqual(statements[1].params, [original, "owner", good]);
});
test("a mixed public/private DNS answer fails closed", async t => {
  const agent = await deliveryAgent(t);
  t.mock.method(dns, "lookup", (_host, _options, callback) => callback(null, [{ address: "142.250.190.78", family: 4 }, { address: "127.0.0.1", family: 4 }]));
  await assert.rejects(new Promise((resolve, reject) => agent.options.lookup("fcm.googleapis.com", { all: true }, (error, value) => error ? reject(error) : resolve(value))), error => error.code === "PUSH_DESTINATION_REJECTED");
});
test("a requested address family returns one vetted address and DNS errors are retained", async t => {
  const agent = await deliveryAgent(t);
  t.mock.method(dns, "lookup", (_host, _options, callback) => callback(null, [{ address: "142.250.190.78", family: 4 }, { address: "2607:f8b0:4009:80b::200e", family: 6 }]));
  const result = await new Promise((resolve, reject) => agent.options.lookup("fcm.googleapis.com", { family: 6 }, (error, address, family) => error ? reject(error) : resolve({ address, family })));
  assert.deepEqual(result, { address: "2607:f8b0:4009:80b::200e", family: 6 });
  t.mock.method(dns, "lookup", (_host, _options, callback) => callback(Object.assign(Error("fixture DNS failure"), { code: "ENOTFOUND" })));
  await assert.rejects(new Promise((resolve, reject) => agent.options.lookup("fcm.googleapis.com", {}, (error, value) => error ? reject(error) : resolve(value))), error => error.code === "ENOTFOUND");
});
test("invalid stored rows cannot reach https.request and their diagnostic contains no endpoint or payload", async t => {
  const logs = [], payload = "private-notification-fixture";
  t.mock.method(pg.Pool.prototype, "query", async () => ({ rows: [{ id: "invalid", endpoint: "https://127.0.0.1/private-capability", keys }] }));
  let requests = 0;
  t.mock.method(https, "request", () => { requests++; throw Error("network must not be invoked"); });
  t.mock.method(console, "warn", (...args) => logs.push(args));
  assert.equal((await sendPush("owner", { title: payload })).delivered, false);
  assert.equal(requests, 0); assert.equal(logs.length, 1);
  const diagnostic = JSON.stringify(logs); assert.match(diagnostic, /destination_rejected/);
  for (const secret of [payload, "127.0.0.1", "private-capability", keys.p256dh, keys.auth]) assert.ok(!diagnostic.includes(secret));
});
test("real Web Push encryption reaches only the canonical HTTPS provider with its guarded agent", async t => {
  t.mock.method(pg.Pool.prototype, "query", async () => ({ rows: [{ id: "valid", endpoint: good, keys }] }));
  let requests = 0;
  t.mock.method(https, "request", (options, callback) => {
    requests++; assert.equal(options.hostname, "fcm.googleapis.com"); assert.ok(options.agent instanceof https.Agent);
    assert.equal(options.agent.maxTotalSockets, 4); assert.equal(options.method, "POST"); assert.equal(options.path, "/fcm/send/local-fixture");
    const request = new EventEmitter(); request.write = body => assert.ok(Buffer.isBuffer(body)); request.destroy = () => {};
    request.end = () => queueMicrotask(() => { const response = new EventEmitter(); response.statusCode = 201; response.headers = {}; callback(response); response.emit("end"); });
    return request;
  });
  assert.equal((await sendPush("owner", { title: "fixture" })).delivered, true); assert.equal(requests, 1);
});
test("an expired subscription is deleted only for the requested owner", async t => {
  let deletion;
  t.mock.method(pg.Pool.prototype, "query", async (sql, params) => { if (sql.startsWith("DELETE")) deletion = { sql, params }; return { rows: sql.startsWith("SELECT") ? [{ id: "expired", endpoint: good, keys }] : [] }; });
  t.mock.method(webpush, "sendNotification", async () => { throw Object.assign(Error("expired fixture"), { statusCode: 410 }); });
  assert.equal((await sendPush("owner", {})).delivered, false);
  assert.match(deletion.sql, /user_id = \$2/); assert.deepEqual(deletion.params, ["expired", "owner"]);
});
test("valid optional base64url padding is normalized before storage", async t => {
  let stored;
  t.mock.method(pg.Pool.prototype, "query", async (_sql, params) => { stored = JSON.parse(params[2]); return { rows: [] }; });
  assert.equal((await route("/subscribe", { endpoint: good, keys: { p256dh: keys.p256dh + "=", auth: keys.auth + "==" } })).status, 200);
  assert.deepEqual(stored, keys);
});
test("stalled DNS resolves once with a bounded error and ignores a late answer", async t => {
  const agent = await deliveryAgent(t); let lateAnswer, calls = 0;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(dns, "lookup", (_host, _options, callback) => { lateAnswer = callback; });
  const pending = new Promise((resolve, reject) => agent.options.lookup("fcm.googleapis.com", {}, (error, value) => { calls++; error ? reject(error) : resolve(value); }));
  t.mock.timers.tick(10000);
  await assert.rejects(pending, error => error.code === "PUSH_DESTINATION_REJECTED");
  lateAnswer(null, [{ address: "142.250.190.78", family: 4 }]);
  assert.equal(calls, 1);
});

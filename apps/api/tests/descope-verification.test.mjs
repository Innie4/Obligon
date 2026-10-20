import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { env } from "../src/config/env.js";
import { normalizeDescopeRecipient, startDescopeVerification, verifyDescopeVerification } from "../src/lib/descope-verification.js";

let requests, restore;
beforeEach(() => {
  const fetch = globalThis.fetch;
  const names = ["DESCOPE_PROJECT_ID", "DESCOPE_AUTH_MANAGEMENT_KEY", "PROVIDER_HTTP_TIMEOUT_MS", "PROVIDER_RETRY_COUNT"];
  const previous = names.map(name => [name, Object.hasOwn(env, name), env[name]]);
  restore = () => {
    globalThis.fetch = fetch;
    for (const [name, present, value] of previous) {
      if (present) env[name] = value;
      else delete env[name];
    }
  };
  Object.assign(env, { DESCOPE_PROJECT_ID: "fixture-project", DESCOPE_AUTH_MANAGEMENT_KEY: "fixture-auth-key", PROVIDER_HTTP_TIMEOUT_MS: 10, PROVIDER_RETRY_COUNT: 3 });
  requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    return Response.json({});
  };
});
afterEach(() => restore());

test("stalled response bodies are cancelled without retrying contact operations", { timeout: 1000 }, async () => {
  for (const operation of [
    () => startDescopeVerification({ channel: "email", to: email }),
    () => verifyDescopeVerification({ channel: "sms", to: phone, code: "123456" })
  ]) {
    let calls = 0, cancellations = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('{"user":')); },
        cancel() { cancellations++; }
      }));
    };
    const result = await operation();
    assert.equal(result.delivered ?? result.ok, false);
    assert.equal(calls, 1);
    assert.equal(cancellations, 1);
  }
});
test("oversized response bodies are cancelled and cannot supply contact proof", async () => {
  let calls = 0, cancellations = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(65_537).fill(32)); },
      cancel() { cancellations++; }
    }));
  };
  assert.deepEqual(await verifyDescopeVerification({ channel: "email", to: email, code: "123456" }), { ok: false, reason: "unavailable" });
  assert.equal(calls, 1);
  assert.equal(cancellations, 1);
});
function respond(body, status = 200) {
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    return Response.json(body, { status });
  };
}
const email = "fixture@example.invalid", phone = "+2348012345678";

test("recipient normalization preserves exact Nigerian numbers and canonical email", () => {
  assert.equal(normalizeDescopeRecipient("email", " Fixture@Example.Invalid "), email);
  for (const value of ["08012345678", "8012345678", "801 234-5678", "0801 234 5678", "(0801)-234-5678", "+234 (801) 234-5678", phone]) {
    assert.equal(normalizeDescopeRecipient("sms", value), phone);
  }
});
test("recipient normalization rejects other countries, ambiguous numbers and malformed types", () => {
  for (const value of ["+15555555555", "+447700900000", "+23408012345678", "1234567890", "801234567", "80123456789", "0801234567", "080123456789", "0801234567x", "", null, [phone], { phone }]) {
    assert.throws(() => normalizeDescopeRecipient("sms", value), { status: 400 });
  }
  for (const value of ["bad-email", "a@@example.invalid", "a b@example.invalid", "", null, [email], { email }]) {
    assert.throws(() => normalizeDescopeRecipient("email", value), { status: 400 });
  }
  assert.throws(() => normalizeDescopeRecipient("voice", phone), { status: 400 });
});
test("starting either channel uses only the official endpoint, bound recipient and backend management credential", async () => {
  for (const [channel, to] of [["email", " Fixture@Example.Invalid "], ["sms", "0801 234 5678"]]) {
    const result = await startDescopeVerification({ channel, to });
    assert.deepEqual(result, { delivered: true, simulated: false });
    const sent = requests.at(-1);
    assert.equal(sent.url, `https://api.descope.com/v1/auth/otp/signup-in/${channel}`);
    assert.equal(sent.options.method, "POST");
    assert.equal(sent.options.headers.Authorization, "Bearer fixture-project:fixture-auth-key");
    assert.equal(sent.options.headers["Content-Type"], "application/json");
    assert.deepEqual(sent.body, { loginId: channel === "email" ? email : phone });
  }
});
test("start accepts documented optional response fields without treating them as verified contact proof", async () => {
  respond({ maskedEmail: "f***@example.invalid", verificationAttempts: 3 });
  assert.deepEqual(await startDescopeVerification({ channel: "email", to: email }), { delivered: true, simulated: false });
  respond({ maskedPhone: "+234******78", verificationAttempts: 3 });
  assert.deepEqual(await startDescopeVerification({ channel: "sms", to: phone }), { delivered: true, simulated: false });
});
test("missing either credential fails closed without a request", async () => {
  for (const name of ["DESCOPE_PROJECT_ID", "DESCOPE_AUTH_MANAGEMENT_KEY"]) {
    const previous = env[name];
    env[name] = "";
    assert.equal((await startDescopeVerification({ channel: "email", to: email })).delivered, false);
    assert.deepEqual(await verifyDescopeVerification({ channel: "email", to: email, code: "123456" }), { ok: false, reason: "unavailable" });
    env[name] = previous;
  }
  assert.equal(requests.length, 0);
});
test("invalid start recipients never reach the provider", async () => {
  for (const args of [{ channel: "sms", to: "+15555555555" }, { channel: "email", to: [email] }, { channel: "voice", to: phone }]) {
    const result = await startDescopeVerification(args);
    assert.equal(result.delivered, false);
    assert.equal(result.simulated, false);
    assert.equal(result.code, "DESCOPE_INVALID_RECIPIENT");
  }
  assert.equal(requests.length, 0);
});
test("start rejects malformed, error-shaped and undocumented success bodies", async () => {
  for (const body of [null, [], "accepted", { sent: true }, { maskedEmail: 42 }, { verificationAttempts: -1 }, { errorCode: "E032001" }]) {
    respond(body);
    assert.equal((await startDescopeVerification({ channel: "email", to: email })).delivered, false);
  }
  respond({}, 201);
  assert.equal((await startDescopeVerification({ channel: "email", to: email })).delivered, false);
});
test("verify accepts only the requested contact proof and discards provider tokens", async () => {
  for (const [channel, to, field, verified] of [["email", email, "email", "verifiedEmail"], ["sms", phone, "phone", "verifiedPhone"]]) {
    respond({ user: { [field]: to, [verified]: true }, sessionJwt: "never-return-session", refreshJwt: "never-return-refresh" });
    const result = await verifyDescopeVerification({ channel, to, code: "012345" });
    assert.deepEqual(result, { ok: true });
    const sent = requests.at(-1);
    assert.equal(sent.url, `https://api.descope.com/v1/auth/otp/verify/${channel}`);
    assert.deepEqual(sent.body, { loginId: to, code: "012345" });
    assert.doesNotMatch(JSON.stringify(result), /never-return/);
  }
});
test("verify fails closed for the wrong recipient, wrong channel flag, test user or malformed success", async () => {
  const invalid = [null, [], {}, { user: null }, { user: [] },
    { user: { email: "other@example.invalid", verifiedEmail: true } },
    { user: { email, verifiedEmail: false, verifiedPhone: true } },
    { user: { email, verifiedEmail: "true" } },
    { user: { email, verifiedEmail: true, test: true } },
    { user: { email, verifiedEmail: true, test: "false" } },
    { user: { email, verifiedEmail: true, test: null } },
    { user: { email: " Fixture@Example.Invalid ", verifiedEmail: true } },
    { user: { email, verifiedEmail: true }, errorCode: "E061102" }];
  for (const body of invalid) {
    respond(body);
    assert.deepEqual(await verifyDescopeVerification({ channel: "email", to: email, code: "123456" }), { ok: false, reason: "unavailable" });
  }
  for (const user of [{ phone: "+2348099999999", verifiedPhone: true }, { phone, verifiedEmail: true }, { phone: "08012345678", verifiedPhone: true }, { phone, verifiedPhone: true, test: true }]) {
    respond({ user });
    assert.deepEqual(await verifyDescopeVerification({ channel: "sms", to: phone, code: "123456" }), { ok: false, reason: "unavailable" });
  }
});
test("invalid six-digit code inputs and invalid verify recipients cause no network request", async () => {
  for (const code of ["12345", "1234567", "abcdef", " 123456", 123456, null, ["123456"]]) {
    assert.deepEqual(await verifyDescopeVerification({ channel: "email", to: email, code }), { ok: false, reason: "mismatch" });
  }
  assert.deepEqual(await verifyDescopeVerification({ channel: "sms", to: "+15555555555", code: "123456" }), { ok: false, reason: "unavailable" });
  assert.equal(requests.length, 0);
});
test("only documented invalid, expired and exhausted OTP errors classify as code failures", async () => {
  for (const [errorCode, reason] of [["E061102", "mismatch"], ["E061104", "expired"], ["E061103", "expired"]]) {
    respond({ errorCode, errorDescription: "Provider detail is not exposed" }, 401);
    assert.deepEqual(await verifyDescopeVerification({ channel: "email", to: email, code: "123456" }), { ok: false, reason });
  }
  for (const [body, status] of [[{ errorCode: "E071001" }, 401], [{ errorCode: "E011003" }, 400], [{ errorCode: "E061102" }, 503], [{ errorCode: "E061102" }, 429], [{ errorCode: "E061102" }, 200]]) {
    respond(body, status);
    assert.deepEqual(await verifyDescopeVerification({ channel: "email", to: email, code: "123456" }), { ok: false, reason: "unavailable" });
  }
});
test("non-JSON provider responses fail closed", async () => {
  globalThis.fetch = async () => new Response("<html>Provider unavailable</html>", { status: 200 });
  assert.equal((await startDescopeVerification({ channel: "email", to: email })).delivered, false);
  assert.deepEqual(await verifyDescopeVerification({ channel: "email", to: email, code: "123456" }), { ok: false, reason: "unavailable" });
});
test("server errors and transport failures never retry POSTs or expose provider details", async () => {
  for (const operation of [() => startDescopeVerification({ channel: "email", to: email }), () => verifyDescopeVerification({ channel: "email", to: email, code: "123456" })]) {
    respond({ errorCode: "E125004", errorDescription: `unsafe ${email} fixture-auth-key` }, 503);
    const before = requests.length;
    const result = await operation();
    assert.equal(requests.length - before, 1);
    assert.doesNotMatch(JSON.stringify(result), /unsafe|fixture-auth-key|fixture@example/);
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("unsafe transport detail"); };
    assert.doesNotMatch(JSON.stringify(await operation()), /unsafe/);
    assert.equal(calls, 1);
  }
});
test("provider timeout aborts once and reports unavailable", async () => {
  let calls = 0, aborts = 0;
  globalThis.fetch = async (_url, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => {
      aborts++;
      reject(Object.assign(new Error("timeout"), { name: "AbortError" }));
    }, { once: true }));
  };
  assert.deepEqual(await verifyDescopeVerification({ channel: "sms", to: phone, code: "123456" }), { ok: false, reason: "unavailable" });
  assert.equal(calls, 1);
  assert.equal(aborts, 1);
});

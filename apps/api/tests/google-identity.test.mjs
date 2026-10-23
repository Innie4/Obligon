import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyGoogleIdentityToken } from "../src/lib/google-identity.js";

const clientId = "obligon-test.apps.googleusercontent.com";
const nonce = randomBytes(32).toString("base64url");
const subject = "123456789012345678901";
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = { ...await exportJWK(publicKey), kid: "test-google-rsa", use: "sig", alg: "RS256" };
const keyResolver = createLocalJWKSet({ keys: [jwk] });

async function token(changes = {}, { signingKey = privateKey, header = {} } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ iss: "https://accounts.google.com", sub: subject, aud: clientId, iat: now, exp: now + 600, nonce, ...changes })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid, ...header })
    .sign(signingKey);
}

const verify = (credential, options = {}) => verifyGoogleIdentityToken(credential, { clientId, nonce, keyResolver, ...options });

test("Google identity uses a verified issuer and subject without adopting unrelated claims", async () => {
  const identity = await verify(await token({ email: "display@example.com", email_verified: true, name: "Untrusted display name", role: "admin" }));
  assert.deepEqual(identity, { issuer: "https://accounts.google.com", subject, email: "display@example.com", emailVerified: true });
});

test("the documented legacy Google issuer normalizes to the same identity", async () => {
  assert.deepEqual(await verify(await token({ iss: "accounts.google.com" })), { issuer: "https://accounts.google.com", subject });
});

test("email is optional and never substitutes for the Google subject", async () => {
  assert.deepEqual(await verify(await token()), { issuer: "https://accounts.google.com", subject });
  await assert.rejects(verify(await token({ sub: undefined, email: "display@example.com", email_verified: true })));
});

test("tampered payloads and signatures from another signing key are rejected", async () => {
  const parts = (await token()).split(".");
  parts[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], "base64url")), sub: "another-subject" })).toString("base64url");
  await assert.rejects(verify(parts.join(".")));
  const other = await generateKeyPair("RS256");
  await assert.rejects(verify(await token({}, { signingKey: other.privateKey })));
});

test("only RS256 is accepted, including when a different algorithm has a valid signature", async () => {
  await assert.rejects(verify(await token({}, { signingKey: randomBytes(32), header: { alg: "HS256" } })));
  const unsigned = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(JSON.stringify({ iss: "https://accounts.google.com", sub: subject, aud: clientId, exp: 9999999999, nonce })).toString("base64url")}.`;
  await assert.rejects(verify(unsigned));
});

test("issuer, audience, expiry and nonce are mandatory and must match", async () => {
  const badClaims = [
    { iss: "https://attacker.example" }, { iss: undefined },
    { aud: "another-client.apps.googleusercontent.com" }, { aud: undefined },
    { exp: Math.floor(Date.now() / 1000) - 1 }, { exp: undefined }, { exp: "9999999999" },
    { nonce: "another-nonce" }, { nonce: undefined }, { nonce: [nonce] }
  ];
  for (const claims of badClaims) await assert.rejects(verify(await token(claims)));
});

test("an authorized party must match and is required for multiple audiences", async () => {
  assert.equal((await verify(await token({ azp: clientId }))).subject, subject);
  assert.equal((await verify(await token({ aud: [clientId, "another-client"], azp: clientId }))).subject, subject);
  for (const claims of [{ azp: "another-client" }, { azp: [clientId] }, { aud: [clientId, "another-client"] }]) {
    await assert.rejects(verify(await token(claims)));
  }
});

test("subjects must be nonempty ASCII identifiers within the documented length", async () => {
  for (const sub of [undefined, null, 123, [], "", " with-space", "with space", "with\ncontrol", "é", "x".repeat(256)]) {
    await assert.rejects(verify(await token({ sub })));
  }
  assert.equal((await verify(await token({ sub: "x".repeat(255) }))).subject.length, 255);
});

test("a provided email must be well formed and explicitly verified", async () => {
  for (const claims of [
    { email: "display@example.com" }, { email: "display@example.com", email_verified: false },
    { email: "display@example.com", email_verified: "true" }, { email: "not-an-email", email_verified: true },
    { email: ["display@example.com"], email_verified: true }, { email: " display@example.com", email_verified: true }
  ]) await assert.rejects(verify(await token(claims)));
});

test("missing configuration, malformed credentials and nonfunction resolver overrides fail closed", async () => {
  const credential = await token();
  for (const options of [{ clientId: "" }, { nonce: "" }, { keyResolver: {} }, { clientId: null }, { nonce: null }]) {
    await assert.rejects(verify(credential, options));
  }
  for (const invalid of [undefined, null, {}, "", "not-a-jwt", "x".repeat(16385)]) await assert.rejects(verify(invalid));
});

test("the default resolver uses Google's fixed JWKS URL, caches keys and ignores token key URLs", async (t) => {
  const fetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetch; });
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    requests += 1;
    assert.equal(String(url), "https://www.googleapis.com/oauth2/v3/certs");
    assert.equal(options.method, "GET");
    return Response.json({ keys: [jwk] });
  };
  const credential = await token({}, { header: { jku: "https://attacker.example/keys", x5u: "https://attacker.example/cert" } });
  const options = { clientId, nonce };
  assert.equal((await verifyGoogleIdentityToken(credential, options)).subject, subject);
  assert.equal((await verifyGoogleIdentityToken(credential, options)).subject, subject);
  await assert.rejects(verifyGoogleIdentityToken(await token({}, { header: { kid: "unknown-key" } }), options));
  assert.equal(requests, 1);
});

test("an unavailable Google key endpoint fails closed without retrying authentication", async (t) => {
  const { verifyGoogleIdentityToken: isolatedVerify } = await import("../src/lib/google-identity.js?unavailable-keys");
  const fetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = fetch; });
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return Response.json({ error: "unavailable" }, { status: 503 }); };
  await assert.rejects(isolatedVerify(await token(), { clientId, nonce }));
  assert.equal(requests, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { naira, fmtDate, fmtDateTime, relativeTime, reference, toCsv, maskPan, initials } from "../src/lib/format.js";
import { hashPassword, verifyPassword, signAccessToken, verifyAccessToken, randomToken, hashPin, verifyPin } from "../src/lib/security.js";
import { HttpError, badRequest, unauthorized, forbidden, notFound } from "../src/lib/errors.js";
import { providerStatus } from "../src/config/env.js";
import { createApp } from "../src/app.js";

test("naira formatting converts kobo to formatted currency string", () => {
  assert.equal(naira(0), "₦0");
  assert.equal(naira(100000), "₦1,000");
  assert.equal(naira(48500000), "₦485,000");
  assert.equal(naira(1500000000), "₦15,000,000");
});

test("reference generator creates prefixed random reference strings", () => {
  const ref1 = reference("TX");
  const ref2 = reference("PY");
  assert.ok(ref1.startsWith("TX-"));
  assert.ok(ref2.startsWith("PY-"));
  assert.notEqual(ref1, ref2);
});

test("maskPan masks credit/debit card numbers safely", () => {
  assert.equal(maskPan("1234567812345678"), "•••• •••• •••• 5678");
  assert.equal(maskPan("4242"), "•••• •••• •••• 4242");
  assert.equal(maskPan(""), "•••• •••• •••• 0000");
});

test("initials extracts uppercase initials", () => {
  assert.equal(initials("Femi Balogun"), "FB");
  assert.equal(initials("Obligon Enterprise"), "OE");
  assert.equal(initials("Obligon"), "O");
  assert.equal(initials(""), "?");
});

test("toCsv converts array of objects into RFC-compliant CSV text", () => {
  const data = [
    { name: "Alpha", amount: 1500 },
    { name: "Beta, Co.", amount: 2500 }
  ];
  const csv = toCsv(data);
  assert.ok(csv.includes("name,amount"));
  assert.ok(csv.includes("Alpha,1500"));
  assert.ok(csv.includes('"Beta, Co.",2500'));
});

test("security: hashPassword and verifyPassword work correctly", async () => {
  const password = "SuperSecretPassword#123";
  const hash = await hashPassword(password);
  assert.ok(hash.startsWith("$2"));
  const match = await verifyPassword(password, hash);
  assert.equal(match, true);
  const mismatch = await verifyPassword("WrongPassword", hash);
  assert.equal(mismatch, false);
});

test("security: signAccessToken and verifyAccessToken roundtrip JWT", () => {
  const user = { id: "usr-123", role: "customer" };
  const org = { id: "org-456", type: "company" };
  const token = signAccessToken(user, org);
  assert.ok(typeof token === "string");
  const decoded = verifyAccessToken(token);
  assert.equal(decoded.sub, user.id);
  assert.equal(decoded.role, user.role);
  assert.equal(decoded.org, org.id);
});

test("security: PIN hashing and verification work correctly", async () => {
  const pin = "1234";
  const hash = await hashPin(pin);
  assert.equal(await verifyPin(pin, hash), true);
  assert.equal(await verifyPin("9999", hash), false);
});

test("security: randomToken produces non-empty string of expected size", () => {
  const token = randomToken(16);
  assert.equal(typeof token, "string");
  assert.ok(token.length >= 16);
});

test("errors: HttpError helpers create correct status codes and messages", () => {
  const b = badRequest("Invalid input");
  assert.equal(b.status, 400);
  assert.equal(b.message, "Invalid input");

  const u = unauthorized("Sign in required");
  assert.equal(u.status, 401);

  const f = forbidden("Access denied");
  assert.equal(f.status, 403);

  const n = notFound("Resource not found");
  assert.equal(n.status, 404);
});

test("config: providerStatus reports availability of integrated services", () => {
  const status = providerStatus();
  assert.equal(typeof status, "object");
  assert.ok("supabase" in status);
  assert.ok("supabaseAuth" in status);
  assert.ok("storage" in status);
  assert.ok("sudo" in status);
  assert.ok("paystack" in status);
  assert.ok("email" in status);
  assert.ok("sms" in status);
  assert.ok("push" in status);
  assert.ok("maps" in status);
});

test("app: createApp initializes Express application with routes mounted", () => {
  const app = createApp();
  assert.ok(app);
  assert.equal(typeof app.listen, "function");
});

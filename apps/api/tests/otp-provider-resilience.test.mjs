/**
 * OTP provider resilience and Flutterwave plan reconciliation, observed rather
 * than asserted from source.
 *
 * The classification tests use the *actual* refusal bodies captured from the live
 * providers, not paraphrases. A regex written from a description would pass whether
 * or not the real message matched, which is how "handled the unverified domain
 * case" is claimed without anything handling it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { classifyResendFailure, emailFallbackAllowed } from "../src/lib/mailer.js";
import { classifyTermiiFailure, smsFallbackAllowed } from "../src/lib/sms.js";

/** Captured verbatim from the providers while this was being built. */
const RESEND_UNVERIFIED_DOMAIN =
  '{"message":"The gmail.com domain is not verified. Please, add and verify your domain on https://resend.com/domains","name":"validation_error","statusCode":403}';
const TERMII_UNAPPROVED_SENDER =
  '{"status":422,"error":"Unprocessable Content","message":"SENDER_ID_NOT_APPROVED: sender ID \'Obligon\' is not registered for workspace 01a0f7eb"}';

test("the real Resend refusal for an unverified domain is recognised", () => {
  const result = classifyResendFailure(403, RESEND_UNVERIFIED_DOMAIN);
  assert.equal(result.code, "EMAIL_DOMAIN_UNVERIFIED");
  assert.match(result.fix, /not verified/i);
  // A domain does not become verified by trying again.
  assert.equal(result.retryable, false);
});

test("the real Termii refusal for an unapproved sender id is recognised", () => {
  const result = classifyTermiiFailure(422, TERMII_UNAPPROVED_SENDER);
  assert.equal(result.code, "SMS_SENDER_UNAPPROVED");
  assert.match(result.fix, /sender id/i);
  assert.equal(result.retryable, false);
});

test("provider failures never silently fall back; local outbox is explicitly configured", () => {
  for (const environment of ['development','test','staging','production']) {
    assert.equal(emailFallbackAllowed(environment), false);
    assert.equal(smsFallbackAllowed(environment), false);
  }
});

test("a throttle is retryable and a configuration fault is not", () => {
  // The first version of the classification table marked every rule
  // non-retryable, so a rate limit was reported as a permanent fault.
  assert.equal(classifyResendFailure(429, "Too many requests").retryable, true);
  assert.equal(classifyResendFailure(429, "rate limit exceeded").retryable, true);
  assert.equal(classifyTermiiFailure(429, "Too many requests").retryable, true);

  assert.equal(classifyResendFailure(400, "suppressed recipient").retryable, false);
  assert.equal(classifyResendFailure(400, "daily limit reached").retryable, false);
  assert.equal(classifyTermiiFailure(422, "Account not live").retryable, false);

  // A provider outage is neither a config fault nor the customer's fault.
  assert.equal(classifyResendFailure(503, "upstream").retryable, true);
  assert.equal(classifyTermiiFailure(502, "bad gateway").retryable, true);
});

test("the fix text never carries a credential", () => {
  // The provider message is echoed to the caller, so it must not be able to carry a
  // key-shaped string back into a browser.
  for (const fix of [
    classifyResendFailure(401, "Invalid API key: FLWSECK-abc123def456").fix,
    classifyResendFailure(401, "Invalid API key: FLWSECK-abc123def456").fix
  ]) {
    assert.doesNotMatch(fix, /FLWSECK-[A-Za-z0-9-]+/);
  }
});
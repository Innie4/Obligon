import test from "node:test";
import assert from "node:assert/strict";
import { env, configurationWarnings, providerStatus } from "../src/config/env.js";

function config(t, overrides) {
  const names = ["VERIFICATION_PROVIDER", "DESCOPE_PROJECT_ID", "DESCOPE_AUTH_MANAGEMENT_KEY", "RESEND_API_KEY", "TERMII_API_KEY"];
  const previous = Object.fromEntries(names.map(name => [name, env[name]]));
  Object.assign(env, { VERIFICATION_PROVIDER: "local", DESCOPE_PROJECT_ID: "", DESCOPE_AUTH_MANAGEMENT_KEY: "", RESEND_API_KEY: "", TERMII_API_KEY: "" }, overrides);
  t.after(() => Object.assign(env, previous));
}

test("Descope verification requires both project and authentication credentials", t => {
  config(t, { VERIFICATION_PROVIDER: "descope", DESCOPE_PROJECT_ID: "fixture-project" });
  assert.equal(providerStatus().emailVerification, false);
  assert.equal(providerStatus().phoneVerification, false);
  assert.ok(configurationWarnings().some(message => message.includes("DESCOPE_AUTH_MANAGEMENT_KEY")));
});

test("managed contact verification does not claim that generic email and SMS are configured", t => {
  config(t, { VERIFICATION_PROVIDER: "descope", DESCOPE_PROJECT_ID: "fixture-project", DESCOPE_AUTH_MANAGEMENT_KEY: "fixture-server-key" });
  const status = providerStatus();
  assert.equal(status.emailVerification, true);
  assert.equal(status.phoneVerification, true);
  assert.equal(status.email, false);
  assert.equal(status.sms, false);
  assert.equal(configurationWarnings().some(message => message.includes("required for Descope")), false);
});

test("unused Descope credentials do not change application-generated verification status", t => {
  config(t, { DESCOPE_PROJECT_ID: "fixture-project", DESCOPE_AUTH_MANAGEMENT_KEY: "fixture-server-key", RESEND_API_KEY: "fixture-email-key" });
  assert.equal(providerStatus().emailVerification, true);
  assert.equal(providerStatus().phoneVerification, false);
});

test("application-generated verification continues using its own channel configuration", t => {
  config(t, { TERMII_API_KEY: "fixture-sms-key" });
  assert.equal(providerStatus().emailVerification, false);
  assert.equal(providerStatus().phoneVerification, true);
  assert.equal(configurationWarnings().some(message => message.includes("required for Descope")), false);
});

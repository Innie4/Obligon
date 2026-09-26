/**
 * Deployment-config parity.
 *
 * The Flutterwave keys were present in .env.example but missing from
 * render.yaml, so the production API started with no payment processor and every
 * checkout failed with a bare 503. Nothing caught it because both files were
 * valid on their own.
 *
 * This asserts every variable the deployment needs to declare is actually
 * declared, so the two files cannot drift apart again.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..", "..");
const renderYaml = fs.readFileSync(path.join(repoRoot, "render.yaml"), "utf8");

/** Variable names declared in render.yaml, either inline or via sync: false. */
function declaredKeys(yaml) {
  const keys = new Set();
  for (const m of yaml.matchAll(/^\s*-\s*key:\s*([A-Z0-9_]+)\s*$/gm)) keys.add(m[1]);
  return keys;
}

/** Variable names assigned a literal value (not `sync: false`). */
function literalKeys(yaml) {
  const keys = new Set();
  for (const m of yaml.matchAll(/^\s*-\s*key:\s*([A-Z0-9_]+)\s*\n\s*value:\s*(.+)$/gm)) keys.add(m[1]);
  return keys;
}

const declared = declaredKeys(renderYaml);
const literal = literalKeys(renderYaml);

// Variables without which the API cannot boot, authenticate users, or run
// migrations. These must be declared in the deployment config.
const REQUIRED = [
  "DATABASE_URL",
  "APP_URL",
  "CORS_ORIGINS",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY"
];

// Variables without which payments silently do not work. The regression that
// motivated this file: each of these was absent from render.yaml.
const REQUIRED_FOR_PAYMENTS = [
  "PAYMENT_PROVIDER",
  "NEXT_PUBLIC_PAYMENT_PROVIDER",
  "FLW_PUBLIC_KEY",
  "FLW_SECRET_KEY",
  "FLW_SECRET_HASH"
];

test("render.yaml declares everything the API needs to boot", () => {
  const missing = REQUIRED.filter((k) => !declared.has(k));
  assert.deepEqual(missing, [], `render.yaml is missing: ${missing.join(", ")}`);
});

test("render.yaml declares the payment processor configuration", () => {
  const missing = REQUIRED_FOR_PAYMENTS.filter((k) => !declared.has(k));
  assert.deepEqual(
    missing,
    [],
    `render.yaml is missing payment vars: ${missing.join(", ")}. ` +
      "Without them the deployed API starts with no provider and every checkout returns 503."
  );
});

test("secrets are never given literal values in render.yaml", () => {
  const mustBeSyncFalse = [
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FLW_SECRET_KEY",
    "FLW_SECRET_HASH",
    "FLW_ENCRYPTION_KEY",
    "PAYSTACK_SECRET_KEY",
    "SUDO_SECRET_API_KEY"
  ];
  const leaked = mustBeSyncFalse.filter((k) => literal.has(k));
  assert.deepEqual(leaked, [], `these must use sync: false, not a literal value: ${leaked.join(", ")}`);
});

test("the payment provider and its browser mirror agree", () => {
  const provider = renderYaml.match(/- key: PAYMENT_PROVIDER\s*\n\s*value:\s*(\S+)/)?.[1];
  const mirror = renderYaml.match(/- key: NEXT_PUBLIC_PAYMENT_PROVIDER\s*\n\s*value:\s*(\S+)/)?.[1];
  assert.ok(provider, "PAYMENT_PROVIDER must have a literal value");
  assert.equal(
    mirror,
    provider,
    "the browser must be told the same provider the API uses, or checkout renders for the wrong processor"
  );
});

test("the scheduler is enabled in production", () => {
  const value = renderYaml.match(/- key: ENABLE_SCHEDULER\s*\n\s*value:\s*(\S+)/)?.[1];
  assert.equal(
    value,
    "true",
    "payment reconciliation only runs when the scheduler is enabled"
  );
});

test("migrations run before the service starts", () => {
  assert.match(
    renderYaml,
    /preDeployCommand:.*migrate/,
    "without a preDeploy migrate the deployed schema falls behind the code"
  );
});

test("each service names the package it actually starts", () => {
  // The root `start` script launches the API. A web service that reuses it will
  // build Next.js and then serve the API instead of the site, which fails
  // silently: the deploy goes green and the wrong app answers requests.
  const apiStart = renderYaml.match(/name: obligon-api[\s\S]*?startCommand:\s*(.+)/)?.[1]?.trim();
  assert.ok(apiStart, "the API service must declare a startCommand");
  assert.match(
    apiStart,
    /@obligon\/api/,
    `the API service must start the API package explicitly, got: ${apiStart}`
  );

  const webStart = renderYaml.match(/name: obligon-web[\s\S]*?startCommand:\s*(.+)/)?.[1]?.trim();
  if (webStart) {
    assert.match(
      webStart,
      /@obligon\/web/,
      `the web service must start the web package explicitly, got: ${webStart}`
    );
  }
});

test("the root scripts distinguish the two runnable apps", () => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  assert.match(pkg.scripts.start, /@obligon\/api/, "root `start` is the API, so it must say so");
  assert.ok(pkg.scripts["start:web"], "a start:web script must exist for web hosts");
  assert.match(pkg.scripts["start:web"], /@obligon\/web/);
});

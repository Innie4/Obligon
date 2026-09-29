/**
 * Guards against naira signs being written as mojibake.
 *
 * The top-up modal shipped with "â‚¦" instead of "₦" in five places. The naira
 * sign is U+20A6, encoded UTF-8 as E2 82 A6; decoding those bytes as Windows-1252
 * yields U+00E2 U+201A U+00A6, three characters, and re-encoding that as UTF-8
 * bakes the corruption into the source. It renders as literal "â‚¦" to customers.
 *
 * The damage was localised, so this checks the same way the bug appeared: one
 * wrong codepoint is fine, three in a row is not.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..", "..", "web");
const SKIP = new Set(["node_modules", ".next", "out", ".git", "dist", "build"]);

// The three mojibake codepoints that stand in for one naira sign.
const MOJIBAKE = /[\u00e2][\u0080-\u00bf\u2018-\u201f][\u00a6]/g;
const NAIRA = "\u20a6";

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|css|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = sourceFiles(webRoot);
assert.ok(files.length > 0, "found web source files to check");

test("no source file contains a mojibake naira sign", () => {
  const offenders = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    MOJIBAKE.lastIndex = 0;
    if (MOJIBAKE.test(text)) {
      offenders.push(path.relative(webRoot, file));
    }
    MOJIBAKE.lastIndex = 0;
  }
  assert.deepEqual(
    offenders,
    [],
    `mojibake naira sign in: ${offenders.join(", ")}. The UTF-8 bytes E2 82 A6 were decoded as cp1252.`
  );
});

test("the top-up modal shows a real naira sign", () => {
  const file = path.join(webRoot, "components", "customer-dashboard", "CustomerModals.tsx");
  const text = fs.readFileSync(file, "utf8");
  assert.ok(
    text.includes(NAIRA),
    "CustomerModals must contain a genuine U+20A6 naira sign"
  );
  // The amount label, the fee row and the pay button are the three places a
  // customer reads a figure, so all three must carry the real sign.
  const moneyLines = text.split(/\r?\n/).filter((l) => /Gateway Transaction Fee|Total to pay|Pay |Top-up amount/.test(l));
  assert.ok(moneyLines.length >= 3, "found the money lines to check");
  for (const line of moneyLines) {
    if (line.includes("naira(") || line.includes("{") || !/\u20a6|\\u20a6/.test(line)) continue;
    assert.ok(
      line.includes(NAIRA) || line.includes("\\u20a6"),
      `money line lacks a real naira sign: ${line.trim().slice(0, 80)}`
    );
  }
});

test("the API formats currency with the real naira sign", () => {
  const file = path.join(__dirname, "..", "src", "lib", "format.js");
  const text = fs.readFileSync(file, "utf8");
  MOJIBAKE.lastIndex = 0;
  assert.ok(!MOJIBAKE.test(text), "format.js must not contain a mojibake naira sign");
  assert.ok(text.includes(NAIRA), "format.js must format with a genuine naira sign");
});

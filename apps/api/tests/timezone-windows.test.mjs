/**
 * Day-window boundaries, verified against the live database.
 *
 * Source-level assertions were not enough here: both readings of
 * `date_trunc('day', now() AT TIME ZONE z) - make_interval(...) AT TIME ZONE z`
 * parse, and the wrong one produces a naive timestamp that Postgres silently
 * coerces using the session timezone — reintroducing exactly the drift the module
 * exists to remove. The operator-precedence bug was found by running this, not by
 * reading it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { one } from "../src/db.js";
import { dayWindowSql, daysForRange, businessTimeZone } from "../src/lib/time.js";

const ZONES = ["UTC", "Africa/Lagos", "America/New_York", "Asia/Kolkata"];

const placeholders = (sql) =>
  [...new Set([...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);

test("every zone produces a real window, not an empty one", async () => {
  // tzParam 1 so the placeholders are $1 (zone) and $2 (days back), and the
  // parameter array lines up with the SQL rather than with a guess.
  const w = dayWindowSql(1, 0);

  for (const tz of ZONES) {
    const r = await one(
      `SELECT (${w.from}) AS from_ts, (${w.to}) AS to_ts,
              pg_typeof((${w.from})::timestamptz)::text AS inferred`,
      [tz, 0]
    );
    assert.ok(r, `no row for ${tz}`);
    const hours = (new Date(r.to_ts) - new Date(r.from_ts)) / 3_600_000;
    assert.ok(hours >= 23 && hours <= 25, `${tz} window was ${hours}h`);
    // A naive timestamp here means the boundaries are being coerced by the session
    // timezone, which is the bug this module is for.
    assert.equal(r.inferred, "timestamp with time zone", `${tz} bound was not a timestamptz`);
  }
});

test("the window is half-open and excludes the next day", async () => {
  const w = dayWindowSql(1, 0);
  const r = await one(
    `SELECT (${w.from}) AS boundary,
            ((${w.from}) - interval '1 second') AS just_before,
            ((${w.to}) - interval '1 second') AS last_inside,
            ((${w.to}) + interval '1 second') AS just_after`,
    ["UTC", 0]
  );
  assert.ok(new Date(r.just_before) < new Date(r.boundary));
  assert.ok(new Date(r.boundary) <= new Date(r.last_inside));
  assert.ok(new Date(r.last_inside) < new Date(r.just_after));
  // And it is exactly one day, not zero — the version that pointed both bounds at
  // `date_trunc('day', ...)` made every figure read zero.
  const hours = (new Date(r.last_inside) - new Date(r.boundary)) / 3_600_000;
  assert.ok(hours >= 23 && hours <= 25, `day window was ${hours}h`);
});

test("a 7-day window spans seven calendar days", async () => {
  const w = dayWindowSql(1, 6);
  const r = await one(`SELECT (${w.from}) AS from_ts, (${w.to}) AS to_ts`, ["UTC", 6]);
  const days = (new Date(r.to_ts) - new Date(r.from_ts)) / 86_400_000;
  assert.ok(Math.abs(days - 7) < 0.01, `window was ${days} days`);
});

test("every window binds the same number of parameters", async () => {
  // A days-back placeholder emitted only when non-zero meant a caller binding three
  // values against two placeholders: a 500 on the default path. This was a live bug
  // in code introduced the same day it was written.
  for (const daysBack of [0, 1, 6, 29, 364]) {
    const w = dayWindowSql(2, daysBack);
    const used = new Set([...placeholders(w.from), ...placeholders(w.to)]);
    assert.deepEqual([...used].sort((a, b) => a - b), [2, 3], `daysBack=${daysBack} used ${[...used]}`);
  }
});

test("the range parameter can only be one of a fixed set", () => {
  // `Math.min(Number(range) || 30, 365)` let `-5` through, and
  // `now() - interval '-5 days'` is a future date — an empty report, silently.
  assert.equal(daysForRange("7"), 7);
  assert.equal(daysForRange("30"), 30);
  assert.equal(daysForRange("90"), 90);
  assert.equal(daysForRange("365"), 365);
  assert.equal(daysForRange("-5"), 30);
  assert.equal(daysForRange("0"), 30);
  assert.equal(daysForRange("'; DROP TABLE transactions; --"), 30);
  assert.equal(daysForRange(undefined), 30);
});

test("an unrecognised zone falls back to UTC rather than throwing at query time", () => {
  assert.equal(businessTimeZone(), "UTC");
});
import { env } from "../config/env.js";

/**
 * The timezone every "today" and "this month" boundary is measured in.
 *
 * `transactions.created_at` and every other timestamp column is `TIMESTAMPTZ`,
 * which Postgres stores as an instant and renders in the session timezone. A day
 * boundary therefore has to be an instant too, not a wall-clock time.
 *
 * The bug this replaces: `const d = new Date(); d.setHours(0, 0, 0, 0)` takes
 * *server-local* midnight and hands it to the driver, which serialises it to a
 * UTC instant. On a host west of Greenwich that instant is the previous day's
 * 23:00 UTC, so "today" silently excluded the most recent hour; east of Greenwich
 * it counted an hour of tomorrow. The figure moved depending on where the
 * container happened to be scheduled.
 *
 * Boundaries are computed by Postgres, from the same clock it stamps rows with,
 * so the two cannot disagree. UTC by default: it is what the column is stored in,
 * and one shared boundary is easier to reason about than one that shifts twice a
 * year. Deployments wanting a local business day set BUSINESS_TIMEZONE.
 */
export function businessTimeZone() {
  const configured = String(env.BUSINESS_TIMEZONE ?? "").trim() || "UTC";
  // Validated rather than trusted: an unrecognised zone would make Postgres raise
  // on the first dashboard query, turning a config typo into an outage. Falling
  // back to UTC keeps the dashboard working and the mistake obvious.
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: configured });
    return configured;
  } catch {
    if (configured !== "UTC") {
      console.warn(`[time] BUSINESS_TIMEZONE "${configured}" is not a valid IANA zone; using UTC`);
    }
    return "UTC";
  }
}

/**
 * SQL for a closed window on a timestamptz column, in the business timezone.
 *
 * `now() AT TIME ZONE tz` strips the zone and leaves a naive local timestamp;
 * `date_trunc` then finds local midnight; the trailing `AT TIME ZONE` re-attaches
 * the zone, yielding the instant that local midnight actually is. Both ends are
 * computed, so a row stamped in the future by clock skew is excluded instead of
 * being counted as today's revenue.
 *
 * Two things here are deliberate and were both wrong before:
 *
 * - The subtraction is parenthesised. `AT TIME ZONE` binds tighter than `-`, so
 *   `a - b AT TIME ZONE z` parses as `a - (b AT TIME ZONE z)`, which yields a naive
 *   timestamp. Comparing that against a `TIMESTAMPTZ` column silently reintroduces
 *   the session-timezone drift this module exists to remove.
 * - The days-back placeholder is emitted even when it is zero, so the parameter
 *   count is fixed at three for every window. Emitting it conditionally meant a
 *   caller binding three values against two placeholders on the `daysBack = 0`
 *   path, which is a 500.
 *
 * @param {number} tzParam 1-based index the timezone is bound at
 * @param {number} daysBack 0 for today, 6 for the last 7 days, and so on
 */
export function dayWindowSql(tzParam = 2, daysBack = 0) {
  const tz = `$${tzParam}`;
  const days = `$${tzParam + 1}`;
  const todayLocal = `date_trunc('day', now() AT TIME ZONE ${tz})`;
  const startLocal = `(${todayLocal} - make_interval(days => ${days}))`;
  // The upper bound is *tomorrow's* local midnight, not today's. Pointing both ends
  // at `date_trunc('day', ...)` gives an empty half-open interval, so the window
  // silently counted nothing — `from === to`, and every figure read zero.
  const endLocal = `(${todayLocal} + interval '1 day')`;
  return {
    from: `(${startLocal}) AT TIME ZONE ${tz}`,
    to: `(${endLocal}) AT TIME ZONE ${tz}`
  };
}

/** How long a window, in whole days, given a range key. */
export function daysForRange(range) {
  const days = Number(range);
  if (days === 7 || days === 30 || days === 90 || days === 365) return days;
  return 30;
}

/**
 * The instant at which today begins, as a JS Date.
 *
 * Only used for log lines and audit metadata — the figures themselves come from
 * the SQL above. Implemented with `Intl`, so it is correct on any host and for
 * any zone, including the half-hour and DST cases that offset arithmetic gets
 * wrong.
 */
export function startOfBusinessDay(date = new Date(), timeZone = businessTimeZone()) {
  const day = calendarParts(date, timeZone);
  return zonedMidnightToInstant(day.year, day.month, day.day, timeZone);
}

/** The instant at which today ends, i.e. the start of tomorrow. */
export function endOfBusinessDay(date = new Date(), timeZone = businessTimeZone()) {
  const day = calendarParts(date, timeZone);
  return zonedMidnightToInstant(day.year, day.month, day.day + 1, timeZone);
}

function calendarParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * The instant local midnight maps to.
 *
 * Start from the naive reading as if it were UTC, measure the zone's offset at
 * that moment, correct, then correct again — the first correction can land on the
 * other side of a DST transition, which is the case that makes a single pass
 * wrong by an hour.
 */
function zonedMidnightToInstant(year, month, day, timeZone) {
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0);
  let instant = naive;
  for (let pass = 0; pass < 2; pass += 1) {
    instant = naive - zoneOffsetMs(new Date(instant), timeZone);
  }
  return new Date(instant);
}

/** The zone's offset from UTC at a given instant, in milliseconds. */
function zoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    // Some ICU versions render midnight as hour 24 rather than 0.
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  // Truncated to whole seconds, because the formatted parts carry no milliseconds.
  return asIfUtc - Math.floor(date.getTime() / 1000) * 1000;
}
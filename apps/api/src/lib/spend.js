import { one } from "../db.js";
import { naira } from "./format.js";

/**
 * A customer's projected spend for the current calendar month.
 *
 * The month is computed in Postgres, not in JavaScript, so the key used to store
 * a projection and the key used to read one back can never disagree. A JS
 * `new Date(y, m, 1)` is local midnight, which is the previous day in any
 * timezone behind UTC: on a server running west of Greenwich the first of the
 * month would normalise to the last day of the month before, so a projection
 * saved in the evening would be invisible until the following month.
 */
const MONTH_SQL = "date_trunc('month', now())::date";

/** The largest projection accepted, in kobo (N1,000,000,000).
 *
 * A projection is an intention, not a cap, so there is deliberately no business
 * limit on it. This exists only to reject a fat-fingered figure such as
 * 100,000,000 naira, which no individual driver or fleet operator will plan a
 * month around and which would sit on screen looking authoritative. */
const MAX_PROJECTED_KOBO = 100_000_000_000;

/**
 * Read the current month's projection, along with the spend it is measured
 * against.
 *
 * @param {string} userId
 * @param {number} mtdKobo month-to-date spend in kobo, already aggregated by the
 *   caller so this stays a single query rather than re-running the transaction
 *   aggregate for every consumer.
 * @returns {Promise<object>}
 */
export async function readSpendProjection(userId, mtdKobo = 0) {
  const row = await one(
    // The month is selected whether or not a row exists, so the client always
    // learns which month it is being asked about. Returning null here would make
    // "already asked this month" indistinguishable from "not yet asked" for a
    // customer who has set nothing, and the prompt would never appear.
    `SELECT to_char(${MONTH_SQL}, 'YYYY-MM') AS month, p.projected_kobo, p.updated_at
     FROM (SELECT 1) AS anchor
     LEFT JOIN monthly_spend_projections p
       ON p.user_id = $1 AND p.month = ${MONTH_SQL}`,
    [userId]
  );

  const projectedKobo = row?.projected_kobo != null ? Number(row.projected_kobo) : null;
  // Null rather than 0 for "not set". Zero would be a claim that the customer
  // expects to spend nothing, and the usage bar would divide by it.
  const usagePercent = projectedKobo ? Math.round((mtdKobo / projectedKobo) * 100) : null;

  return {
    month: row?.month ?? null,
    projectedKobo,
    projectedLabel: projectedKobo == null ? null : naira(projectedKobo),
    // Whether the customer still owes an answer for this month. True for a brand
    // new account and true again on the first of every month, which is exactly
    // when a fresh projection is meaningful.
    needsProjection: projectedKobo == null,
    mtdKobo,
    usagePercent,
    // What is left of the projection. Negative once the spend exceeds it, which
    // is information rather than an error: the bar caps at 100% but the figure
    // is the real one.
    remainingKobo: projectedKobo == null ? null : projectedKobo - mtdKobo,
    remainingLabel: projectedKobo == null ? null : naira(projectedKobo - mtdKobo),
    updatedAt: row?.updated_at ?? null
  };
}

/**
 * Set (or change) this month's projection.
 *
 * An upsert rather than an insert, because revising a projection downwards has
 * to work exactly as setting one upwards does. Treating a change as a new row
 * would leave two answers for the same month and no way to say which one the bar
 * should use.
 *
 * @param {string} userId
 * @param {number} nairaAmount the projection as entered, in naira.
 * @returns {Promise<object>} the stored projection, without spend figures.
 */
export async function setSpendProjection(userId, nairaAmount) {
  const amount = Number(nairaAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Projected spend must be a number greater than zero");
  }
  // Rounded, because kobo is the smallest real amount and a projection is a
  // plan, not a settlement: asking for a fraction of a kobo is not meaningful.
  const kobo = Math.round(amount * 100);
  if (kobo > MAX_PROJECTED_KOBO) {
    throw new Error("Projected spend is unrealistically high");
  }

  const row = await one(
    `INSERT INTO monthly_spend_projections (user_id, month, projected_kobo)
     VALUES ($1, ${MONTH_SQL}, $2)
     ON CONFLICT (user_id, month)
     DO UPDATE SET projected_kobo = EXCLUDED.projected_kobo, updated_at = now()
     RETURNING to_char(month, 'YYYY-MM') AS month, projected_kobo, updated_at`,
    [userId, kobo]
  );

  return {
    month: row.month,
    projectedKobo: Number(row.projected_kobo),
    projectedLabel: naira(Number(row.projected_kobo)),
    needsProjection: false,
    updatedAt: row.updated_at
  };
}

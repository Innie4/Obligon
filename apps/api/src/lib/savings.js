import { q } from "../db.js";

/**
 * Fuel savings, measured rather than assumed.
 *
 * The dashboard previously reported "Lifetime Savings" as `litres * 1500`, a
 * hardcoded 15 naira per litre unrelated to anything the customer paid, and had
 * no month-to-date figure at all: the web client scraped it out of the MTD Spend
 * helper string, which read "This month". Savings that are not derived from real
 * prices are not savings.
 *
 * A saving is the positive difference between what the fuel was going for
 * elsewhere and what the customer actually paid, per litre.
 */

/**
 * The benchmark is the median positive listed price for the same fuel type
 * across the station network.
 *
 * A mean would be actively misleading. The station price table carries zero
 * placeholder rows and non-liquid entries such as "Car Wash Bay", which drag an
 * average far below what anyone actually pays; measuring against one would
 * report a large fictitious saving on every transaction. The median is immune to
 * those rows and to a single expensive outlier, and restricting to positive
 * prices keeps unset rows from counting as free fuel. Fewer than two positive
 * prices is not a benchmark, so those fuel types are excluded rather than
 * guessed at.
 */
const BENCHMARK_CTE = `
  SELECT fuel_type,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY price_kobo)::numeric AS median_price
  FROM fuel_prices
  WHERE price_kobo > 0
  GROUP BY fuel_type
  HAVING COUNT(*) >= 2`;

/**
 * Savings for one customer, optionally limited to a date window.
 *
 * Only the positive difference counts, so paying above the benchmark contributes
 * nothing rather than cancelling out a genuine saving elsewhere. Transactions
 * with no recorded unit price are excluded rather than treated as zero, which
 * would otherwise read as "paid nothing, saved the full benchmark".
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {Date|null} [opts.since] start of the window, or null for lifetime
 * @returns {Promise<{savedKobo: number, pricedCount: number, byFuel: object[]}>}
 */
export async function customerSavings({ userId, since = null }) {
  const rows = await q(
    `WITH benchmark AS (${BENCHMARK_CTE}),
     priced AS (
       SELECT t.fuel_type,
              SUM(t.litres)::float           AS litres,
              AVG(t.unit_price_kobo)::numeric AS avg_paid,
              COUNT(*)::int                  AS n
       FROM transactions t
       WHERE t.customer_user_id = $1
         AND t.status = 'success'
         AND t.unit_price_kobo IS NOT NULL
         AND t.litres > 0
         AND ($2::timestamptz IS NULL OR t.created_at >= $2)
       GROUP BY t.fuel_type
     )
     SELECT p.fuel_type,
            p.litres,
            ROUND(p.avg_paid)::bigint       AS avg_paid_kobo,
            ROUND(b.median_price)::bigint   AS benchmark_kobo,
            p.n                            AS transactions,
            ROUND(GREATEST(0, b.median_price - p.avg_paid) * p.litres)::bigint AS saved_kobo
     FROM priced p
     JOIN benchmark b ON b.fuel_type = p.fuel_type
     ORDER BY p.fuel_type`,
    [userId, since]
  );

  const byFuel = rows.map((r) => ({
    fuelType: r.fuel_type,
    litres: Math.round(Number(r.litres)),
    avgPaidKobo: Number(r.avg_paid_kobo),
    benchmarkKobo: Number(r.benchmark_kobo),
    transactions: Number(r.transactions),
    savedKobo: Number(r.saved_kobo)
  }));

  return {
    savedKobo: byFuel.reduce((sum, r) => sum + r.savedKobo, 0),
    pricedCount: byFuel.reduce((sum, r) => sum + r.transactions, 0),
    byFuel
  };
}

/** First instant of the current calendar month, for month-to-date figures. */
export function monthStart(from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth(), 1);
}

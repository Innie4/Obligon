import { q } from "../db.js";

/**
 * Historical savings are the discounts recorded when each purchase was made.
 * The immutable base and charged amounts are exact integer kobo, so unequal
 * volumes and later network price changes cannot rewrite the customer's saving.
 * Old rows without a recorded base are excluded rather than assigned an invented
 * past price. A comparison with today's network prices would be an estimate and
 * must be reported separately if the product adds one.
 */
export async function customerSavings({ userId, since = null }) {
  const rows = await q(
    `SELECT t.fuel_type,
            SUM(t.litres)::numeric AS litres,
            COUNT(*)::int AS transactions,
            SUM(GREATEST(0::numeric, t.base_amount_kobo::numeric - t.amount_kobo::numeric)) AS saved_kobo
     FROM transactions t
     WHERE t.customer_user_id = $1
       AND t.organization_id IS NULL
       AND t.status = 'success'
       AND t.litres > 0
       AND t.base_amount_kobo > 0
       AND t.amount_kobo >= 0
       AND ($2::timestamptz IS NULL OR t.created_at >= $2)
     GROUP BY t.fuel_type
     ORDER BY t.fuel_type`,
    [userId, since]
  );

  const exactAmount = (value) => {
    const amount = BigInt(value);
    if (amount < 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError("Savings exceed the supported reporting range");
    }
    return Number(amount);
  };
  const byFuel = rows.map((r) => ({
    fuelType: r.fuel_type,
    litres: Number(r.litres),
    transactions: Number(r.transactions),
    savedKobo: exactAmount(r.saved_kobo)
  }));
  const recordedCount = byFuel.reduce((sum, r) => sum + r.transactions, 0);

  return {
    savedKobo: exactAmount(rows.reduce((sum, r) => sum + BigInt(r.saved_kobo), 0n)),
    basis: "recorded_discount",
    recordedCount,
    pricedCount: recordedCount,
    byFuel
  };
}

/** First instant of the current calendar month, for month-to-date figures. */
export function monthStart(from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth(), 1);
}

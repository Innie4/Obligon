import { q, tx } from "../db.js";
import { businessTimeZone } from "./time.js";

/** Close completed business months once, preserving every period's earnings. */
export async function accrueSettlements() {
  const timezone = businessTimeZone();
  // Partners provisioned after the migration must join the accrual ledger too.
  await q(`INSERT INTO settlement_periods (partner_org_id)
    SELECT id FROM organizations WHERE type IN ('partner', 'mechanic')
    ON CONFLICT (partner_org_id) DO NOTHING`);
  const partners = await q(`SELECT partner_org_id FROM settlement_periods sp
    JOIN organizations o ON o.id = sp.partner_org_id
    WHERE o.type IN ('partner', 'mechanic')`);
  const summary = { partnersAccrued: 0, periodsCreated: 0, grossKobo: 0 };

  for (const partner of partners) {
    try {
      const result = await tx(async (t) => {
        const locked = await t.one(`SELECT fee_basis_points, last_settled_through
          FROM settlement_periods WHERE partner_org_id = $1 FOR UPDATE`, [partner.partner_org_id]);
        if (!locked) return null;
        // Infinity cannot be a generate_series endpoint. Historical periods define
        // covered earnings; payment arrival dates never define earning windows.
        const bounds = await t.one(`SELECT
          date_trunc('month', now() AT TIME ZONE $2)::text AS closed_through,
          CASE WHEN $3::timestamptz = TIMESTAMPTZ '-infinity' THEN
            COALESCE((SELECT MAX(period_end)::timestamp FROM settlements
                      WHERE partner_org_id = $1 AND status = 'paid'),
                     (SELECT date_trunc('month', MIN(tr.created_at) AT TIME ZONE $2)
                        FROM transactions tr JOIN stations s ON s.id = tr.station_id
                       WHERE s.partner_org_id = $1 AND tr.status = 'success' AND tr.settlement_method <> 'processor_split'),
                     date_trunc('month', now() AT TIME ZONE $2))
          ELSE date_trunc('month', $3::timestamptz AT TIME ZONE $2) END::text AS from_month`,
          [partner.partner_org_id, timezone, locked.last_settled_through]);
        const months = await t.query(`SELECT gs::date::text AS period_start,
            (gs + interval '1 month')::date::text AS period_end,
            gs AT TIME ZONE $3 AS from_ts,
            (gs + interval '1 month') AT TIME ZONE $3 AS through_ts
          FROM generate_series($1::timestamp, $2::timestamp - interval '1 month', interval '1 month') gs`,
          [bounds.from_month, bounds.closed_through, timezone]);
        let periods = 0, grossKobo = 0;
        for (const month of months) {
          const earnings = await t.one(`SELECT COALESCE(SUM(tr.amount_kobo), 0)::bigint AS gross_kobo,
              COALESCE(SUM(COALESCE(tr.platform_fee_kobo, ROUND(tr.amount_kobo * $4::numeric / 10000))), 0)::bigint AS fees_kobo,
              COALESCE(SUM(COALESCE(tr.partner_net_kobo, tr.amount_kobo - COALESCE(tr.platform_fee_kobo, ROUND(tr.amount_kobo * $4::numeric / 10000)))), 0)::bigint AS net_kobo
            FROM transactions tr JOIN stations s ON s.id = tr.station_id
            WHERE s.partner_org_id = $1 AND tr.status = 'success'
              AND tr.created_at >= $2 AND tr.created_at < $3
              AND tr.settlement_method <> 'processor_split'`,
            [partner.partner_org_id, month.from_ts, month.through_ts, locked.fee_basis_points]);
          const gross = Number(earnings.gross_kobo);
          if (gross <= 0) continue;
          const fees = Number(earnings.fees_kobo);
          const net = Number(earnings.net_kobo);
          const periodEnd = month.period_end instanceof Date
            ? month.period_end.toISOString().slice(0, 10) : String(month.period_end);
          const inserted = await t.one(`INSERT INTO settlements
            (partner_org_id, period_start, period_end, gross_kobo, fees_kobo, net_kobo, status, reference)
            SELECT $1,$2::date,$3::date,$4,$5,$6,'pending',$7
            WHERE NOT EXISTS (SELECT 1 FROM settlements WHERE partner_org_id=$1 AND period_end=$3::date AND status='paid')
            ON CONFLICT (partner_org_id, period_end) WHERE status = 'pending' DO UPDATE
            SET gross_kobo=EXCLUDED.gross_kobo, fees_kobo=EXCLUDED.fees_kobo, net_kobo=EXCLUDED.net_kobo
            WHERE settlements.paid_kobo=0 AND settlements.reconciliation_required=FALSE AND NOT EXISTS
              (SELECT 1 FROM payouts WHERE partner_org_id=$1 AND status IN ('pending','processing'))
            RETURNING id`,
            [partner.partner_org_id, month.period_start, periodEnd, gross, fees,
             Math.max(0, net), `STL-${periodEnd.slice(0,7).replace('-', '')}-${partner.partner_org_id.slice(0,8)}`]);
          if (inserted) { periods += 1; grossKobo += gross; }
        }
        await t.query(`UPDATE settlement_periods
          SET last_settled_through = $2::timestamp AT TIME ZONE $3, updated_at = now()
          WHERE partner_org_id = $1`, [partner.partner_org_id, bounds.closed_through, timezone]);
        return { periods, grossKobo };
      });
      if (result?.periods) {
        summary.partnersAccrued += 1;
        summary.periodsCreated += result.periods;
        summary.grossKobo += result.grossKobo;
      }
    } catch (err) {
      console.error(`[settlements] accrual failed for ${partner.partner_org_id}:`, err?.message ?? err);
    }
  }
  return summary;
}

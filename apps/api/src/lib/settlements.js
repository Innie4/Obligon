import { q, one, tx } from "../db.js";

/**
 * Accrue settlement periods for partners who have earned since their last one.
 *
 * This is what makes a payout possible at all. Nothing previously inserted a
 * `pending` settlement — the only INSERT was in the seed script and it wrote rows
 * already marked `paid` — so `claimableBalanceKobo()` summed an empty set, the
 * payout route refused every request with "You have no settled balance available
 * to withdraw yet", and the settlement scheduler had nothing to pay. The balance
 * guard added for that route was correct, and guarding something that could never
 * be non-zero.
 *
 * A period is derived, not invented: successful transactions at the partner's own
 * stations since their previous settled-through instant, less the platform fee.
 * The fee basis points are recorded on the row so the figure deducted is the figure
 * shown later; reading the environment at payout time would let a rate change
 * quietly rewrite history.
 *
 * Settlement periods are closed monthly. Earning a few thousand naira mid-month and
 * being paid for it immediately is not what a settlement is, and the auto-settlement
 * threshold exists precisely to hold a balance until it is worth disbursing.
 *
 * @returns {{ partnersAccrued: number, periodsCreated: number, grossKobo: number }}
 */
export async function accrueSettlements() {
  const partners = await q(
    `SELECT sp.partner_org_id, sp.fee_basis_points, sp.last_settled_through
     FROM settlement_periods sp
     JOIN organizations o ON o.id = sp.partner_org_id
     WHERE o.type IN ('partner', 'mechanic')
       AND sp.last_settled_through > TIMESTAMPTZ '-infinity'`
  );
  // A partner whose history has no settled period has nothing to measure from;
  // established at first accrual rather than assumed, so their first payment
  // covers everything earned to date.
  const virgin = await q(
    `SELECT o.id FROM organizations o
     LEFT JOIN settlement_periods sp ON sp.partner_org_id = o.id
     WHERE o.type IN ('partner', 'mechanic') AND sp.last_settled_through = TIMESTAMPTZ '-infinity'`
  );

  const summary = { partnersAccrued: 0, periodsCreated: 0, grossKobo: 0 };
  const candidates = [
    ...partners.map((p) => ({
      partnerOrgId: p.partner_org_id,
      feeBp: p.fee_basis_points,
      since: p.last_settled_through
    })),
    ...virgin.map((o) => ({ partnerOrgId: o.id, feeBp: 100, since: null }))
  ];

  for (const partner of candidates) {
    try {
      const created = await tx(async (t) => {
        // Lock this partner's accrual row for the whole statement. Without it two
        // concurrent sweeps both read the same `since`, both compute the same
        // earnings, and both insert a period for them — double-crediting the
        // partner's claimable balance.
        const locked = await t.one(
          `SELECT fee_basis_points, last_settled_through FROM settlement_periods
           WHERE partner_org_id = $1 FOR UPDATE`,
          [partner.partnerOrgId]
        );
        if (!locked) return null;

        // Every month from the watermark forward, not just the current one. Only
        // closing the current month meant a partner whose watermark was stale —
        // a scheduler that had been down, or a newly linked account — had the
        // intervening months skipped entirely: the window started at this month's
        // boundary, so revenue earned in the months before it was never summed and
        // became permanently unclaimable.
        const months = await t.query(
          `SELECT gs::date AS period_start,
                  (gs + interval '1 month')::date AS period_end,
                  gs AS from_ts,
                  (gs + interval '1 month') AS through_ts
             FROM generate_series(
               date_trunc('month', GREATEST($1::timestamptz, TIMESTAMPTZ '-infinity')),
               date_trunc('month', now()),
               interval '1 month'
             ) AS gs`,
          [locked.last_settled_through]
        );

        let accrued = 0;
        for (const month of months) {
          const earnings = await t.one(
            `SELECT COALESCE(SUM(t.amount_kobo), 0)::bigint AS gross_kobo
               FROM transactions t
              WHERE t.station_id IN (SELECT id FROM stations WHERE partner_org_id = $1)
                AND t.status = 'success'
                AND t.created_at >= $2 AND t.created_at < $3`,
            [partner.partnerOrgId, month.from_ts, month.through_ts]
          );

          const gross = Number(earnings?.gross_kobo ?? 0);
          const fees = Math.round((gross * locked.fee_basis_points) / 10_000);

          // Nothing earned in the window: clear any zero-value period left for it
          // and create none. A zero-net pending row is not merely clutter — the
          // unique index on (org, period_end) means its presence blocks a later
          // accrual for the same month, so the period would silently never fill.
          if (gross <= 0) {
            await t.query(
              `DELETE FROM settlements
               WHERE partner_org_id = $1 AND status = 'pending'
                 AND period_end = $2::date AND net_kobo = 0`,
              [partner.partnerOrgId, month.period_end]
            );
            continue;
          }

          const periodEndDate = month.period_end instanceof Date
          ? month.period_end.toISOString().slice(0, 10)
          : String(month.period_end);
          // `period_end` arrives as a JS Date, so slicing it would yield "Thu Oct"
          // rather than a month key. Formatted before use.
          const periodKey = periodEndDate.slice(0, 7).replace("-", "");

          const inserted = await t.one(
            `INSERT INTO settlements (partner_org_id, period_start, period_end, gross_kobo, fees_kobo, net_kobo, status, reference)
             VALUES ($1, $2::date, $3::date, $4, $5, $6, 'pending', $7)
             ON CONFLICT (partner_org_id, period_end) WHERE status = 'pending' DO NOTHING
             RETURNING id, net_kobo`,
            [
              partner.partnerOrgId,
              month.period_start,
              periodEndDate,
              gross,
              fees,
              Math.max(0, gross - fees),
              `STL-${periodKey}-${String(partner.partnerOrgId).slice(0, 8)}`
            ]
          );
          if (inserted) accrued += Number(inserted.net_kobo);
        }

        // Advance the watermark to the end of the current month. Either way, or a
        // partner with nothing to accrue would be rescanned every pass forever.
        await t.query(
          `UPDATE settlement_periods
           SET last_settled_through = GREATEST(
                 last_settled_through,
                 (date_trunc('month', now()) + interval '1 month')
               ),
               updated_at = now()
           WHERE partner_org_id = $1`,
          [partner.partnerOrgId]
        );

        return { netKobo: accrued };
      });

      if (created?.netKobo > 0) {
        summary.partnersAccrued += 1;
        summary.periodsCreated += 1;
        summary.grossKobo += created.netKobo;
      }
    } catch (err) {
      // One partner's accrual failing must not stop the others, and must not fail
      // the scheduler pass that also settles real money.
      console.error(
        `[settlements] accrual failed for ${partner.partnerOrgId}:`,
        err?.message ?? err
      );
    }
  }

  return summary;
}
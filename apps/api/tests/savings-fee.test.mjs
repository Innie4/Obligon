/**
 * Savings measurement and the customer-borne gateway fee.
 *
 * Savings used to be a hardcoded 15 naira per litre unrelated to what anyone
 * paid, with no month-to-date figure at all. The fee was a hardcoded
 * "0.00 (Zero Fee)" in the interface regardless of what the processor charges.
 */
import { q, one } from "../src/db.js";
import { priceWithFee, feeSchedule, FEE_BEARERS } from "../src/lib/payments.js";
import { customerSavings, monthStart } from "../src/lib/savings.js";
import { env } from "../src/config/env.js";

const BASE = "http://127.0.0.1:4000";
const results = [];
const say = (ok, name, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`);
};
const naira = (k) => `\u20a6${(Number(k) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// --------------------------------------------------------------- savings
const user = await one(
  "SELECT id, email FROM users WHERE role='customer' AND EXISTS (SELECT 1 FROM transactions t WHERE t.customer_user_id = users.id) LIMIT 1"
);
say(Boolean(user), "found a customer with transactions", user?.email);

const lifetime = await customerSavings({ userId: user.id, since: null });
const mtd = await customerSavings({ userId: user.id, since: monthStart() });

say(lifetime.savedKobo >= 0, "lifetime savings is not negative", naira(lifetime.savedKobo));
say(mtd.savedKobo >= 0, "MTD savings is not negative", naira(mtd.savedKobo));
say(mtd.savedKobo <= lifetime.savedKobo, "MTD savings cannot exceed lifetime savings", `${mtd.savedKobo} <= ${lifetime.savedKobo}`);
say(lifetime.pricedCount > 0, "savings are computed from priced transactions", `${lifetime.pricedCount} priced`);
say(
  lifetime.byFuel.every((f) => f.benchmarkKobo > 0),
  "every benchmark used is a positive price",
  lifetime.byFuel.map((f) => `${f.fuelType}@${f.benchmarkKobo}`).join(", ")
);
say(
  lifetime.byFuel.every((f) => f.savedKobo === 0 || f.avgPaidKobo < f.benchmarkKobo),
  "a saving is only booked when the price paid was below the benchmark"
);
// A benchmark must rest on at least two priced stations; `transactions` here is
// the customer's own transaction count, not the station count behind the
// benchmark, so the station rule is asserted against the price table directly.
const pricedStations = await q(
  `SELECT fuel_type, COUNT(*)::int AS n FROM fuel_prices WHERE price_kobo > 0 GROUP BY fuel_type`
);
const usedTypes = lifetime.byFuel.map((f) => f.fuelType);
for (const row of pricedStations) {
  if (!usedTypes.includes(row.fuel_type)) continue;
  say(row.n >= 2, `benchmark for ${row.fuel_type} rests on at least two priced stations`, `stations=${row.n}`);
}
// A fuel type with fewer than two priced stations must be excluded entirely,
// rather than measured against a single arbitrary price.
const excluded = await q(
  `SELECT fuel_type, COUNT(*)::int AS n FROM fuel_prices WHERE price_kobo > 0 GROUP BY fuel_type HAVING COUNT(*) < 2`
);
for (const row of excluded) {
  say(!usedTypes.includes(row.fuel_type), `${row.fuel_type} is excluded from savings (only ${row.n} priced station)`);
}

// The fabricated figure must be gone from the overview response.
const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "customer@obligon.com", password: "Customer#123" })
});
say(login.status === 200 || login.status === 201, "seeded customer signs in", `status=${login.status}`);
if (login.ok) {
  const { accessToken } = await login.json();
  const res = await fetch(`${BASE}/api/customer/overview`, { headers: { authorization: `Bearer ${accessToken}` } });
  const body = res.status === 200 ? await res.json() : null;
  say(res.status === 200, "overview metrics respond", `status=${res.status}`);
  const metrics = body?.metrics ?? [];
  const byLabel = Object.fromEntries(metrics.map((m) => [m.label, m]));
  say(Boolean(byLabel["MTD Savings"]), "MTD Savings is a first-class metric, not scraped from another metric's helper");
  const mtdSavings = byLabel["MTD Savings"]?.value ?? "";
  say(/^[\u20a6]/.test(mtdSavings), "MTD Savings renders as a currency amount, not the string 'This month'", mtdSavings);
  say(Boolean(byLabel["MTD Spend"]?.helper), "MTD Spend carries a real helper", byLabel["MTD Spend"]?.helper);
  say(
    (byLabel["Lifetime Savings"]?.value ?? "") !== "\u20a6245,780.00",
    "the fabricated lifetime figure is gone",
    byLabel["Lifetime Savings"]?.value
  );
  say(
    mtdSavings === byLabel["Lifetime Savings"]?.value ||
      Number(mtdSavings.replace(/\D/g, "")) <= Number((byLabel["Lifetime Savings"]?.value ?? "0").replace(/\D/g, "")),
    "MTD Savings never exceeds Lifetime Savings",
    `${mtdSavings} <= ${byLabel["Lifetime Savings"]?.value}`
  );

  // The verification tracker must report the customer's real position, not a
  // static description of the process.
  const progressRes = await fetch(`${BASE}/api/customer/card-request/progress`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (progressRes.status === 200) {
    const progress = await progressRes.json();
    const steps = progress.steps ?? [];
    say(steps.length === 5, "progress reports all five stages", steps.map((s) => s.key).join(" -> "));
    say(
      steps.every((s) => ["done", "active", "waiting", "failed"].includes(s.state)),
      "every step carries a valid state",
      [...new Set(steps.map((s) => s.state))].join(",")
    );
    say(
      steps.filter((s) => s.state === "done").length === progress.completedSteps,
      "the completed-step count matches the step states",
      `${progress.completedSteps}/${progress.totalSteps}`
    );
    say(
      progress.progressPercent >= 0 && progress.progressPercent <= 100,
      "progress percentage is a real proportion",
      `${progress.progressPercent}%`
    );
    say(["complete", "in_progress", "awaiting_payment", "rejected", "abandoned"].includes(progress.outcome), "outcome is one of the known states", progress.outcome);
    // The first step is always complete, since a request cannot exist without a plan.
    say(steps[0]?.state === "done", "the plan step is complete because the request exists");
    // A step must never claim a terminal state without the record behind it.
    const cardStep = steps.find((s) => s.key === "card");
    if (cardStep.state === "done") {
      say(Boolean(progress.card), "the card step is only done when a real card exists", JSON.stringify(progress.card?.status));
    } else {
      say(!progress.card, "no card is reported while the card step is not done", cardStep.state);
    }
  } else {
    say(progressRes.status === 404, "progress is 404 only when the customer has no request", `status=${progressRes.status}`);
  }
}

// ------------------------------------------------------------------- fee
const original = { bearer: env.PAYMENT_FEE_BEARER, bp: env.PAYMENT_FEE_BASIS_POINTS };

// platform bearer: no fee at all
env.PAYMENT_FEE_BEARER = FEE_BEARERS.platform;
env.PAYMENT_FEE_BASIS_POINTS = "150";
const platform = priceWithFee(500_000);
say(platform.feeKobo === 0, "platform bearer charges no fee even with a rate configured", naira(platform.feeKobo));
say(platform.totalKobo === 500_000, "the customer is charged the price", naira(platform.totalKobo));

// customer bearer: fee added on top
env.PAYMENT_FEE_BEARER = FEE_BEARERS.customer;
const at150 = priceWithFee(500_000);
say(at150.feeKobo === 7_500, "1.50% of 5,000 is 75.00", naira(at150.feeKobo));
say(at150.totalKobo === 507_500, "the total is price plus fee", naira(at150.totalKobo));
say(at150.baseKobo === 500_000, "the base price is preserved for the wallet credit", naira(at150.baseKobo));

// Every charged total must be a whole naira, or Flutterwave refuses the checkout.
env.PAYMENT_FEE_BASIS_POINTS = "1000";
for (const base of [10_000, 10_100, 10_150, 10_199, 12_345, 1_000]) {
  const p = priceWithFee(base);
  say(
    p.totalKobo % 100 === 0,
    `a N${(base / 100).toLocaleString("en-NG")} base at 10% charges a whole naira`,
    `${p.totalKobo} kobo`
  );
  say(
    p.feeKobo === p.totalKobo - p.baseKobo,
    `the fee and base always add up to the total for N${(base / 100).toLocaleString("en-NG")}`,
    `${p.baseKobo} + ${p.feeKobo} = ${p.totalKobo}`
  );
  say(p.feeKobo >= 0, "the fee is never negative", `${p.feeKobo}`);
}
// The specific case that was unpayable: N101 at 10% used to produce N111.10.
const unpayable = priceWithFee(10_100);
say(unpayable.totalKobo === 11_200, "N101 at 10% charges a whole N112.00", naira(unpayable.totalKobo));
say(unpayable.feeKobo === 1_100, "the rounding is disclosed in the fee, not hidden", naira(unpayable.feeKobo));

// An implausible rate must be flagged rather than silently applied.
say(feeSchedule().suspicious === true, "a 10% rate is flagged as suspicious", JSON.stringify(feeSchedule()));
env.PAYMENT_FEE_BASIS_POINTS = "150";
say(feeSchedule().suspicious === false, "a 1.5% rate is not flagged");
env.PAYMENT_FEE_BASIS_POINTS = "500";
say(feeSchedule().suspicious === false, "exactly 5% is at the boundary, not over it");

// The fee must never under-collect. Because the total is rounded up to a whole
// naira so Flutterwave will accept it, the fee can exceed the exact proportional
// amount by less than one naira; it is disclosed rather than hidden.
env.PAYMENT_FEE_BASIS_POINTS = "100";
const exactFee = (250_050 * 100) / 10_000;
const rounded = priceWithFee(250_050);
say(rounded.feeKobo >= Math.ceil(exactFee), "the fee is never less than the exact proportion", `${rounded.feeKobo} >= ${Math.ceil(exactFee)}`);
say(
  rounded.feeKobo < Math.ceil(exactFee) + 100,
  "rounding to a whole naira adds less than one naira",
  `${rounded.feeKobo} vs exact ${exactFee}`
);
say(rounded.totalKobo % 100 === 0, "the total is a whole naira", `${rounded.totalKobo} kobo`);
say(
  rounded.roundingKobo === rounded.totalKobo - 250_050 - Math.ceil(exactFee),
  "the rounding is reported so it can be disclosed",
  `roundingKobo=${rounded.roundingKobo}`
);

// edge cases
say(priceWithFee(0).totalKobo === 0, "a zero amount produces a zero total");
say(priceWithFee(-500).baseKobo === 0, "a negative amount is clamped to zero, not made positive value");
env.PAYMENT_FEE_BASIS_POINTS = "20000";
say(priceWithFee(100_000).feeKobo === 100_000, "an absurd rate is capped at 100% rather than inventing money", naira(priceWithFee(100_000).feeKobo));
env.PAYMENT_FEE_BASIS_POINTS = "not-a-number";
say(priceWithFee(100_000).feeKobo === 0, "a malformed rate yields no fee rather than NaN");

env.PAYMENT_FEE_BEARER = original.bearer;
env.PAYMENT_FEE_BASIS_POINTS = original.bp;

// the public config must publish the schedule so the UI can disclose it
const cfgRes = await fetch(`${BASE}/api/public/payments/config`);
const cfg = await cfgRes.json();
say(Boolean(cfg.fee), "the public config publishes the fee schedule", JSON.stringify(cfg.fee));
say(["customer", "platform"].includes(cfg.fee?.bearer), "the bearer is one of the two valid values", cfg.fee?.bearer);

// ------------------------------------------- fee columns are recorded, not guessed
const cols = await q(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE table_name IN ('top_ups','card_requests') AND column_name IN ('fee_kobo','charged_kobo')`
);
say(cols.length === 4, "fee and charged amounts are stored, not recomputed at read time", `${cols.length} columns`);

const drift = await q(
  `SELECT COUNT(*)::int AS n FROM card_requests r JOIN card_plans p ON p.code = r.plan_code
   WHERE r.charged_kobo <> p.amount_kobo + r.fee_kobo`
);
say(drift[0].n === 0, "every request's charged amount equals plan price plus fee", `drifted rows=${drift[0].n}`);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);

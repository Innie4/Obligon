/**
 * Proves the amount presented on the Flutterwave page equals the plan price.
 *
 * The bug: amounts are stored in kobo and were sent to Flutterwave unchanged.
 * Flutterwave renders `amount` as Naira, so a 250000 kobo plan appeared as
 * "NGN 250,000" instead of "NGN 2,500".
 *
 * This asserts the fix against the real sandbox API: read back what Flutterwave
 * recorded for the session and confirm the figure it will render matches the
 * plan the customer clicked.
 */
import { q, one } from "../db.js";
import { startCheckout, activeProvider } from "../lib/payments.js";
import { toProviderAmount } from "../lib/flutterwave.js";
import { naira } from "../lib/format.js";

const results = [];
const say = (ok, name, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`); 
};

const plans = await q("SELECT code, name, amount_kobo FROM card_plans WHERE active = TRUE ORDER BY sort_order, amount_kobo");
console.log(`provider: ${activeProvider()}\n`);

for (const plan of plans) {
  const expectedKobo = Number(plan.amount_kobo);
  const txRef = `PRICE-${plan.code}-${Date.now()}`;

  const checkout = await startCheckout({
    provider: activeProvider(),
    txRef,
    amountKobo: expectedKobo,
    email: "price-check@example.com",
    name: "Price Check",
    redirectUrl: "https://obligon.vercel.app/customer/card",
    title: `Obligon ${plan.name} Plan`
  });

  // Read back what Flutterwave recorded for this session, which is the number
  // its checkout page renders.
  const id = checkout.authorization_url.split("/").pop();
  const res = await fetch(`https://ravesandboxapi.flutterwave.com/flwv3-pug/getpaidx/api/hosted_pay/${id}?json=1`);
  const session = await res.json();

  const rendered = Number(session.amount);
  const currency = String(session.currency ?? "");
  const wants = toProviderAmount(expectedKobo);

  console.log(`\n${plan.name}:`);
  console.log(`  plan price      ${expectedKobo} kobo = ${naira(expectedKobo)}`);
  console.log(`  sent to Flutterwave  amount=${session.amount} currency=${currency}`);
  console.log(`  page will show  ${currency} ${rendered.toLocaleString("en-NG")}`);

  say(rendered === wants, `${plan.name}: Flutterwave will show the plan price`, `${currency} ${rendered} (wanted ${wants})`);
  say(
    rendered === expectedKobo / 100,
    `${plan.name}: not inflated 100x by a kobo/naira mix-up`,
    `rendered ${rendered} vs kobo ${expectedKobo}`
  );
  say(currency === "NGN", `${plan.name}: currency is NGN`, currency);
  say(session.tx_ref === txRef, `${plan.name}: reference round-trips`, String(session.tx_ref));
  say(
    String(session.customizations?.title ?? "").includes(plan.name),
    `${plan.name}: the plan is named on the checkout page`,
    session.customizations?.title
  );
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);

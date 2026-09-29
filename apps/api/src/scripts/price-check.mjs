/**
 * Proves the amount presented on the Flutterwave page equals the plan price.
 *
 * The bug: amounts are stored in kobo and were sent to Flutterwave unchanged.
 * Flutterwave renders `amount` as Naira, so a 250000 kobo plan appeared as
 * "NGN 250,000" instead of "NGN 2,500".
 *
 * This asserts the fix against whichever environment is configured: the sandbox
 * and live processors are separate hosts with separate config endpoints, so
 * hardcoding either one makes the check wrong the moment the keys are swapped.
 */
import { q } from "../db.js";
import { startCheckout, activeProvider } from "../lib/payments.js";
import { toProviderAmount } from "../lib/flutterwave.js";
import { naira } from "../lib/format.js";

const LIVE = !/_TEST/.test(process.env.FLW_SECRET_KEY ?? "");
const HOST = LIVE
  ? "https://api.flutterwave.com/flwv3-pug/getpaidx/api/hosted_pay"
  : "https://ravesandboxapi.flutterwave.com/flwv3-pug/getpaidx/api/hosted_pay";
const SESSION_HOST = LIVE ? "https://checkout.flutterwave.com" : "https://checkout-v2.dev-flutterwave.com";

console.log(`provider: ${activeProvider()} (${LIVE ? "LIVE" : "sandbox"})`);
console.log(`reading sessions from ${HOST}\n`);

const results = [];
const say = (ok, name, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`);
};

const plans = await q("SELECT code, name, amount_kobo FROM card_plans WHERE active = TRUE ORDER BY sort_order, amount_kobo");

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
  // its checkout page renders. The host differs between sandbox and live.
  say(
    String(checkout.authorization_url).startsWith(SESSION_HOST),
    `${plan.name}: session is on the ${LIVE ? "live" : "sandbox"} host`,
    checkout.authorization_url?.slice(0, 52)
  );
  const id = checkout.authorization_url.split("/").pop();
  const res = await fetch(`${HOST}/${id}?json=1`);
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

/**
 * One live Flutterwave checkout, to prove the live keys authenticate and that
 * the plan price reaches the live hosted page correctly.
 *
 * Creating a session moves no money: the customer must complete and authorise
 * the payment themselves. This only opens a payable link and reads back what the
 * processor recorded, then discards it.
 */
import { startCheckout, activeProvider, checkoutIsSimulated } from "../lib/payments.js";
import { toProviderAmount } from "../lib/flutterwave.js";
import { q } from "../db.js";
import { naira } from "../lib/format.js";

const results = [];
const say = (ok, name, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`);
};

console.log(`provider: ${activeProvider()}`);
console.log(`simulated: ${checkoutIsSimulated(activeProvider())}`);
say(checkoutIsSimulated(activeProvider()) === false, "checkout is NOT simulated — live keys are in use");
say(!/_TEST/.test(process.env.FLW_SECRET_KEY ?? ""), "the configured secret key is a live key");

const plans = await q("SELECT code, name, amount_kobo FROM card_plans WHERE active = TRUE ORDER BY sort_order");
const plan = plans[0];
const expectedKobo = Number(plan.amount_kobo);

const txRef = `LIVECHECK-${plan.code}-${Date.now()}`;
console.log(`\n${plan.name}: ${naira(expectedKobo)} (${expectedKobo} kobo)`);

let checkout;
try {
  checkout = await startCheckout({
    provider: activeProvider(),
    txRef,
    amountKobo: expectedKobo,
    email: "livecheck@example.com",
    name: "Live Key Check",
    redirectUrl: "https://obligon.vercel.app/customer/card",
    title: `Obligon ${plan.name} Plan`
  });
  say(true, "the live Flutterwave API accepted the request", checkout.authorization_url);
} catch (err) {
  say(false, "the live Flutterwave API accepted the request", `${err.status ?? ""} ${err.message}`);
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(1);
}

say(checkout.simulated === false, "the returned checkout is a real session");
say(
  String(checkout.authorization_url).includes("flutterwave.com"),
  "the link points at Flutterwave",
  checkout.authorization_url
);
// A live session must be on the live host, not the sandbox host.
say(
  !String(checkout.authorization_url).includes("dev-flutterwave"),
  "the link is on the LIVE host, not the sandbox",
  String(checkout.authorization_url).includes("dev-flutterwave") ? "sandbox host" : "live host"
);

// Read back what the live processor recorded, which is the figure its page renders.
const sessionId = String(checkout.authorization_url).split("/").pop();
try {
  const res = await fetch(`https://api.flutterwave.com/flwv3-pug/getpaidx/api/hosted_pay/${sessionId}?json=1`);
  const session = await res.json();
  const rendered = Number(session.amount);
  console.log(`\nlive session reports: amount=${session.amount} currency=${session.currency} tx_ref=${session.tx_ref}`);
  say(rendered === toProviderAmount(expectedKobo), "the live page will show the plan price", `NGN ${rendered} (wanted ${toProviderAmount(expectedKobo)})`);
  say(session.currency === "NGN", "the live session is in NGN", session.currency);
  say(String(session.tx_ref) === txRef, "the reference round-trips through the live API", String(session.tx_ref));
  say(!/_TEST/.test(String(session.PBFPubKey ?? "")), "the live session is not on a test public key", String(session.PBFPubKey ?? "").slice(0, 12) + "...");
} catch (err) {
  say(false, "the live session could be read back", err.message);
}

console.log(`\nSession ${sessionId} left unpaid and will expire on its own.`);
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);

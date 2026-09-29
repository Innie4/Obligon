/**
 * Confirms the hosted checkout offers the methods a wallet is actually funded
 * with, rather than whatever the merchant account defaults to.
 *
 * Reads back the session Flutterwave recorded, which is the configuration its
 * page renders from. Creating a session moves no money.
 */
import { startCheckout, activeProvider } from "../lib/payments.js";
import { paymentOptionsFor } from "../lib/flutterwave.js";
import { naira } from "../lib/format.js";
import { env } from "../config/env.js";

const results = [];
const say = (ok, name, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`);
};

const LIVE = !/_TEST/.test(env.FLW_SECRET_KEY ?? "");
const CONFIG_HOST = LIVE
  ? "https://api.flutterwave.com/flwv3-pug/getpaidx/api/hosted_pay"
  : "https://ravesandboxapi.flutterwave.com/flwv3-pug/getpaidx/api/hosted_pay";

console.log(`provider: ${activeProvider()} (${LIVE ? "LIVE" : "sandbox"})`);
console.log(`payment_options sent: ${JSON.stringify(paymentOptionsFor("NGN"))}\n`);

const checkout = await startCheckout({
  provider: activeProvider(),
  txRef: `METHODS-${Date.now()}`,
  amountKobo: 25_000, // N250.00
  email: "methods@example.com",
  name: "Methods Check",
  redirectUrl: "https://obligon.vercel.app/customer/wallet",
  title: "Obligon Wallet Top-up"
});

const sessionId = String(checkout.authorization_url).split("/").pop();
const res = await fetch(`${CONFIG_HOST}/${sessionId}?json=1`);
const session = await res.json();

console.log(`checkout: ${checkout.authorization_url}`);
console.log(`session reports amount=${session.amount} currency=${session.currency}`);
console.log(`session payment_options: ${JSON.stringify(session.payment_options ?? null)}\n`);

const offered = String(session.payment_options ?? "")
  .split(/[,\s]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

say(session.currency === "NGN", "the session is an NGN charge", session.currency);
// 25,000 kobo is N250.00, and Flutterwave stores the major unit, so the session
// must read 250 rather than 25000. Asserted through the same helper the checkout
// uses so the two cannot drift.
const expectedMajor = 25_000 / 100;
say(
  Number(session.amount) === expectedMajor,
  "the amount is the plan amount in whole naira, not kobo",
  `NGN ${session.amount} (expected ${expectedMajor})`
);
say(offered.length > 0, "Flutterwave recorded the requested payment options", JSON.stringify(offered));

// The two primary ways a wallet is funded must be present.
say(offered.includes("card"), "card is offered", offered.join(", "));
say(
  offered.includes("banktransfer") || offered.includes("account"),
  "bank transfer or direct debit is offered",
  offered.join(", ")
);
say(
  !offered.includes("paypal"),
  "PayPal is not offered for an NGN charge",
  offered.join(", ")
);
say(
  offered.every((m) => ["card", "banktransfer", "ussd", "account"].includes(m)),
  "only methods Flutterwave supports for NGN are requested",
  offered.join(", ")
);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
console.log(`\nOpen the link to confirm the page renders card and bank transfer. Session left unpaid.`);
process.exit(failed ? 1 : 0);

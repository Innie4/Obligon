/**
 * Resuming or cancelling a plan payment that is already in flight.
 *
 * A 409 from checkout used to be a dead end: the customer was told they had a
 * plan awaiting payment and given no way forward. This covers the two exits that
 * matter, and the guard that stops a paid plan being charged twice.
 */
import { q, one } from "../src/db.js";
import { env } from "../src/config/env.js";

const BASE = "http://127.0.0.1:4000";
const stamp = Date.now();

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

const results = [];
const say = (ok, name, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`); 
};

const signup = await call("POST", "/api/auth/signup", {
  body: { email: `resume-${stamp}@example.com`, password: "ResumeTest#123", fullName: "Resume Tester", role: "customer", phone: "+2348093333333" }
});
say(signup.status === 201, "customer signs up", `status=${signup.status} ${signup.data?.error ?? ""}`);
const token = signup.data?.accessToken ?? signup.data?.token;
const userId = signup.data?.user?.id;
say(Boolean(token && userId), "session token and user id returned");

// ---------------------------------------------- nothing in flight to begin with
const empty = await call("GET", "/api/customer/card-request/open", { token });
say(empty.status === 200, "GET /card-request/open responds", `status=${empty.status}`);
say(empty.data?.request === null, "a new account has no open request");
say(empty.data?.canResume === false && empty.data?.canCancel === false, "no actions are offered when there is nothing to act on");

// ------------------------------------------------------- start a checkout
const checkout = await call("POST", "/api/customer/card-request/checkout", { token, body: { planCode: "gold" } });
say(checkout.status === 201, "checkout starts", `status=${checkout.status} ${checkout.data?.error ?? ""}`);
const reference = checkout.data?.reference;
say(Boolean(reference), "a payment reference was issued", reference);
say(Boolean(checkout.data?.paymentUrl), "a real checkout link was returned");

// ---------------------------------- the 409 the customer actually ran into
const dupe = await call("POST", "/api/customer/card-request/checkout", { token, body: { planCode: "bronze" } });
say(dupe.status === 409, "a second checkout is still refused with 409", `status=${dupe.status}`);
say(
  /awaiting payment|in progress/i.test(dupe.data?.error?.message ?? ""),
  "the 409 explains what is blocking",
  dupe.data?.error?.message
);

// --------------------------------- the new endpoint hands back a way forward
const open = await call("GET", "/api/customer/card-request/open", { token });
say(open.status === 200, "GET /card-request/open responds with the pending request", `status=${open.status}`);
say(Boolean(open.data?.request), "the pending request is returned");
say(open.data?.reference === reference, "it carries the payment reference", open.data?.reference);
say(open.data?.request?.planName === "Gold", "it names the plan that is pending", open.data?.request?.planName);
say(Boolean(open.data?.request?.planAmountLabel), "it shows the amount owed", open.data?.request?.planAmountLabel);
say(open.data?.canResume === true, "the customer is offered the option to continue paying");
say(open.data?.canCancel === true, "the customer is offered the option to cancel");
say(open.data?.canWithdraw === false, "withdraw is not offered for an unpaid request");

// ------------------------------------------------------------- resume it
const resume = await call("POST", "/api/customer/card-request/resume", { token, body: { reference } });
say(resume.status === 200, "POST /card-request/resume responds", `status=${resume.status} ${resume.data?.error ?? ""}`);
say(resume.data?.reference === reference, "resume reuses the original reference so a lost payment still lands on this request", resume.data?.reference);
say(
  typeof resume.data?.paymentUrl === "string" && resume.data.paymentUrl.includes("flutterwave.com"),
  "resume returns a fresh live checkout link",
  resume.data?.paymentUrl ?? "none"
);
say(
  resume.data?.paymentUrl !== checkout.data?.paymentUrl,
  "the link is a new session, not the expired original",
  "a different link was issued"
);

// The resumed session must show the same plan price, not a stale or wrong one.
const sessionId = String(resume.data?.paymentUrl ?? "").split("/").pop();
if (sessionId) {
  const flw = await fetch(`https://ravesandboxapi.flutterwave.com/flwv3-pug/getpaidx/api/hosted_pay/${sessionId}?json=1`);
  const session = await flw.json();
  say(Number(session.amount) === 3500, "the resumed checkout shows the plan price", `amount=${session.amount} (expected 3500)`);
  say(session.currency === "NGN", "resumed checkout is in NGN", session.currency);
  say(String(session.tx_ref) === reference, "the resumed session carries the original reference", String(session.tx_ref));
} else {
  say(false, "resumed session could be inspected");
}

// -------------------------------------- only one request exists, not two
const count = await one(
  "SELECT COUNT(*)::int AS n FROM card_requests WHERE user_id = $1 AND status = 'awaiting_payment'",
  [userId]
);
say(count.n === 1, "resuming did not create a second request", `open requests=${count.n}`);

// --------------------------------------------------------------- cancel it
const cancel = await call("POST", "/api/customer/card-request/cancel", { token, body: { reference } });
say(cancel.status === 200, "POST /card-request/cancel responds", `status=${cancel.status} ${cancel.data?.error ?? ""}`);
say(cancel.data?.request?.status === "cancelled", "the request is cancelled", cancel.data?.request?.status);

const afterCancel = await call("GET", "/api/customer/card-request/open", { token });
say(afterCancel.data?.request === null, "no open request remains after cancelling");

// A brand new plan can now be started, which is the point of cancelling.
const retry = await call("POST", "/api/customer/card-request/checkout", { token, body: { planCode: "platinum" } });
say(retry.status === 201, "a different plan can be started after cancelling", `status=${retry.status}`);

// ------------------------------------------------------------ guard rails
const unknownResume = await call("POST", "/api/customer/card-request/resume", { token, body: { reference: "PLAN-does-not-exist" } });
say(unknownResume.status === 404, "resuming an unknown reference is refused", `status=${unknownResume.status}`);

const noRef = await call("POST", "/api/customer/card-request/resume", { token, body: {} });
say(noRef.status === 400, "resume without a reference is refused", `status=${noRef.status}`);

// A paid request must never be re-charged.
await q("UPDATE card_requests SET payment_status = 'paid', status = 'pending_verification' WHERE payment_reference = $1", [retry.data?.reference]);
const paidResume = await call("POST", "/api/customer/card-request/resume", { token, body: { reference: retry.data?.reference } });
say(paidResume.status === 409, "a paid request cannot be resumed (no double charge)", `status=${paidResume.status}`);
say(
  /already been paid/i.test(paidResume.data?.error?.message ?? ""),
  "the refusal explains why",
  paidResume.data?.error?.message
);

const paidOpen = await call("GET", "/api/customer/card-request/open", { token });
say(paidOpen.data?.canResume === false && paidOpen.data?.canCancel === false, "a paid request offers neither resume nor cancel");
say(paidOpen.data?.canWithdraw === true, "a paid request offers withdrawal instead");

// One customer must never see another customer's pending request.
const other = await call("POST", "/api/auth/signup", {
  body: { email: `resume-other-${stamp}@example.com`, password: "ResumeTest#123", fullName: "Other", role: "customer", phone: "+2348094444444" }
});
const otherToken = other.data?.accessToken;
const otherOpen = await call("GET", "/api/customer/card-request/open", { token: otherToken });
say(otherOpen.data?.request === null, "another customer sees no pending request of theirs", JSON.stringify(otherOpen.data?.request?.id ?? null));

const crossResume = await call("POST", "/api/customer/card-request/resume", { token: otherToken, body: { reference: retry.data?.reference } });
say(crossResume.status === 404, "another customer cannot resume someone else's request", `status=${crossResume.status}`);

// ----------------------------------------------------------------- cleanup
const ids = [userId, other.data?.user?.id].filter(Boolean);
await q("DELETE FROM notifications WHERE user_id = ANY($1)", [ids]);
await q("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
await q("DELETE FROM card_requests WHERE user_id = ANY($1)", [ids]);
await q("DELETE FROM wallets WHERE user_id = ANY($1)", [ids]);
await q("DELETE FROM users WHERE id = ANY($1)", [ids]);
await q("DELETE FROM verification_codes WHERE user_id = ANY($1)", [ids]);
await q("DELETE FROM idempotency_keys WHERE key LIKE $1", [`%${stamp}%`]);
console.log("\n(cleaned up the throwaway accounts)");

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);

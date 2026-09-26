/**
 * Card-request flow: plan -> payment -> identity details -> verification.
 *
 * Exercises the ordering guarantees that matter:
 *   - a card cannot be requested without choosing a paid plan
 *   - details cannot be submitted before payment is confirmed
 *   - BVN is validated
 *   - only one open request per customer
 *
 * Runs against a throwaway account so it never fights the seeded customer over
 * the one-open-request-per-user rule. Uses one login to stay inside the limit.
 */
const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4000";

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, data };
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// A dedicated account keeps this test independent of the seeded customer.
const email = `cardflow-${Date.now()}@example.com`;
const password = "CardFlow#123";

const signup = await call("POST", "/api/auth/signup", {
  body: { email, password, fullName: "Card Flow Tester", role: "customer", phone: "+2348010000000" }
});
if (signup.status !== 201 && signup.status !== 200) {
  console.log(`FATAL: signup failed with ${signup.status}`, JSON.stringify(signup.data));
  process.exit(1);
}
check("throwaway customer account created", true, email);

const login = await call("POST", "/api/auth/login", { body: { email, password } });
if (login.status !== 200) {
  console.log(`FATAL: login failed with ${login.status}`, JSON.stringify(login.data));
  process.exit(1);
}
const token = login.data.accessToken;

// ---------------------------------------------------------------- plans
const plansRes = await call("GET", "/api/customer/card-plans", { token });
const plans = plansRes.data?.plans ?? [];
check("GET /card-plans returns three plans", plansRes.status === 200 && plans.length === 3, `status=${plansRes.status}`);
check(
  "plan prices match the landing page",
  plans.find((p) => p.code === "bronze")?.amountKobo === 250000 &&
    plans.find((p) => p.code === "gold")?.amountKobo === 350000 &&
    plans.find((p) => p.code === "platinum")?.amountKobo === 500000,
  plans.map((p) => `${p.code}:${p.amountKobo}`).join(" ")
);

// ------------------------------------------- legacy path is closed to customers
const legacy = await call("POST", "/api/customer/card-request", { token, body: { label: "Unpaid" } });
check("customers cannot open an unpaid card request", legacy.status === 403, `status=${legacy.status}`);

// ------------------------------------------------------------ step 1: plan
const badPlan = await call("POST", "/api/customer/card-request/checkout", { token, body: { planCode: "diamond" } });
check("checkout rejects an unknown plan", badPlan.status === 400, `status=${badPlan.status}`);

const checkout = await call("POST", "/api/customer/card-request/checkout", { token, body: { planCode: "gold" } });
check("checkout starts a request", checkout.status === 201, `status=${checkout.status} ${JSON.stringify(checkout.data?.error ?? "")}`);
const reference = checkout.data?.reference;
check("checkout returns a payment reference", Boolean(reference));
check("request starts in awaiting_payment", checkout.data?.request?.status === "awaiting_payment", checkout.data?.request?.status);
check("request is recorded as unpaid", checkout.data?.request?.paymentStatus === "unpaid", checkout.data?.request?.paymentStatus);

const dupe = await call("POST", "/api/customer/card-request/checkout", { token, body: { planCode: "gold" } });
check("a second checkout is rejected", dupe.status === 409, `status=${dupe.status}`);

// ------------------------------- step 2: details must wait for payment
const early = await call("POST", "/api/customer/card-request/details", {
  token,
  body: { reference, fullName: "Femi Balogun", bvn: "20123456789", address: "1 Test St", city: "Lagos", state: "Lagos" }
});
check("details are rejected before payment", early.status === 409, `status=${early.status}`);

// ------------------------------------------------- step 2: verify payment
const simulated = Boolean(checkout.data.simulated);
const unverified = await call("POST", "/api/customer/card-request/verify-payment", { token, body: { reference, simulated } });
check("verification succeeds for the issued reference", unverified.status === 200 && unverified.data?.paid === true, `status=${unverified.status}`);
check("payment is marked paid", unverified.data?.request?.paymentStatus === "paid", unverified.data?.request?.paymentStatus);

const again = await call("POST", "/api/customer/card-request/verify-payment", { token, body: { reference, simulated } });
check("re-verifying is idempotent", again.status === 200 && again.data?.alreadyPaid === true, `status=${again.status}`);

const unknownRef = await call("POST", "/api/customer/card-request/verify-payment", { token, body: { reference: "PLAN-NOPE" } });
check("an unknown reference is rejected", unknownRef.status === 404, `status=${unknownRef.status}`);

// --------------------------------------------- step 3: identity + BVN rules
const shortName = await call("POST", "/api/customer/card-request/details", {
  token,
  body: { reference, fullName: "F", bvn: "20123456789", address: "1 Test St", city: "Lagos", state: "Lagos" }
});
check("details reject a too-short name", shortName.status === 400, `status=${shortName.status}`);

const badBvn = await call("POST", "/api/customer/card-request/details", {
  token,
  body: { reference, fullName: "Femi Balogun", bvn: "12345678901", address: "1 Test St", city: "Lagos", state: "Lagos" }
});
check("details reject a BVN not starting with 2", badBvn.status === 400, `status=${badBvn.status}`);

const shortBvn = await call("POST", "/api/customer/card-request/details", {
  token,
  body: { reference, fullName: "Femi Balogun", bvn: "2012345678", address: "1 Test St", city: "Lagos", state: "Lagos" }
});
check("details reject a 10-digit BVN", shortBvn.status === 400, `status=${shortBvn.status}`);

const noAddress = await call("POST", "/api/customer/card-request/details", {
  token,
  body: { reference, fullName: "Femi Balogun", bvn: "20123456789", city: "Lagos", state: "Lagos" }
});
check("details require a delivery address", noAddress.status === 400, `status=${noAddress.status}`);

const submitted = await call("POST", "/api/customer/card-request/details", {
  token,
  body: { reference, fullName: "Femi Balogun", bvn: "20123456789", address: "1 Test St", city: "Lagos", state: "Lagos" }
});
check("valid details are accepted", submitted.status === 200, `status=${submitted.status} ${JSON.stringify(submitted.data?.error ?? "")}`);
check("request moves to pending_verification", submitted.data?.request?.status === "pending_verification", submitted.data?.request?.status);
check("verification status is pending", submitted.data?.request?.verificationStatus === "pending", submitted.data?.request?.verificationStatus);
check("a 1-3 day ETA is returned", submitted.data?.verificationEta === "1-3 business days", submitted.data?.verificationEta);
check("BVN is never returned in full", submitted.data?.request?.bvnLastFour === "****6789", submitted.data?.request?.bvnLastFour);

const resubmit = await call("POST", "/api/customer/card-request/details", {
  token,
  body: { reference, fullName: "Femi Balogun", bvn: "20123456789", address: "1 Test St", city: "Lagos", state: "Lagos" }
});
check("resubmitting is idempotent", resubmit.status === 200 && resubmit.data?.alreadySubmitted === true, `status=${resubmit.status}`);

// final state reflects the whole flow
const final = await call("GET", "/api/customer/card-request", { token });
check("GET /card-request reflects the full flow", final.data?.request?.paymentStatus === "paid" && final.data?.request?.verificationStatus === "pending");
check("GET /card-request returns the plan", final.data?.request?.planCode === "gold" && final.data?.request?.planName === "Gold", JSON.stringify(final.data?.request?.planName));

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("Failed:", failed.map((f) => f.name).join("; "));
  process.exit(1);
}

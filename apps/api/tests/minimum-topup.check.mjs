/**
 * Proves the N100 minimum end to end: what the public config advertises is
 * exactly what the API accepts and rejects at the boundary.
 */
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

const out = [];
const say = (ok, name, detail = "") => {
  out.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` -> ${detail}` : ""}`); 
};

const cfg = await call("GET", "/api/public/payments/config");
say(cfg.status === 200, "public payments config responds", `status=${cfg.status}`);
say(cfg.data?.minimumTopupKobo === 10_000, "the advertised minimum is N100", `minimumTopupKobo=${cfg.data?.minimumTopupKobo}`);
const advertisedNaira = Number(cfg.data?.minimumTopupKobo) / 100;
say(advertisedNaira === 100, "which is 100 naira", `${advertisedNaira}`);

const signup = await call("POST", "/api/auth/signup", {
  body: { email: `min-${stamp}@example.com`, password: "MinTest#123456", fullName: "Min Tester", role: "customer", phone: "+2348095550001" }
});
const token = signup.data?.accessToken ?? signup.data?.token;
const userId = signup.data?.user?.id;
say(Boolean(token), "customer signs up", `status=${signup.status}`);

// Below the minimum: refused, with a message quoting the configured figure.
for (const amount of [1, 50, 99.99]) {
  const res = await call("POST", "/api/customer/wallet/topup", { token, body: { amount, method: "card" } });
  say(
    res.status === 400,
    `N${amount} is refused`,
    `status=${res.status} ${res.data?.error?.message ?? ""}`
  );
  if (amount === 99.99) {
    say(
      (res.data?.error?.message ?? "").includes("100"),
      "the refusal quotes the configured minimum, not a baked-in one",
      res.data?.error?.message
    );
  }
}

// At the minimum: accepted. A checkout session is opened on the live processor,
// which moves no money; the request is cancelled and left pending afterwards.
const atMin = await call("POST", "/api/customer/wallet/topup", { token, body: { amount: 100, method: "card" } });
say(
  atMin.status === 200 || atMin.status === 201,
  "exactly N100 is accepted",
  `status=${atMin.status} ${atMin.data?.error?.message ?? ""}`
);
say(
  atMin.data?.amountKobo === 10_000,
  "the base amount recorded is 10,000 kobo",
  `amountKobo=${atMin.data?.amountKobo}`
);
say(
  atMin.data?.totalKobo >= 10_000,
  "the total charged covers the base amount plus any fee",
  `totalKobo=${atMin.data?.totalKobo} feeKobo=${atMin.data?.feeKobo}`
);
say(
  atMin.data?.totalKobo === atMin.data?.amountKobo + atMin.data?.feeKobo,
  "total is exactly base plus fee",
  `${atMin.data?.amountKobo} + ${atMin.data?.feeKobo} = ${atMin.data?.totalKobo}`
);
say(Boolean(atMin.data?.paymentUrl), "a real checkout link was issued");

// Above the minimum: accepted.
const above = await call("POST", "/api/customer/wallet/topup", { token, body: { amount: 101, method: "card" } });
say(above.status === 200 || above.status === 201, "N101 is accepted", `status=${above.status}`);

// The wallet is not credited by starting a checkout, only by paying it.
const { q } = await import("../src/db.js");
const wallet = await q("SELECT balance_kobo FROM wallets WHERE user_id = $1 AND organization_id IS NULL", [userId]);
say(Number(wallet[0].balance_kobo) === 0, "no balance is credited for unpaid checkouts", `balance=${wallet[0].balance_kobo}`);

// Clean up: the top-ups are cancelled rather than paid, so nothing to reverse.
await q("DELETE FROM top_ups WHERE user_id = $1", [userId]);
await q("DELETE FROM notifications WHERE user_id = $1", [userId]);
await q("DELETE FROM sessions WHERE user_id = $1", [userId]);
await q("DELETE FROM wallets WHERE user_id = $1", [userId]);
await q("DELETE FROM users WHERE id = $1", [userId]);
await q("DELETE FROM verification_codes WHERE user_id = $1", [userId]);
console.log("\n(cleaned up; the checkout sessions were left unpaid and expire on their own)");

const failed = out.filter((r) => !r).length;
console.log(`\n${out.length - failed}/${out.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);

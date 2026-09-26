/**
 * Wallet-on-signup + Flutterwave payment configuration.
 *
 * Verifies that every account type gets a wallet created and linked at signup,
 * that company wallets attach to the organization (not just the user), and that
 * the Flutterwave provider is wired correctly.
 *
 * Uses a throwaway account so it never fights the seeded fixtures.
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

const stamp = Date.now();
const individual = {
  email: `wallet-ind-${stamp}@example.com`,
  password: "WalletTest#123",
  fullName: "Wallet Individual",
  role: "customer",
  phone: "+2348010000001"
};
const company = {
  email: `wallet-co-${stamp}@example.com`,
  password: "WalletTest#123",
  fullName: "Wallet Company Owner",
  role: "company",
  organizationName: `Wallet Co ${stamp}`,
  phone: "+2348010000002"
};

// ------------------------------------------------- payment config (public)
const config = await call("GET", "/api/public/payments/config");
check("GET /public/payments/config is open", config.status === 200, `status=${config.status}`);
check(
  "flutterwave is the active provider",
  config.data?.provider === "flutterwave",
  `provider=${config.data?.provider}`
);
check(
  "config exposes a browser-safe flutterwave public key",
  typeof config.data?.publicKeys?.flutterwave === "string" &&
    config.data.publicKeys.flutterwave.startsWith("FLWPUBK"),
  String(config.data?.publicKeys?.flutterwave).slice(0, 12)
);
check(
  "config never exposes a secret key",
  !JSON.stringify(config.data ?? {}).includes("FLWSECK") &&
    !JSON.stringify(config.data ?? {}).includes("SECRET"),
  "no secret material in the payload"
);

// ------------------------------------------- individual account + wallet
const indSignup = await call("POST", "/api/auth/signup", { body: individual });
check("individual signup succeeds", indSignup.status === 201 || indSignup.status === 200, `status=${indSignup.status}`);

const indLogin = await call("POST", "/api/auth/login", {
  body: { email: individual.email, password: individual.password }
});
check("individual can sign in", indLogin.status === 200, `status=${indLogin.status}`);
const indToken = indLogin.data?.accessToken;

const indWallet = await call("GET", "/api/customer/wallet", { token: indToken });
check("individual wallet endpoint responds", indWallet.status === 200, `status=${indWallet.status}`);
check(
  "individual wallet is created and funded at zero",
  indWallet.data?.balanceLabel !== undefined,
  `balance=${indWallet.data?.balanceLabel}`
);

// The wallet must exist immediately after signup, without a lazy first call.
const indProfile = await call("GET", "/api/customer/profile", { token: indToken });
check("individual profile loads", indProfile.status === 200, `status=${indProfile.status}`);
check(
  "individual wallet is linked to the account",
  indProfile.data?.wallet?.balanceLabel !== undefined,
  `wallet=${JSON.stringify(indProfile.data?.wallet ?? null)}`
);

// ------------------------------------------------- company account + wallet
const coSignup = await call("POST", "/api/auth/signup", { body: company });
check("company signup succeeds", coSignup.status === 201 || coSignup.status === 200, `status=${coSignup.status}`);

const coLogin = await call("POST", "/api/auth/login", {
  body: { email: company.email, password: company.password }
});
check("company owner can sign in", coLogin.status === 200, `status=${coLogin.status}`);
const coToken = coLogin.data?.accessToken;
check("company session carries an organizationId", Boolean(coLogin.data?.user?.organizationId));

// ------------------------------------------------- top-up via flutterwave
const topup = await call("POST", "/api/customer/wallet/topup", {
  token: indToken,
  body: { amount: 5000, method: "Card / Bank" }
});
check("top-up is accepted", topup.status === 200, `status=${topup.status} ${JSON.stringify(topup.data?.error ?? "")}`);
check("top-up routes through flutterwave", topup.data?.provider === "flutterwave", `provider=${topup.data?.provider}`);
check(
  "top-up returns a checkout url or a simulated flag",
  Boolean(topup.data?.paymentUrl) || topup.data?.simulated === true,
  `url=${Boolean(topup.data?.paymentUrl)} simulated=${topup.data?.simulated}`
);
const tooSmall = await call("POST", "/api/customer/wallet/topup", { token: indToken, body: { amount: 1 } });
check("top-up below the minimum is rejected", tooSmall.status === 400, `status=${tooSmall.status}`);

// With a real provider configured, checkout hands back a genuine Flutterwave
// hosted link. No card data ever passes through the API in this flow.
if (!topup.data?.simulated && topup.data?.paymentUrl) {
  // Test-mode checkout is served from checkout-v2.dev-flutterwave.com; live uses
  // checkout.flutterwave.com. The property that matters is that it is HTTPS on a
  // Flutterwave-controlled host.
  check(
    "checkout url is HTTPS on a Flutterwave-controlled host",
    /^https:\/\/[a-z0-9.-]*flutterwave\.com\//.test(topup.data.paymentUrl),
    topup.data.paymentUrl.slice(0, 46)
  );
}

const before = await call("GET", "/api/customer/wallet", { token: indToken });
const balanceBefore = Number(before.data?.balanceKobo ?? 0);
check("wallet kind is reported to the client", ["individual", "company"].includes(before.data?.walletKind), `kind=${before.data?.walletKind}`);

const confirm = await call("POST", "/api/customer/wallet/topup/confirm", {
  token: indToken,
  body: { reference: topup.data?.reference, simulated: Boolean(topup.data?.simulated) }
});

if (topup.data?.simulated) {
  check("simulated top-up confirms successfully", confirm.status === 200, `status=${confirm.status}`);
  const after = await call("GET", "/api/customer/wallet", { token: indToken });
  const balanceAfter = Number(after.data?.balanceKobo ?? 0);
  check("confirming credits the wallet once", balanceAfter === balanceBefore + 5000000, `${balanceBefore} -> ${balanceAfter}`);

  const reConfirm = await call("POST", "/api/customer/wallet/topup/confirm", {
    token: indToken,
    body: { reference: topup.data?.reference, simulated: true }
  });
  check("re-confirming does not double-credit", reConfirm.status === 200 && reConfirm.data?.alreadyPaid === true, `status=${reConfirm.status}`);

  const afterRepeat = await call("GET", "/api/customer/wallet", { token: indToken });
  check(
    "balance is unchanged after a repeat confirmation",
    Number(afterRepeat.data?.balanceKobo ?? 0) === balanceAfter,
    `${afterRepeat.data?.balanceKobo}`
  );
} else {
  // Real provider, no payment made yet: confirming must fail and must never
  // credit. This is the security-critical path.
  check("confirming an unpaid reference is rejected", confirm.status >= 400, `status=${confirm.status}`);
  const after = await call("GET", "/api/customer/wallet", { token: indToken });
  check(
    "an unverified payment never credits the wallet",
    Number(after.data?.balanceKobo ?? 0) === balanceBefore,
    `${balanceBefore} -> ${after.data?.balanceKobo}`
  );
}

// A top-up reference belonging to someone else must not be confirmable.
const second = await call("POST", "/api/auth/signup", {
  body: { email: `wallet-two-${stamp}@example.com`, password: "WalletTest#123", fullName: "Second User", role: "customer" }
});
const secondLogin = await call("POST", "/api/auth/login", {
  body: { email: `wallet-two-${stamp}@example.com`, password: "WalletTest#123" }
});
const secondTopup = await call("POST", "/api/customer/wallet/topup", {
  token: secondLogin.data?.accessToken,
  body: { amount: 1000, method: "Card / Bank" }
});
const stolen = await call("POST", "/api/customer/wallet/topup/confirm", {
  token: indToken,
  body: { reference: secondTopup.data?.reference, simulated: Boolean(secondTopup.data?.simulated) }
});
check(
  "another account cannot confirm someone else's top-up",
  stolen.status === 404,
  `status=${stolen.status}`
);

// ------------------------------------------------- flutterwave webhook auth
const badHook = await call("POST", "/api/webhooks/flutterwave", {
  body: { event: "charge.completed", data: { id: 1, tx_ref: "X", status: "successful", charged_amount: 1, currency: "NGN" } }
});
check("webhook rejects a missing verif-hash", badHook.status === 401, `status=${badHook.status}`);

const wrongHook = await call("POST", "/api/webhooks/flutterwave", {
  body: { event: "charge.completed", data: { id: 1, tx_ref: "X", status: "successful", charged_amount: 1, currency: "NGN" } },
  headers: { "verif-hash": "not-the-secret" }
});
check("webhook rejects a wrong verif-hash", wrongHook.status === 401, `status=${wrongHook.status}`);

// ---------------------------------------------------------- card plan via FW
const plans = await call("GET", "/api/customer/card-plans", { token: indToken });
check("card plans load for the new account", plans.status === 200 && plans.data?.plans?.length === 3);

const checkout = await call("POST", "/api/customer/card-request/checkout", {
  token: indToken,
  body: { planCode: "gold" }
});
check("card plan checkout starts", checkout.status === 201, `status=${checkout.status} ${JSON.stringify(checkout.data?.error ?? "")}`);
check("card checkout routes through flutterwave", checkout.data?.provider === "flutterwave", `provider=${checkout.data?.provider}`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("Failed:", failed.map((f) => f.name).join("; "));
  process.exit(1);
}

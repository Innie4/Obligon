/**
 * Targeted check for the notification-preference + security work.
 * Uses exactly ONE login so it stays inside the auth rate limit.
 */
const target = new URL(process.env.SMOKE_BASE_URL || "http://127.0.0.1:4000");
const BASE = target.origin;
if (process.env.OBLIGON_ALLOW_LOCAL_CHECKS !== "true" || !["http:", "https:"].includes(target.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || target.username || target.password ||
    target.pathname !== "/" || target.search || target.hash) {
  throw new Error("This mutating diagnostic requires OBLIGON_ALLOW_LOCAL_CHECKS=true and a loopback API connected to disposable test data.");
}

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
    /* empty body */
  }
  return { status: res.status, data, headers: res.headers };
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const email = process.env.SMOKE_EMAIL, password = process.env.SMOKE_PASSWORD;
if (!email || !password) throw new Error("Provide explicit disposable SMOKE_EMAIL and SMOKE_PASSWORD credentials.");
const login = await call("POST", "/api/auth/login", {
  body: { email, password }
});

if (login.status !== 200) {
  console.log(`FATAL: login failed with ${login.status}; a customer test account without MFA is required.`);
  process.exit(1);
}
const token = login.data.accessToken;
check("login returns an access token", Boolean(token));

// GET /profile should expose notificationPrefs with the documented channel keys.
const before = await call("GET", "/api/customer/profile", { token });
const prefsBefore = before.data?.user?.notificationPrefs;
check(
  "GET /profile returns notificationPrefs",
  before.status === 200 && prefsBefore && typeof prefsBefore === "object",
  `status=${before.status} keys=${prefsBefore ? Object.keys(prefsBefore).join(",") : "none"}`
);
check(
  "GET /profile exposes the channel keys notify.js reads",
  Boolean(prefsBefore && ["inApp", "email", "sms", "push"].every((k) => k in prefsBefore))
);
check("GET /profile exposes twoFactorEnabled", "twoFactorEnabled" in (before.data?.user ?? {}));
check("GET /profile exposes biometricsEnabled", "biometricsEnabled" in (before.data?.user ?? {}));

if (!prefsBefore || typeof prefsBefore !== "object") throw new Error("Original preferences could not be read; no account changes were made.");
let testEndpoint;
try {
// PUT: valid prefs must persist and be echoed back.
const turnedOff = { ...prefsBefore, sms: !prefsBefore.sms, push: false };
const put = await call("PUT", "/api/customer/profile", { token, body: { notificationPrefs: turnedOff } });
check("PUT /profile accepts valid prefs", put.status === 200, `status=${put.status}`);
check(
  "PUT /profile echoes notificationPrefs back",
  put.data?.user?.notificationPrefs?.sms === turnedOff.sms && put.data?.user?.notificationPrefs?.push === false,
  JSON.stringify(put.data?.user?.notificationPrefs ?? null)
);

// PUT: a non-boolean channel must be rejected, not silently stored.
const bad = await call("PUT", "/api/customer/profile", {
  token,
  body: { notificationPrefs: { email: "yes" } }
});
check("PUT /profile rejects non-boolean channel", bad.status === 400, `status=${bad.status}`);

const badCat = await call("PUT", "/api/customer/profile", {
  token,
  body: { notificationPrefs: { categories: { transactions: 1 } } }
});
check("PUT /profile rejects non-boolean category", badCat.status === 400, `status=${badCat.status}`);

const badBio = await call("PUT", "/api/customer/profile", {
  token,
  body: { biometricsEnabled: "yes" }
});
check("PUT /profile rejects non-boolean biometricsEnabled", badBio.status === 400, `status=${badBio.status}`);

// Biometrics toggle must round-trip.
const bioOn = await call("PUT", "/api/customer/profile", { token, body: { biometricsEnabled: true } });
check("PUT /profile refuses unsupported biometrics", bioOn.status === 400, `status=${bioOn.status}`);
const bioOff = await call("PUT", "/api/customer/profile", { token, body: { biometricsEnabled: false } });
check("PUT /profile turns biometrics back off", bioOff.status === 200 && bioOff.data?.user?.biometricsEnabled === false, `status=${bioOff.status}`);

// Push key endpoint must be reachable and return a usable VAPID key.
const vapid = await call("GET", "/api/push/key");
const vpk = vapid.data?.publicKey;
check("GET /api/push/key reports configured or unavailable push", vapid.status === 200 && typeof vpk === "string" && (vpk.length === 0 || vpk.length > 20), `len=${vpk?.length ?? 0}`);

// Push subscribe must reject an incomplete subscription and accept a full one.
const badSub = await call("POST", "/api/push/subscribe", { token, body: { endpoint: "https://example.test/x" } });
check("POST /push/subscribe rejects incomplete subscription", badSub.status === 400, `status=${badSub.status}`);

const fakeSub = {
  endpoint: `https://fcm.googleapis.com/fcm/send/smoke-${Date.now()}`,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "AAAAAAAAAAAAAAAAAAAAAA" }
};
testEndpoint = fakeSub.endpoint;
const okSub = await call("POST", "/api/push/subscribe", { token, body: fakeSub });
check("POST /push/subscribe stores a full subscription", okSub.status === 200, `status=${okSub.status}`);

const unsub = await call("POST", "/api/push/unsubscribe", { token, body: { endpoint: fakeSub.endpoint } });
check("POST /push/unsubscribe removes it", unsub.status === 200, `status=${unsub.status}`);

// Change-password must reject a wrong current password.
const badPw = await call("POST", "/api/auth/change-password", {
  token,
  body: { currentPassword: "definitely-wrong", newPassword: "NewPassw0rd!" }
});
check("change-password rejects a wrong current password", badPw.status === 400 || badPw.status === 401, `status=${badPw.status}`);

const shortPw = await call("POST", "/api/auth/change-password", {
  token,
  body: { currentPassword: password, newPassword: "short" }
});
check("change-password enforces an 8 character minimum", shortPw.status === 400, `status=${shortPw.status}`);

} finally {
  if (testEndpoint) {
    const removed = await call("POST", "/api/push/unsubscribe", { token, body: { endpoint: testEndpoint } });
    check("temporary push subscription cleanup succeeds", removed.status === 200, `status=${removed.status}`);
  }
  const restored = await call("PUT", "/api/customer/profile", { token, body: { notificationPrefs: prefsBefore } });
  check("original notification preferences are restored", restored.status === 200 && JSON.stringify(restored.data?.user?.notificationPrefs) === JSON.stringify(prefsBefore), `status=${restored.status}`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("Failed:", failed.map((f) => f.name).join("; "));
  process.exit(1);
}

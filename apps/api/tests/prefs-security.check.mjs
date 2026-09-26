/**
 * Targeted check for the notification-preference + security work.
 * Uses exactly ONE login so it stays inside the auth rate limit.
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
    /* empty body */
  }
  return { status: res.status, data, headers: res.headers };
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const login = await call("POST", "/api/auth/login", {
  body: { email: "customer@obligon.com", password: "Customer#123" }
});

if (login.status !== 200) {
  console.log(`FATAL: login failed with ${login.status}`, JSON.stringify(login.data));
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
check("PUT /profile persists biometricsEnabled", bioOn.status === 200 && bioOn.data?.user?.biometricsEnabled === true, `status=${bioOn.status}`);
const bioOff = await call("PUT", "/api/customer/profile", { token, body: { biometricsEnabled: false } });
check("PUT /profile turns biometrics back off", bioOff.status === 200 && bioOff.data?.user?.biometricsEnabled === false, `status=${bioOff.status}`);

// Push key endpoint must be reachable and return a usable VAPID key.
const vapid = await call("GET", "/api/push/key");
const vpk = vapid.data?.publicKey;
check("GET /api/push/key returns a VAPID public key", vapid.status === 200 && typeof vpk === "string" && vpk.length > 20, `len=${vpk?.length ?? 0}`);

// Push subscribe must reject an incomplete subscription and accept a full one.
const badSub = await call("POST", "/api/push/subscribe", { token, body: { endpoint: "https://example.test/x" } });
check("POST /push/subscribe rejects incomplete subscription", badSub.status === 400, `status=${badSub.status}`);

const fakeSub = {
  endpoint: `https://fcm.googleapis.com/fcm/send/smoke-${Date.now()}`,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "8eDyX_uCN0XRh0Y4T3t9BhJEHl_QPdjTbYFNgkVrK9g" }
};
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
  body: { currentPassword: "Customer#123", newPassword: "short" }
});
check("change-password enforces an 8 character minimum", shortPw.status === 400, `status=${shortPw.status}`);

// Restore the original preference state so the suite leaves no residue.
await call("PUT", "/api/customer/profile", { token, body: { notificationPrefs: prefsBefore } });

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("Failed:", failed.map((f) => f.name).join("; "));
  process.exit(1);
}

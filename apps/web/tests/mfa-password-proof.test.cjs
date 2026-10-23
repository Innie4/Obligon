const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const routes = { login: "/auth/login", adminDashboard: "/admin", companyDashboard: "/company", customerDashboard: "/customer", mfaChallenge: "/auth/mfa/challenge" };
const transpile = path => ts.transpileModule(fs.readFileSync(require.resolve(path), "utf8"), { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function nodes(tree) {
  if (tree == null || typeof tree !== "object") return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
function textOf(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  return (tree.type === "StatusPopup" ? textOf(tree.props?.message) : "") + [tree.props?.children].flat(Infinity).map(textOf).join("");
}
function loadUi({ stage = "challenge", role = "customer", pending = true, setupError, challenge } = {}) {
  const states = [], effects = [], events = [];
  let index = 0, mounted = false, revision = 0, resultCurrent = true;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => { const current = index++; if (!(current in states)) states[current] = initial; return [states[current], value => { states[current] = typeof value === "function" ? value(states[current]) : value; }]; },
    useEffect: fn => { if (!mounted) effects.push(fn); },
    useRef: initial => { const current = index++; return states[current] ??= { current: initial }; },
  };
  const user = { id: "synthetic", role };
  const api = {
    pendingMfaChallenge: () => pending ? "proof-for-test-only" : null,
    mfaSetup: async () => { if (setupError) throw new Error(setupError); return { secret: "REAL-TEST-SETUP", qrDataUrl: "data:image/png;base64,fixture" }; },
    sessionRevision: () => revision,
    isCurrentAuthResult: () => resultCurrent,
    mfaChallenge: async body => { events.push(["challenge", body]); return challenge ? challenge() : { user }; },
    mfaEnable: async () => ({ backupCodes: ["A1B2-C3D4"] }),
  };
  const exports = {};
  vm.runInNewContext(transpile("../components/auth/MFAUI.tsx"), {
    exports, Error, window: { location: { search: "" } }, require: name => {
      if (name.includes("company-invitation-routing")) return { authReturnPath: () => null };
      if (name === "react") return React;
      if (name === "@/components/shared/StatusPopup") return { StatusPopup: "StatusPopup" };
      if (name === "next/navigation") return { useRouter: () => ({ push: path => events.push(["push", path]) }) };
      if (name.includes("routes")) return { routes };
      if (name.includes("AuthContext")) return { useSession: () => ({ user, setUser: value => events.push(["session", value]) }) };
      if (name.includes("Toast")) return { useToast: () => ({ success: () => {} }) };
      if (name.includes("services")) return { authApi: api };
      return {};
    },
  });
  const render = () => { index = 0; const tree = exports.MFASetupUI({ stage, redirect: "/customer" }); mounted = true; return tree; };
  render();
  const cleanups = effects.map(effect => effect());
  return { render, events, states, invalidate() { revision++; resultCurrent = false; }, unmount() { cleanups.forEach(cleanup => cleanup?.()); } };
}

test("failed live authenticator setup displays its real error and cannot show or continue with fake credentials", async () => {
  const ui = loadUi({ stage: "setup", setupError: "Two-factor authentication is already enabled." });
  await flush();
  const tree = ui.render();
  assert.ok(textOf(tree).includes("Two-factor authentication is already enabled."));
  assert.equal(nodes(tree).find(node => node.type === "StatusPopup").props.tone, "error");
  assert.equal(nodes(tree).some(node => node.props?.role === "alert"), false);
  assert.equal(nodes(tree).filter(node => node.type === "img").length, 0);
  assert.equal(textOf(tree).includes("MOCK"), false);
  assert.equal(textOf(tree).includes("Setup Instructions"), false);
  assert.equal(textOf(tree).includes("Scan the QR code above"), false);
  const button = nodes(tree).find(node => node.type === "button" && textOf(node) === "Setup unavailable");
  assert.equal(button.props.disabled, true);
});
test("authenticator instructions appear when a real setup QR is available", async () => {
  const ui = loadUi({ stage: "setup" });
  await flush();
  const tree = ui.render();
  assert.ok(textOf(tree).includes("Setup Instructions"));
  assert.equal(nodes(tree).filter(node => node.type === "img").length, 1);
  assert.equal(nodes(tree).find(node => node.type === "button" && textOf(node) === "Continue").props.disabled, false);
});
test("a challenge opened without password proof explains recovery and disables code submission", () => {
  const ui = loadUi({ pending: false });
  const tree = ui.render();
  assert.ok(textOf(tree).includes("Sign in with your password again."));
  assert.equal(nodes(tree).find(node => node.type === "button" && node.props.type === "submit").props.disabled, true);
  assert.equal(ui.events.length, 0);
});
for (const [role, destination] of [["customer", "/customer"], ["company", "/company"], ["partner", "/dashboard"], ["mechanic", "/dashboard"], ["admin", "/admin"]]) {
  test(`successful MFA updates session before redirecting the ${role} to their dashboard`, async () => {
    const ui = loadUi({ role });
    let tree = ui.render();
    const totp = nodes(tree).find(node => typeof node.type === "function" && node.type.name === "TotpInput");
    totp.props.onChange("123456");
    tree = ui.render();
    nodes(tree).find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
    await flush();
    assert.deepEqual(ui.events.map(event => event[0]), ["challenge", "session", "push"]);
    assert.equal(ui.events[2][1], destination);
    assert.equal(ui.events[0][1].email, undefined);
  });
}
test("saved hexadecimal backup codes have a reachable input and are submitted intact", async () => {
  const ui = loadUi();
  nodes(ui.render()).find(node => node.type === "button" && textOf(node) === "Use a backup code").props.onClick();
  const input = nodes(ui.render()).find(node => node.type === "input");
  assert.ok(input);
  input.props.onChange({ target: { value: " a1b2-c3d4 " } });
  nodes(ui.render()).find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(ui.events[0][1].totp, "A1B2-C3D4");
});
test("separator-free backup codes are normalized to the generated server representation", async () => {
  const ui = loadUi();
  nodes(ui.render()).find(node => node.type === "button" && textOf(node) === "Use a backup code").props.onClick();
  nodes(ui.render()).find(node => node.type === "input").props.onChange({ target: { value: " a1b2c3d4 " } });
  nodes(ui.render()).find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(ui.events[0][1].totp, "A1B2-C3D4");
});
for (const invalidate of ["invalidate", "unmount"]) {
  test(`MFA UI ignores a successful completion after ${invalidate}`, async () => {
    let finish;
    const ui = loadUi({ challenge: () => new Promise(resolve => { finish = resolve; }) });
    nodes(ui.render()).find(node => typeof node.type === "function" && node.type.name === "TotpInput").props.onChange("123456");
    nodes(ui.render()).find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
    ui[invalidate]();
    finish({ user: { id: "obsolete-user", role: "customer" } });
    await flush();
    assert.deepEqual(ui.events.map(event => event[0]), ["challenge"]);
  });
}

function loadClient(responses) {
  const storage = new Map(), requests = [], tokens = [], sessions = [];
  const sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const exports = {};
  vm.runInNewContext(transpile("../lib/services/client.ts"), {
    exports, process: { env: { NEXT_PUBLIC_API_URL: "https://api.example.test" } }, window: { sessionStorage },
    Error, Headers, FormData, Blob, Response, URL, URLSearchParams, AbortController, AbortSignal, DOMException, setTimeout, clearTimeout,
    fetch: async (url, options) => { requests.push({ url, options }); return Response.json(responses.shift()); },
    require: name => name.includes("session-store") ? { readTokens: () => null, readPersistedSession: () => null, writeTokens: value => tokens.push(value), writePersistedSession: value => sessions.push(value) } : {},
  });
  return { api: exports.authApi, storage, requests, tokens, sessions };
}
test("the service persists only a short-lived password proof in session storage and consumes it on success", async () => {
  const ui = loadClient([{ mfaRequired: true, challengeToken: "server-proof", challengeExpiresInSeconds: 300 }, { user: { id: "synthetic", role: "customer" }, accessToken: "synthetic-access", refreshToken: "synthetic-refresh", mfaRequired: false }]);
  await ui.api.login({ email: "synthetic@example.test", password: "synthetic-password", rememberMe: true });
  assert.equal(ui.api.pendingMfaChallenge(), "server-proof");
  assert.equal([...ui.storage.values()].join("").includes("synthetic-password"), false);
  assert.equal([...ui.storage.values()].join("").includes("synthetic@example.test"), false);
  assert.equal(ui.tokens.length, 0);
  await ui.api.mfaChallenge({ totp: "123456" });
  assert.deepEqual(JSON.parse(ui.requests[1].options.body), { challengeToken: "server-proof", totp: "123456" });
  assert.equal(ui.requests[1].url.includes("server-proof"), false);
  assert.equal(ui.api.pendingMfaChallenge(), null);
  assert.equal(ui.tokens.length, 1);
  assert.equal(ui.sessions[0].id, "synthetic");
});
test("expired proof is removed before a challenge can call the API", async () => {
  const ui = loadClient([]);
  ui.storage.set("obligon_mfa_challenge", JSON.stringify({ token: "expired-proof", expiresAt: Date.now() - 1 }));
  await assert.rejects(ui.api.mfaChallenge({ totp: "123456" }), /expired.*password/i);
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.storage.size, 0);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(live = true) {
  const source = ts.createSourceFile('client.ts', fs.readFileSync(require.resolve('../lib/services/client.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
  let method;
  function visit(node) {
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'verifyConfirmEither') method = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(method, 'use the actual auth client method');
  const requests = [];
  const context = {
    LIVE_MODE: live,
    simulate: async () => {},
    http: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true }; },
    exports: {},
  };
  const code = ts.transpileModule(`exports.client = { ${method.getText(source)} };`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, context);
  return { confirm: context.exports.client.verifyConfirmEither, requests };
}

for (const channel of ['email', 'phone', undefined]) test(`verification client binds ${channel ?? 'legacy omitted'} channel in one request`, async () => {
  const ui = fixture();
  await ui.confirm('012345', channel);
  assert.deepEqual(ui.requests, [{ url: '/api/auth/verify/confirm', body: { code: '012345', ...(channel ? { channel } : {}) } }]);
});

for (const channel of ['email', 'phone']) test(`simulated ${channel} proof cannot verify the other contact`, async () => {
  const ui = fixture(false);
  const result = await ui.confirm('012345', channel);
  assert.equal(result.emailVerified, channel === 'email');
  assert.equal(result.phoneVerified, channel === 'phone');
  assert.equal(result.allVerified, false);
  assert.equal(result.accountVerified, true);
  assert.equal(ui.requests.length, 0);
});

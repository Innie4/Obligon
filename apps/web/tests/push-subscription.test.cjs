const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
function fixture({ subscription, registrationError, apiError }) {
  const calls = [];
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../lib/push-subscription.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const Notification = { permission: 'granted', requestPermission: async () => 'granted' };
  const registration = { pushManager: { getSubscription: async () => subscription?.expired ? null : subscription } };
  vm.runInNewContext(code, { exports, Error, Uint8Array, Buffer, navigator: { serviceWorker: { getRegistration: async () => { if (registrationError) throw registrationError; return registration; } } }, Notification, window: { Notification, PushManager: function() {} }, require: () => ({ pushApi: { getPublicKey: async () => 'AA', subscribe: async () => { calls.push('subscribe'); if (apiError) throw apiError; }, unsubscribe: async () => { calls.push('unsubscribe'); if (apiError) throw apiError; } } }) });
  return { ...exports, calls };
}
test('API unsubscribe failure rejects and leaves the browser subscribed for retry', async () => {
  let browserCalls = 0;
  const item = fixture({ apiError: Error('Removal failed'), subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/fixture', unsubscribe: async () => { browserCalls++; return true; } } });
  await assert.rejects(item.disableWebPush(), /Removal failed/); assert.equal(browserCalls, 0);
});
test('browser unsubscribe refusal with a remaining subscription rejects instead of claiming push is disabled', async () => {
  const item = fixture({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/fixture', unsubscribe: async () => false } });
  await assert.rejects(item.disableWebPush(), /could not|couldn't|unable|try again/i);
});
test('an already expired browser subscription is disabled after API removal', async () => {
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/fixture', unsubscribe: async () => { subscription.expired = true; return false; } };
  const item = fixture({ subscription });
  assert.equal((await item.disableWebPush()).subscribed, false);
});
test('service worker lookup failure is surfaced rather than treated as missing subscription', async () => {
  await assert.rejects(fixture({ registrationError: Error('Worker unavailable') }).disableWebPush(), /Worker unavailable/);
});
test('device state lookup failure rejects instead of falsely reporting an unsubscribed browser', async () => {
  await assert.rejects(fixture({ registrationError: Error('Worker unavailable') }).currentPushState(), /Worker unavailable/);
});
test('a missing browser subscription is already disabled', async () => {
  const item = fixture({ subscription: null });
  assert.equal((await item.disableWebPush()).subscribed, false); assert.equal(item.calls.length, 0);
});
test('successful API and browser removal reports disabled', async () => {
  const item = fixture({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/fixture', unsubscribe: async () => true } });
  assert.equal((await item.disableWebPush()).subscribed, false); assert.deepEqual(item.calls, ['unsubscribe']);
});
test('registration rejection is surfaced to the preference caller', async () => {
  const item = fixture({ apiError: Error('Unsupported push subscription'), subscription: { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/fixture', keys: {} }) } });
  await assert.rejects(item.enableWebPush(), /Unsupported push subscription/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { env } from '../src/config/env.js';
import { sendSms } from '../src/lib/sms.js';

function termiiFixture(t, handler = () => Response.json({ message_id: 'fixture-message' })) {
  const previous = Object.fromEntries(['SMS_PROVIDER', 'TERMII_API_KEY', 'TERMII_SENDER_ID', 'PROVIDER_RETRY_COUNT', 'LOCAL_OUTBOX_PATH'].map(key => [key, env[key]]));
  Object.assign(env, { SMS_PROVIDER: 'termii', TERMII_API_KEY: 'fixture-termii-key', TERMII_SENDER_ID: 'Fixture', PROVIDER_RETRY_COUNT: 3 });
  t.after(() => Object.assign(env, previous));
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.ng.termii.com/api/sms/send');
    requests.push({ method: options.method, body: JSON.parse(options.body) });
    return handler();
  });
  return requests;
}

for (const [destination, expected] of [
  ['+2348034567890', '2348034567890'],
  ['+234 803 456 7890', '2348034567890'],
  ['(0803) 456-7890', '2348034567890'],
  ['08034567890', '2348034567890'],
  ['8034567890', '2348034567890'],
  ['(803) 456-7890', '2348034567890'],
  ['2348034567890', '2348034567890'],
  ['+7 123 456 789', '7123456789'],
  ['+44 (20) 7946-0958', '442079460958'],
  ['442079460958', '442079460958'],
  ['+1 (202) 555-0199', '12025550199'],
]) {
  test(`SMS destination ${destination} uses international digits in the actual provider payload`, async t => {
    const requests = termiiFixture(t);
    assert.deepEqual(await sendSms({ to: destination, message: 'Fixture OTP' }), { delivered: true, simulated: false });
    assert.deepEqual(requests, [{ method: 'POST', body: { to: expected, from: 'Fixture', sms: 'Fixture OTP', type: 'plain', channel: 'generic', api_key: 'fixture-termii-key' } }]);
  });
}

for (const destination of [' ', '12345', '0803456789', '+0012025550199', '++2348034567890', '+2348034567890 extension 2', '1234567890123456', '+234/803/4567890', 8034567890, {}, []]) {
  test(`malformed SMS destination ${JSON.stringify(destination)} is refused before network access`, async t => {
    const requests = termiiFixture(t);
    const result = await sendSms({ to: destination, message: 'Fixture OTP' });
    assert.equal(result.delivered, false);
    assert.equal(result.skipped, false);
    assert.equal(result.code, 'SMS_NUMBER_REJECTED');
    assert.match(result.error, /valid phone number.*international format/i);
    assert.equal(requests.length, 0);
  });
}

for (const destination of [undefined, null, '']) {
  test(`missing SMS destination ${JSON.stringify(destination)} retains its explicit refusal`, async t => {
    const requests = termiiFixture(t);
    assert.deepEqual(await sendSms({ to: destination, message: 'Fixture OTP' }), { delivered: false, skipped: false, code: 'SMS_NO_NUMBER', error: 'no phone number on file' });
    assert.equal(requests.length, 0);
  });
}

test('SMS sends never retry an uncertain provider write', async t => {
  const requests = termiiFixture(t, () => { throw new Error('Fixture lost response'); });
  await assert.rejects(sendSms({ to: '08034567890', message: 'Fixture OTP' }), /provider is unreachable/);
  assert.equal(requests.length, 1);
});

test('SMS provider refusals retain the safe classified result and do not retry', async t => {
  const requests = termiiFixture(t, () => new Response('SENDER_ID_NOT_APPROVED', { status: 422 }));
  t.mock.method(console, 'error', () => {});
  const result = await sendSms({ to: '08034567890', message: 'Fixture OTP' });
  assert.equal(result.delivered, false);
  assert.equal(result.skipped, false);
  assert.equal(result.code, 'SMS_SENDER_UNAPPROVED');
  assert.equal(result.providerStatus, 422);
  assert.equal(requests.length, 1);
});

test('local SMS outbox retains its test destination and never calls a provider', async t => {
  const requests = termiiFixture(t);
  const directory = await mkdtemp(path.join(tmpdir(), 'obligon-sms-destination-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  env.SMS_PROVIDER = 'local';
  env.LOCAL_OUTBOX_PATH = path.join(directory, 'outbox.jsonl');
  const result = await sendSms({ to: 'local-test-destination', message: 'Local fixture' });
  assert.equal(result.delivered, true);
  assert.equal(result.simulated, true);
  const record = JSON.parse((await readFile(env.LOCAL_OUTBOX_PATH, 'utf8')).trim());
  assert.equal(record.to, 'local-test-destination');
  assert.equal(record.message, 'Local fixture');
  assert.equal(requests.length, 0);
});

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { normalizeNigeriaCardAddress } from '../src/lib/nigeria-address.js';
import { NIGERIA_CITIES } from '../../../packages/shared/nigeria-cities.mjs';

test('card address keeps the selected State/city and trims a supplied postal code', () => {
  assert.deepEqual(normalizeNigeriaCardAddress({ state: ' Lagos ', city: ' Ikeja ', postalCode: ' 100001 ' }), {
    state: 'Lagos', city: 'Ikeja', postalCode: '100001'
  });
  assert.deepEqual(normalizeNigeriaCardAddress({ state: 'Federal Capital Territory', city: 'Abuja' }), {
    state: 'Federal Capital Territory', city: 'Abuja', postalCode: null
  });
});

test('postal code remains optional without a fabricated location default', () => {
  for (const postalCode of [undefined, null, '', '   ']) {
    assert.equal(normalizeNigeriaCardAddress({ state: 'Akwa Ibom', city: 'Uyo', postalCode }).postalCode, null);
  }
});

test('invalid State/city pairs and coerced values are rejected', () => {
  for (const input of [undefined, null, [], {}, { state: 'Lagos', city: 'Uyo' },
    { state: 'Lagos', city: 'Invented city' }, { state: '__proto__', city: 'Ikeja' },
    { state: ['Lagos'], city: 'Ikeja' }, { state: 'Lagos', city: ['Ikeja'] },
    { state: 'Federal Capital Territory', city: 'Lagos' }, { state: 'Lagos', city: 'ikeja' }]) {
    assert.throws(() => normalizeNigeriaCardAddress(input), { status: 400 });
  }
});

test('nonempty postcode values retain the existing six-digit card-issuer contract', () => {
  for (const postalCode of ['10000', '1000000', '10 001', '10000a', '１００００１', 'LA-11-W06-TC-10', 100001, [], {}]) {
    assert.throws(() => normalizeNigeriaCardAddress({ state: 'Lagos', city: 'Ikeja', postalCode }), { status: 400 });
  }
});

const migration = await readFile(new URL('../src/migrations/040_nigeria_city_catalog.sql', import.meta.url), 'utf8');
test('migration embeds the exact attributed city snapshot used by validation', () => {
  const json = migration.split('$nigeria_cities$')[1];
  assert.deepEqual(JSON.parse(json), NIGERIA_CITIES);
  assert.equal(Object.keys(NIGERIA_CITIES).length, 37);
  assert.equal(Object.values(NIGERIA_CITIES).flat().length, 52320);
  const hash = createHash('sha256').update(JSON.stringify(JSON.parse(json))).digest('hex');
  assert.equal(hash, '8c6370c42edad47225946d688764493ad8a38a6a523cd01282c06abf53fa2348');
  assert.ok(migration.includes(`Canonical JSON SHA-256: ${hash}`));
  assert.match(migration, /CC-BY-4\.0/);
});

const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname));
const databaseName = `nigeria_address_${randomUUID().replaceAll('-', '')}`;
let admin, pool, created = false;
before(async () => {
  if (!database) return;
  admin = new pg.Pool({ connectionString: database });
  await admin.query(`CREATE DATABASE ${databaseName}`);
  created = true;
  const isolated = new URL(database);
  isolated.pathname = `/${databaseName}`;
  pool = new pg.Pool({ connectionString: isolated.toString() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
});
after(async () => {
  await pool?.end();
  if (created) await admin.query(`DROP DATABASE ${databaseName} WITH (FORCE)`);
  await admin?.end();
});

test('local migration stores every pinned city once and the API owner can read it', { skip: !database }, async () => {
  const rows = (await pool.query('SELECT state,city,source_id FROM public.nigeria_cities')).rows;
  assert.equal(rows.length, 52320);
  const expected = new Set(Object.entries(NIGERIA_CITIES).flatMap(([state, cities]) => cities.map(city => JSON.stringify([state, city]))));
  for (const row of rows) {
    assert.equal(row.source_id, 'geonames-ng-2026-10-17');
    assert.ok(expected.delete(JSON.stringify([row.state, row.city])));
  }
  assert.equal(expected.size, 0);
  await assert.rejects(pool.query("INSERT INTO public.nigeria_cities(state,city,source_id) VALUES('Lagos','Ikeja','duplicate')"), { code: '23505' });
});

test('local catalog retains RLS and denies direct anonymous/authenticated access', { skip: !database }, async () => {
  assert.equal((await pool.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.nigeria_cities'::regclass")).rows[0].relrowsecurity, true);
  for (const role of ['anon', 'authenticated']) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${role}`);
      await assert.rejects(client.query('SELECT city FROM public.nigeria_cities LIMIT 1'), { code: '42501' });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }
});

import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import express from 'express';
import { readFile } from 'node:fs/promises';
const url = process.env.OBLIGON_TEST_DATABASE_URL;
if (url) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname));
const schema = `nearest_stations_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const userId = randomUUID();
const check = (name, fn) => test(name, { skip: !url }, fn);
let admin, pool, server, base;
before(async () => {
  if (!url) return;
  admin = new pg.Pool({ connectionString: url });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const isolated = new URL(url);
  isolated.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = isolated.toString();
  process.env.DOTENV_CONFIG_PATH = '/dev/null';
  process.env.NODE_ENV = 'test';
  pool = (await import('../src/db.js')).getPool();
  await pool.query(`CREATE TABLE organizations(id uuid PRIMARY KEY,verification_status text);
    INSERT INTO organizations VALUES('00000000-0000-4000-8000-000000000001','verified');
    CREATE TABLE stations(partner_org_id uuid DEFAULT '00000000-0000-4000-8000-000000000001',id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,address text DEFAULT '',city text DEFAULT '',lat double precision NOT NULL DEFAULT 6.5244,lng double precision NOT NULL DEFAULT 3.3792,status text DEFAULT 'active',fuels text[] DEFAULT '{Petrol}',hours text DEFAULT '24 hours',rating numeric DEFAULT 0);
    CREATE TABLE fuel_prices(station_id uuid,fuel_type text,price_kobo bigint);`);
  await pool.query(`ALTER TABLE organizations ADD COLUMN partner_type text DEFAULT 'fuel_station',ADD COLUMN type text DEFAULT 'partner';
    ALTER TABLE stations ADD COLUMN selling_units jsonb DEFAULT '{}',ADD COLUMN approved_selling_units jsonb DEFAULT '{}';
    ALTER TABLE fuel_prices ADD COLUMN selling_unit text DEFAULT 'litre',ADD COLUMN updated_at timestamptz DEFAULT now();`);
  await pool.query("INSERT INTO stations(name) VALUES('Legacy placeholder')");
  await pool.query(await readFile(new URL('../src/migrations/025_station_coordinates.sql', import.meta.url), 'utf8'));
  const legacy = (await pool.query("SELECT lat,lng,location_confirmed FROM stations WHERE name='Legacy placeholder'")).rows[0];
  assert.equal(legacy.lat, 6.5244);
  assert.equal(legacy.lng, 3.3792);
  assert.equal(legacy.location_confirmed, false);
  const app = express();
  await pool.query("CREATE TABLE card_plans(code text PRIMARY KEY,name text,features jsonb);CREATE TABLE customer_subscriptions(user_id uuid,plan_code text,status text,current_period_start timestamptz,current_period_end timestamptz);INSERT INTO card_plans VALUES('test','Test','[]')");
  await pool.query("INSERT INTO customer_subscriptions VALUES($1,'test','active',now(),now()+interval '1 month')",[userId]);
  app.use((req, res, next) => { req.user = { id: userId, role: 'customer' }; next(); });
  app.use('/api/customer', (await import('../src/routes/customer.routes.js')).default);
  app.use((error, req, res, next) => res.status(error.status ?? 500).json({ message: error.message }));
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/customer/stations`;
});
beforeEach(async () => { if (url) { await pool.query('TRUNCATE stations,fuel_prices'); await pool.query("UPDATE organizations SET verification_status='verified'"); } });
after(async () => {
  if (!url) return;
  await new Promise(resolve => server.close(resolve));
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
});
const add = (name, lat, lng, status = 'active') => pool.query('INSERT INTO stations(name,lat,lng,status,location_confirmed) VALUES($1,$2,$3,$4,TRUE) RETURNING id', [name, lat, lng, status]);
const list = async (query = '') => { const response = await fetch(base + query); assert.equal(response.status, 200); return (await response.json()).stations; };
check('nearest station is ranked before limiting the alphabetical network to 50', async () => {
  for (let n = 0; n < 55; n++) await add(`A distant ${n}`, 30, 30);
  await add('Z closest', 0, 0);
  const rows = await list('?lat=0&lng=0');
  assert.equal(rows.length, 50);
  assert.equal(rows[0].name, 'Z closest');
  assert.equal(rows[0].distanceKm, 0);
});
check('new active stations appear immediately, while pending stations stay unpublished', async () => {
  await add('Far', 10, 10);
  await add('Pending', 0, 0, 'pending');
  assert.equal((await list('?lat=0&lng=0')).length, 1);
  const created = await add('New nearby', 0.01, 0);
  const rows = await list('?lat=0&lng=0');
  assert.equal(rows[0].id, created.rows[0].id);
  assert.ok(rows[0].distanceKm > 1 && rows[0].distanceKm < 2);
});
check('customer movement changes ranking, with unlocated stations last', async () => {
  await add('A unknown', null, null);
  await add('West', 0, 0);
  await add('East', 0, 10);
  assert.equal((await list('?lat=0&lng=0'))[0].name, 'West');
  const rows = await list('?lat=0&lng=10');
  assert.equal(rows[0].name, 'East');
  assert.equal(rows.at(-1).name, 'A unknown');
  assert.equal(rows.at(-1).distanceKm, null);
});
check('no location never invents a Lagos distance', async () => {
  await add('Station', 6.5244, 3.3792);
  const rows = await list();
  assert.equal(rows[0].distanceKm, null);
  assert.equal(rows[0].distance, 'Location unavailable');
  assert.equal(rows[0].diesel, 'Price unavailable');
  assert.equal(rows[0].unleaded, 'Price unavailable');
});

check('station cards expose approved gas prices in their own unit and hide withdrawn offers',async()=>{
  const station=(await add('Approved gas',0,0)).rows[0];
  await pool.query(`UPDATE stations SET fuels='{CNG}',selling_units='{"CNG":"kg"}',approved_selling_units='{"CNG":"kg"}' WHERE id=$1`,[station.id]);
  await pool.query("INSERT INTO fuel_prices(station_id,fuel_type,price_kobo,selling_unit) VALUES($1,'CNG Compressed Gas',150000,'kg')",[station.id]);
  let row=(await list())[0];
  assert.deepEqual(row.prices,[{fuelType:'CNG',priceLabel:'₦1,500',sellingUnit:'kg'}]);
  assert.equal(row.diesel,'Price unavailable');assert.equal(row.unleaded,'Price unavailable');
  await pool.query("UPDATE stations SET approved_selling_units='{}' WHERE id=$1",[station.id]);
  row=(await list())[0];assert.deepEqual(row.prices,[]);
});
check('invalid, incomplete and repeated coordinates are rejected', async () => {
  for (const query of ['?lat=1', '?lng=1', '?lat=&lng=0', '?lat=NaN&lng=0', '?lat=91&lng=0', '?lat=0&lng=181', '?lat=0&lat=1&lng=0']) {
    assert.equal((await fetch(base + query)).status, 400, query);
  }
});
check('fuel filtering preserves nearest ordering and missing fuel prices do not hide new stations', async () => {
  await add('Nearby', 0, 0);
  await add('Far', 10, 10);
  assert.equal((await list('?lat=0&lng=0&fuel=Petrol'))[0].name, 'Nearby');
  assert.equal((await list('?lat=0&lng=0&fuel=Diesel')).length, 0);
});
check('multi-fuel filtering ranks matching verified stations before the network limit',async()=>{
  for(let index=0;index<55;index++) await add(`Nearby petrol ${index}`,0,0);
  const diesel=(await add('Far diesel',10,10)).rows[0];
  const gas=(await add('Far gas',20,20)).rows[0];
  await pool.query("UPDATE stations SET fuels='{Diesel}' WHERE id=$1",[diesel.id]);
  await pool.query("UPDATE stations SET fuels='{LPG}' WHERE id=$1",[gas.id]);
  const pending=(await add('Pending diesel',0,0,'pending')).rows[0];
  await pool.query("UPDATE stations SET fuels='{Diesel}' WHERE id=$1",[pending.id]);
  assert.deepEqual((await list('?lat=0&lng=0&fuels=Diesel,LPG')).map(row=>row.name),['Far diesel','Far gas']);
  assert.deepEqual((await list('?lat=0&lng=0&fuels=Diesel,LPG&search=gas')).map(row=>row.name),['Far gas']);
  await pool.query("UPDATE organizations SET verification_status='pending'");
  assert.equal((await list('?lat=0&lng=0&fuels=Diesel,LPG')).length,0);
});
check('invalid multi-fuel filters and malformed search values are rejected',async()=>{
  for(const query of ['?fuels=','?fuels=Petrol,unknown','?fuels=Petrol,,Diesel','?fuels=Petrol&fuels=Diesel','?fuels=Petrol,Petrol,Petrol,Petrol,Petrol,Petrol','?fuel=Petrol&fuel=Diesel','?search=x&search=y']) assert.equal((await fetch(base+query)).status,400,query);
});

check('new registrations never inherit guessed coordinates and unconfirmed legacy locations stay unranked', async () => {
  await pool.query("INSERT INTO stations(name) VALUES('New station without location')");
  await pool.query("INSERT INTO stations(name,lat,lng) VALUES('Unconfirmed placeholder',6.5244,3.3792)");
  for (const station of await list('?lat=6.5244&lng=3.3792')) {
    assert.equal(station.lat, null);
    assert.equal(station.lng, null);
    assert.equal(station.distanceKm, null);
  }
});

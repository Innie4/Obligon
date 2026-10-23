import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import express from 'express';
const url = process.env.OBLIGON_TEST_DATABASE_URL;
if (url) assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname));
const check = (name, fn) => test(name, { skip: !url }, fn);
const schema = `company_dashboard_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const userId = randomUUID(), orgId = randomUUID(), otherOrgId = randomUUID(), vehicleId = randomUUID(), driverId = randomUUID(), cardId = randomUUID();
const stationPartnerOrgId=randomUUID(),stationOwnerId=randomUUID();
let admin, pool, server, base;
let config;
const actualFetch = globalThis.fetch;
const issuerCalls = [];
let issuerFailure = false;
let issuerIncomplete = false;
before(async () => {
  if (!url) return;
  admin = new pg.Pool({ connectionString:url }); await admin.query(`CREATE SCHEMA ${schema}`);
  const isolated = new URL(url); isolated.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = isolated.toString(); process.env.DOTENV_CONFIG_PATH='/dev/null'; process.env.NODE_ENV='test';
  process.env.SUDO_SECRET_API_KEY='local-provider-fixture'; process.env.SUDO_BASE_URL='https://issuer.example.invalid'; process.env.SUDO_DEBIT_ACCOUNT_ID='fixture-debit';
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith('https://issuer.example.invalid/')) {
      issuerCalls.push({ path:String(input), body:JSON.parse(init.body) });
      if (issuerFailure) return Response.json({message:'Issuer unavailable'}, {status:503});
      if (String(input).endsWith('/customers')) return Response.json({data:{id:'verified-first-customer',isApproved:true}});
      return Response.json({ data: { id:`fixture-issued-${issuerCalls.length}`, cardNumber:'4222333344445511', status:'active', ...(issuerIncomplete ? {} : {expiryMonth:10,expiryYear:2030,brand:'Mastercard'}) } });
    }
    return actualFetch(input, init);
  };
  pool=(await import('../src/db.js')).getPool();
  config=(await import('../src/config/env.js')).env;
  await pool.query(`CREATE TABLE users(id uuid PRIMARY KEY, full_name text,email text, phone text,role text DEFAULT 'company',status text DEFAULT 'active', notification_prefs jsonb DEFAULT '{"email":false,"sms":false,"push":false}'::jsonb);
    CREATE TABLE organizations(id uuid PRIMARY KEY,owner_user_id uuid,name text,type text DEFAULT 'company',rc_number text,address text,city text,website text,description text,credit_limit_kobo bigint DEFAULT 0,plan_code text,fleet_id text,verification_status text DEFAULT 'verified',updated_at timestamptz DEFAULT now());
    CREATE TABLE memberships(id uuid DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,role text,status text DEFAULT 'active',permissions jsonb DEFAULT '[]');
    CREATE TABLE vehicles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,plate text,model text,vehicle_type text DEFAULT 'truck',fuel_type text DEFAULT 'Diesel',tank_capacity_l numeric DEFAULT 100,driver_id uuid,status text DEFAULT 'active',created_at timestamptz DEFAULT now());
    CREATE TABLE drivers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,name text,phone text,license_no text,pin_hash text,status text DEFAULT 'active',created_at timestamptz DEFAULT now());
    CREATE TABLE cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,owner_user_id uuid,vehicle_id uuid,driver_id uuid,label text,holder_name text,masked_pan text,expiry text,brand text,status text,daily_limit_kobo bigint,monthly_limit_kobo bigint,spend_month_kobo bigint DEFAULT 0,sudo_card_id text,sudo_customer_id text,updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
    CREATE TABLE card_actions(card_id uuid,user_id uuid,action text,note text);
    CREATE TABLE audit_logs(id uuid DEFAULT gen_random_uuid(), actor_user_id uuid,actor_role text,action text,entity_type text,entity_id uuid,ip text,metadata jsonb);
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,title text,body text,category text DEFAULT 'general',action_required boolean DEFAULT false,link text,event_key text,in_app_visible boolean DEFAULT true,read_at timestamptz,created_at timestamptz DEFAULT now());
    CREATE UNIQUE INDEX company_event_key ON notifications(event_key) WHERE event_key IS NOT NULL;
    CREATE TABLE stations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,address text,city text,status text DEFAULT 'active',lat numeric,lng numeric,location_confirmed boolean DEFAULT false,hours text,fuels text[] DEFAULT '{}',rating numeric DEFAULT 0);
    CREATE TABLE fuel_prices(station_id uuid,fuel_type text,price_kobo bigint);
    CREATE TABLE transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,vehicle_id uuid,driver_id uuid,card_id uuid,station_id uuid,reference text,fuel_type text DEFAULT 'Diesel',litres numeric DEFAULT 20,amount_kobo bigint DEFAULT 200000,status text DEFAULT 'success',created_at timestamptz DEFAULT now());
    CREATE TABLE maintenance_schedules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,vehicle_id uuid,service_type text,scheduled_date date,cost_kobo bigint,notes text,status text);
    CREATE TABLE support_tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text,user_id uuid,organization_id uuid,subject text,category text,message text,priority text,status text,created_at timestamptz DEFAULT now());
    CREATE TABLE ticket_messages(ticket_id uuid,sender_user_id uuid,sender_role text,body text);
    CREATE TABLE invoices(id uuid DEFAULT gen_random_uuid(),organization_id uuid,number text,amount_kobo bigint,status text,description text,created_at timestamptz DEFAULT now());`);
  await pool.query(`ALTER TABLE organizations ADD COLUMN partner_type text DEFAULT 'fuel_station';
    ALTER TABLE stations ADD COLUMN partner_org_id uuid,ADD COLUMN selling_units jsonb DEFAULT '{}',ADD COLUMN approved_selling_units jsonb DEFAULT '{}';
    ALTER TABLE fuel_prices ADD COLUMN selling_unit text DEFAULT 'litre',ADD COLUMN updated_at timestamptz DEFAULT now();
    ALTER TABLE transactions ADD COLUMN selling_unit text DEFAULT 'litre';`);
  await pool.query(await readFile(new URL('../src/migrations/036_company_card_issuances.sql',import.meta.url),'utf8'));
  await pool.query('INSERT INTO users(id,full_name,email) VALUES($1,$2,$3)',[userId,'Test Company Owner','owner@example.invalid']);
  await pool.query("INSERT INTO users(id,full_name,email,role) VALUES($1,'Test station owner','station@example.invalid','partner')",[stationOwnerId]);
  await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,partner_type,verification_status) VALUES($1,$2,'Verified network partner','partner','fuel_station','verified')",[stationPartnerOrgId,stationOwnerId]);
  await pool.query('INSERT INTO organizations(id,owner_user_id,name) VALUES($1,$2,$3),($4,$2,$5)',[orgId,userId,'Test Fleet',otherOrgId,'Other Fleet']);
  await pool.query('INSERT INTO vehicles(id,organization_id,plate,model) VALUES($1,$2,$3,$4)',[vehicleId,orgId,'LAG-22','Test Truck']);
  await pool.query('INSERT INTO drivers(id,organization_id,name) VALUES($1,$2,$3)',[driverId,orgId,'Ada']);
  await pool.query("INSERT INTO cards(id,organization_id,owner_user_id,vehicle_id,driver_id,label,status,masked_pan,daily_limit_kobo,monthly_limit_kobo,sudo_card_id,sudo_customer_id) VALUES($1,$2,$3,$4,$5,'Existing','active','•••• 1111',10000,100000,'existing-issuer-card','verified-issuer-customer')",[cardId,orgId,userId,vehicleId,driverId]);
  const app=express(); app.use(express.json()); app.use((req,res,next)=>{ req.user={id:userId,orgId,orgType:'company',role:'company',email:'owner@example.invalid'}; next(); });
  let router;
  if (process.env.COMPANY_REPORT_BASELINE === 'true') {
    const require = createRequire(import.meta.url);
    const source = execFileSync('git', ['show', 'HEAD:apps/api/src/routes/company.routes.js'], { cwd: new URL('../../..', import.meta.url), encoding: 'utf8' })
      .replace(/(["'])(\.\.\/[^"']+)\1/g, (_, quote, path) => `${quote}${new URL(path, new URL('../src/routes/company.routes.js', import.meta.url))}${quote}`)
      .replace('from "express"', `from ${JSON.stringify(pathToFileURL(require.resolve('express')).href)}`);
    router = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
  } else router = (await import('../src/routes/company.routes.js')).default;
  app.use('/api/company',router);
  app.use((error,req,res,next)=>res.status(error.status??500).json({message:error.message}));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);}); base=`http://127.0.0.1:${server.address().port}/api/company`;
});
after(async()=>{globalThis.fetch=actualFetch;if(!url)return; await new Promise(resolve=>server.close(resolve));await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
const request=async(path,method='GET',body)=>{if(path==='/cards'&&method==='POST')body={idempotencyKey:randomUUID(),...body};const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=response.headers.get('content-type')?.includes('json')?await response.json():await response.text();return {status:response.status,data};};
const firstHolder={firstName:'Fixture',lastName:'Holder',dob:'1990-01-01',bvn:'20000000000',phone:'+2348000000000',address:'Fixture address',city:'Lagos',state:'Lagos',postalCode:'100001'};
check('first company card validates issuer identity before creating an issuer customer',async()=>{
  await pool.query('UPDATE cards SET sudo_customer_id=NULL');
  assert.equal((await request('/assignments')).data.issuerCustomerConfigured,false);
  const count=issuerCalls.length;
  assert.equal((await request('/cards','POST',{label:'First card',dailyLimit:75000,monthlyLimit:1500000})).status,400);
  assert.equal(issuerCalls.length,count);
});
check('first company card issuer failures never produce local success',async()=>{
  issuerFailure=true;const count=(await pool.query('SELECT COUNT(*)::int AS count FROM cards')).rows[0].count;
  try { const result=await request('/cards','POST',{label:'First card',dailyLimit:75000,monthlyLimit:1500000,holder:firstHolder});assert.equal(result.status,409);assert.match(result.data.message,/Support review/);assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM cards')).rows[0].count,count); }
  finally {issuerFailure=false;await pool.query("DELETE FROM company_card_issuances WHERE state='review_required'");}
});
check('first company card creates the verified issuer customer and stores only provider references',async()=>{
  const result=await request('/cards','POST',{label:'First card',dailyLimit:'75,000',monthlyLimit:'1,500,000',vehicleId,driverId,holder:firstHolder});
  assert.equal(result.status,200,JSON.stringify(result.data));const saved=(await pool.query('SELECT * FROM cards WHERE id=$1',[result.data.cardId])).rows[0];
  assert.equal(saved.sudo_customer_id,'verified-first-customer');assert.equal(saved.holder_name,'Fixture Holder');assert.equal(Number(saved.daily_limit_kobo),7500000);assert.equal(Number(saved.monthly_limit_kobo),150000000);assert.equal(saved.driver_id,driverId);
  assert.doesNotMatch(JSON.stringify(saved),/20000000000/);assert.doesNotMatch(JSON.stringify(result.data),/20000000000/);assert.equal((await request('/assignments')).data.issuerCustomerConfigured,true);
});
check('company card issuance stores exact daily/monthly limits and chosen driver/vehicle',async()=>{
  const result=await request('/cards','POST',{label:'Exact Limits',vehicleId,driverId,dailyLimit:'75,000',monthlyLimit:'1,500,000'}); assert.equal(result.status,200,JSON.stringify(result.data));
  const saved=(await pool.query('SELECT * FROM cards WHERE id=$1',[result.data.cardId])).rows[0]; assert.equal(Number(saved.daily_limit_kobo),7500000);assert.equal(Number(saved.monthly_limit_kobo),150000000);assert.equal(saved.vehicle_id,vehicleId);assert.equal(saved.driver_id,driverId);assert.equal(saved.masked_pan,'•••• •••• •••• 5511');assert.equal(saved.expiry,'10/30');assert.equal(saved.brand,'Mastercard');
  assert.equal((await request('/vehicles')).data.vehicles.filter(vehicle=>vehicle.id===vehicleId).length,1);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM cards WHERE vehicle_id=$1',[vehicleId])).rows[0].count,1);
});
check('invalid limits reject before calling the issuer',async()=>{const count=issuerCalls.length;const result=await request('/cards','POST',{label:'Invalid',dailyLimit:'abc',monthlyLimit:20000});assert.equal(result.status,400);assert.equal(issuerCalls.length,count);});
check('foreign vehicle and driver cannot be assigned or issued into this fleet',async()=>{
  const foreignVehicle=randomUUID(),foreignDriver=randomUUID();await pool.query("INSERT INTO vehicles(id,organization_id,plate) VALUES($1,$2,'FOREIGN')",[foreignVehicle,otherOrgId]);await pool.query("INSERT INTO drivers(id,organization_id,name) VALUES($1,$2,'Foreign')",[foreignDriver,otherOrgId]);
  for(const invalid of [{vehicleId:foreignVehicle},{driverId:foreignDriver}]) { assert.equal((await request('/cards','POST',{label:'Foreign',dailyLimit:1000,monthlyLimit:2000,...invalid})).status,400);assert.equal((await request('/assignments','POST',{cardId,...invalid})).status,404); }
});
check('freeze and unfreeze persist selected card state after the issuer accepts',async()=>{
  assert.equal((await request(`/cards/${cardId}/freeze`,'POST',{note:'Test'})).status,200);assert.equal((await pool.query('SELECT status FROM cards WHERE id=$1',[cardId])).rows[0].status,'frozen');
  assert.equal((await request(`/cards/${cardId}/unfreeze`,'POST',{})).status,200);assert.equal((await pool.query('SELECT status FROM cards WHERE id=$1',[cardId])).rows[0].status,'active');
});
check('assignment choices expose stable IDs and saved assignment survives reload',async()=>{
  assert.equal((await request('/assignments','POST',{cardId,vehicleId,driverId})).status,200);const data=(await request('/assignments')).data.cards.find(card=>card.id===cardId);assert.equal(data.vehicle_id,vehicleId);assert.equal(data.driver_id,driverId);
});
check('profile settings save real organization fields and reload them',async()=>{
  assert.equal((await request('/settings','PUT',{name:'Updated Fleet',address:'Test address',city:'Lagos',rcNumber:'RC-TEST'})).status,200);const org=(await request('/settings')).data.org;assert.equal(org.name,'Updated Fleet');assert.equal(org.address,'Test address');assert.equal(org.rcNumber,'RC-TEST');
});
check('invalid profile names reject without changing saved settings',async()=>{assert.equal((await request('/settings','PUT',{name:'   '})).status,400);assert.equal((await request('/settings')).data.org.name,'Updated Fleet');});
check('mark all read survives API reload and excludes another organization',async()=>{
  await pool.query("INSERT INTO notifications(organization_id,title,body) VALUES($1,'Own','Own'),($2,'Foreign','Foreign')",[orgId,otherOrgId]);assert.equal((await request('/notifications')).data.unreadCount,1);assert.equal((await request('/notifications/read-all','POST',{})).status,200);const own=(await request('/notifications')).data;assert.equal(own.unreadCount,0);assert.equal(own.detailed[0].read,true);assert.equal((await pool.query('SELECT read_at FROM notifications WHERE organization_id=$1',[otherOrgId])).rows[0].read_at,null);
});
check('support ticket form endpoint persists the subject and initial message',async()=>{
  const result=await request('/support/tickets','POST',{subject:'Test issue',message:'Please inspect this test issue.',category:'fleet'});assert.equal(result.status,200,JSON.stringify(result.data));const tickets=(await request('/support/tickets')).data.tickets;assert.equal(tickets[0].subject,'Test issue');assert.equal(tickets[0].reference,result.data.reference);assert.equal((await pool.query('SELECT body FROM ticket_messages')).rows[0].body,'Please inspect this test issue.');
});
check('maintenance uses an owned vehicle and preserves the service date',async()=>{
  const result=await request('/maintenance','POST',{vehicleId,serviceType:'Oil change',scheduledDate:'2026-10-13'});assert.equal(result.status,200,JSON.stringify(result.data));const data=(await request('/maintenance')).data;assert.equal(data.schedules[0].cells[1],'LAG-22');assert.equal(data.schedules[0].cells.length,4);
});
check('transaction list and exports use the same period and exact vehicle/driver filters',async()=>{
  const secondVehicle=randomUUID(),secondDriver=randomUUID();await pool.query("INSERT INTO vehicles(id,organization_id,plate) VALUES($1,$2,'LAG-220')",[secondVehicle,orgId]);await pool.query("INSERT INTO drivers(id,organization_id,name) VALUES($1,$2,'Ada Extended')",[secondDriver,orgId]);
  await pool.query("INSERT INTO transactions(organization_id,vehicle_id,driver_id,reference,created_at) VALUES($1,$2,$3,'OWN-RECENT',now()),($1,$2,$3,'OWN-OLD',now()-interval '60 days'),($1,$4,$5,'SUBSTRING',now()),($6,$2,$3,'OTHER-ORG',now())",[orgId,vehicleId,driverId,secondVehicle,secondDriver,otherOrgId]);
  const query='range=30&vehicle=LAG-22&driver=Ada';const list=(await request('/transactions?'+query)).data;assert.equal(list.total,1);assert.equal(list.transactions[0].reference,'OWN-RECENT');const csv=await request('/reports/export?format=csv&scope=transactions&'+query);assert.equal(csv.status,200);assert.match(csv.data,/OWN-RECENT/);assert.doesNotMatch(csv.data,/OWN-OLD|SUBSTRING|OTHER-ORG/);
  assert.match((await request('/reports/export?format=csv&scope=transactions&range=90&vehicle=LAG-22&driver=Ada')).data,/OWN-OLD/);
});
check('vehicle scope exports current fleet records rather than transactions',async()=>{const csv=await request('/reports/export?scope=vehicles&range=7');assert.equal(csv.status,200);assert.match(csv.data,/LAG-22/);assert.doesNotMatch(csv.data,/OWN-RECENT|FOREIGN/);});
check('PDF exports remain supported',async()=>{const response=await fetch(base+'/reports/export?format=pdf&scope=transactions&range=30');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal((await response.text()).slice(0,4),'%PDF');});
check('station locator exposes actual approved per-fuel prices and no guessed coordinates',async()=>{const stationId=randomUUID();await pool.query(`INSERT INTO stations(id,partner_org_id,name,address,city,hours,fuels,selling_units,approved_selling_units) VALUES($1,$2,'Test station','Test road','Lagos','24 hours','{AGO}','{"AGO":"litre"}','{"AGO":"litre"}')`,[stationId,stationPartnerOrgId]);await pool.query("INSERT INTO fuel_prices(station_id,fuel_type,price_kobo) VALUES($1,'Diesel',139000)",[stationId]);const result=await request('/stations?search=Test');assert.equal(result.status,200,JSON.stringify(result.data));const data=result.data.details[0];assert.equal(data.lat,null);assert.equal(data.lng,null);assert.equal(data.prices[0].fuel,'AGO');assert.equal(data.prices[0].sellingUnit,'litre');assert.match(data.prices[0].priceLabel,/1,390/);});

check('empty PDF exports fit portrait width and remain valid PDFs',async()=>{const response=await fetch(base+'/reports/export?format=pdf&scope=transactions&range=1&vehicle=MISSING');assert.equal(response.status,200);const pdf=await response.text();assert.equal(pdf.slice(0,4),'%PDF');assert.match(pdf,/\/MediaBox \[0 0 595\.28 841\.89\]/);});

check('maintenance exports respect the historical range and exclude future schedules',async()=>{
  await pool.query("INSERT INTO maintenance_schedules(organization_id,vehicle_id,service_type,scheduled_date,status) VALUES($1,$2,'RECENT',current_date-2,'scheduled'),($1,$2,'OLD',current_date-60,'completed'),($1,$2,'FUTURE',current_date+2,'scheduled')",[orgId,vehicleId]);
  const result=await request('/reports/export?scope=maintenance&range=30');assert.equal(result.status,200);assert.match(result.data,/RECENT/);assert.doesNotMatch(result.data,/OLD|FUTURE/);
});
check('concurrent assignments leave one card assigned to the selected vehicle',async()=>{
  const second=(await pool.query('SELECT id FROM cards WHERE id<>$1 LIMIT 1',[cardId])).rows[0].id;
  const responses=await Promise.all([request('/assignments','POST',{cardId,vehicleId,driverId}),request('/assignments','POST',{cardId:second,vehicleId,driverId})]);
  assert.equal(responses[0].status,200);assert.equal(responses[1].status,200);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM cards WHERE vehicle_id=$1',[vehicleId])).rows[0].count,1);
});

check('incomplete issuer response cannot create a fabricated active company card',async()=>{
  const before=(await pool.query('SELECT COUNT(*)::int AS count FROM cards')).rows[0].count;issuerIncomplete=true;
  try { const result=await request('/cards','POST',{label:'Incomplete response',dailyLimit:1000,monthlyLimit:2000});assert.equal(result.status,409);assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM cards')).rows[0].count,before); }
  finally {issuerIncomplete=false;}
});

check('overview new vehicle metric counts the current month rather than the previous month',async()=>{
  await pool.query("INSERT INTO vehicles(organization_id,plate,created_at) VALUES($1,'LAST-MONTH',date_trunc('month',now())-interval '5 days')",[orgId]);
  const current=(await pool.query("SELECT COUNT(*)::int AS count FROM vehicles WHERE organization_id=$1 AND created_at>=date_trunc('month',now())",[orgId])).rows[0].count;
  const result=await request('/overview');assert.equal(result.status,200);assert.equal(result.data.metrics[0].helper,`+${current} this month`);
});

check('concurrent opposite vehicle swaps serialize without a deadlock or duplicate assignments',async()=>{
  const secondCard=randomUUID(),secondVehicle=randomUUID();
  await pool.query("INSERT INTO vehicles(id,organization_id,plate) VALUES($1,$2,'SWAP-SECOND')",[secondVehicle,orgId]);
  await pool.query("INSERT INTO cards(id,organization_id,owner_user_id,label,masked_pan,status,daily_limit_kobo,monthly_limit_kobo) VALUES($1,$2,$3,'Swap card','•••• 2222','active',10000,100000)",[secondCard,orgId,userId]);
  await request('/assignments','POST',{cardId,vehicleId,driverId});
  await request('/assignments','POST',{cardId:secondCard,vehicleId:secondVehicle,driverId});
  await pool.query(`CREATE FUNCTION delay_swap_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.1); RETURN NEW; END $$; CREATE TRIGGER delay_swap BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION delay_swap_update();`);
  let results;
  try { results=await Promise.all([request('/assignments','POST',{cardId,vehicleId:secondVehicle,driverId}),request('/assignments','POST',{cardId:secondCard,vehicleId,driverId})]); }
  finally { await pool.query('DROP TRIGGER delay_swap ON cards; DROP FUNCTION delay_swap_update()'); }
  assert.equal(results[0].status,200,JSON.stringify(results[0].data));assert.equal(results[1].status,200,JSON.stringify(results[1].data));
  const saved=(await pool.query('SELECT id,vehicle_id FROM cards WHERE id=ANY($1::uuid[])',[[cardId,secondCard]])).rows;
  assert.equal(saved.find(card=>card.id===cardId).vehicle_id,secondVehicle);assert.equal(saved.find(card=>card.id===secondCard).vehicle_id,vehicleId);
});
check('report station usage returns the actual station name',async()=>{
  const stationId=randomUUID();await pool.query("INSERT INTO stations(id,name) VALUES($1,'Actual report station')",[stationId]);await pool.query("INSERT INTO transactions(organization_id,station_id,vehicle_id,driver_id,reference) VALUES($1,$2,$3,$4,'NAMED-STATION')",[orgId,stationId,vehicleId,driverId]);
  const result=await request('/reports');assert.equal(result.status,200);assert.ok(result.data.stationUsage.some(row=>row.station==='Actual report station'));
});
check('duplicate driver names are filtered and exported by distinct stable IDs',async()=>{
  const first=randomUUID(),second=randomUUID();await pool.query("INSERT INTO drivers(id,organization_id,name) VALUES($1,$3,'Sam Example'),($2,$3,'Sam Example')",[first,second,orgId]);
  await pool.query("INSERT INTO transactions(organization_id,vehicle_id,driver_id,reference) VALUES($1,$2,$3,'SAM-FIRST'),($1,$2,$4,'SAM-SECOND')",[orgId,vehicleId,first,second]);
  for(const [id,reference,other] of [[first,'SAM-FIRST','SAM-SECOND'],[second,'SAM-SECOND','SAM-FIRST']]) {
    const list=await request('/transactions?range=30&driverId='+id);assert.equal(list.status,200);assert.equal(list.data.total,1);assert.equal(list.data.transactions[0].reference,reference);
    const csv=await request('/reports/export?scope=transactions&range=30&driverId='+id);assert.equal(csv.status,200);assert.match(csv.data,new RegExp(reference));assert.doesNotMatch(csv.data,new RegExp(other));
  }
  const legacy=await request('/transactions?range=30&driver=Sam%20Example');assert.equal(legacy.status,200);assert.equal(legacy.data.total,2);
});
check('malformed stable driver IDs return a validation error instead of a database 500',async()=>{
  for(const value of ['Sam%20Example','bad-id','1','']) for(const path of ['/transactions?driverId=','/reports/export?driverId=']) assert.equal((await request(path+value)).status,400);
});

check('vehicle editing exposes the full draft and persists a driver change without a fuel card',async()=>{
  const vehicle=randomUUID(),driver=randomUUID();
  await pool.query("INSERT INTO vehicles(id,organization_id,plate,model,vehicle_type,fuel_type,tank_capacity_l) VALUES($1,$2,'EDIT-VEHICLE','Toyota Hilux','pickup','Diesel',80)",[vehicle,orgId]);
  await pool.query("INSERT INTO drivers(id,organization_id,name) VALUES($1,$2,'New vehicle driver')",[driver,orgId]);
  const listed=(await request('/vehicles?search=EDIT-VEHICLE')).data.vehicles[0];
  assert.equal(listed.id,vehicle);assert.equal(listed.vehicleType,'pickup');assert.equal(listed.model,'Toyota Hilux');assert.equal(listed.driverId,null);
  assert.equal((await request(`/vehicles/${vehicle}`,'PUT',{model:'Updated Hilux',driverId:driver,tankCapacity:85})).status,200);
  const saved=(await pool.query('SELECT * FROM vehicles WHERE id=$1',[vehicle])).rows[0];
  assert.equal(saved.model,'Updated Hilux');assert.equal(saved.driver_id,driver);assert.equal(Number(saved.tank_capacity_l),85);assert.equal(saved.vehicle_type,'pickup');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM cards WHERE vehicle_id=$1',[vehicle])).rows[0].n,0);
});
check('omitted vehicle driver preserves assignment while explicit null clears it',async()=>{
  const vehicle=randomUUID();
  await pool.query("INSERT INTO vehicles(id,organization_id,plate,driver_id) VALUES($1,$2,'CLEAR-DRIVER',$3)",[vehicle,orgId,driverId]);
  assert.equal((await request(`/vehicles/${vehicle}`,'PUT',{model:'Driver unchanged'})).status,200);
  assert.equal((await pool.query('SELECT driver_id FROM vehicles WHERE id=$1',[vehicle])).rows[0].driver_id,driverId);
  assert.equal((await request(`/vehicles/${vehicle}`,'PUT',{driverId:null})).status,200);
  assert.equal((await pool.query('SELECT driver_id FROM vehicles WHERE id=$1',[vehicle])).rows[0].driver_id,null);
});
check('vehicle updates reject malformed and foreign drivers without changing the fleet',async()=>{
  const vehicle=randomUUID(),foreignDriver=randomUUID();
  await pool.query("INSERT INTO vehicles(id,organization_id,plate) VALUES($1,$2,'DRIVER-BOUNDARY')",[vehicle,orgId]);
  await pool.query("INSERT INTO drivers(id,organization_id,name) VALUES($1,$2,'Foreign driver')",[foreignDriver,otherOrgId]);
  for(const driver of ['',false,42,{},[],[driverId],foreignDriver])assert.equal((await request(`/vehicles/${vehicle}`,'PUT',{driverId:driver})).status,400,JSON.stringify(driver));
  assert.equal((await pool.query('SELECT driver_id FROM vehicles WHERE id=$1',[vehicle])).rows[0].driver_id,null);
});
check('vehicle driver UUID arrays cannot be coerced into a scalar assignment',async()=>{
  const vehicle=randomUUID();
  await pool.query("INSERT INTO vehicles(id,organization_id,plate) VALUES($1,$2,'DRIVER-ARRAY')",[vehicle,orgId]);
  const response=await request(`/vehicles/${vehicle}`,'PUT',{driverId:[driverId]});
  assert.equal(response.status,400);assert.equal((await pool.query('SELECT driver_id FROM vehicles WHERE id=$1',[vehicle])).rows[0].driver_id,null);
});
check('unavailable issuer is disclosed before identity collection and cannot create any card or customer',async()=>{
  const beforeCalls=issuerCalls.length, beforeCards=(await pool.query('SELECT count(*)::int AS n FROM cards')).rows[0].n;
  const previous={key:config.SUDO_SECRET_API_KEY,debit:config.SUDO_DEBIT_ACCOUNT_ID,source:config.SUDO_FUNDING_SOURCE_ID,node:config.NODE_ENV,url:config.SUDO_BASE_URL};
  try {
    for(const unavailable of [
      {SUDO_SECRET_API_KEY:''},
      {SUDO_SECRET_API_KEY:previous.key,SUDO_DEBIT_ACCOUNT_ID:''},
      {SUDO_DEBIT_ACCOUNT_ID:previous.debit,SUDO_FUNDING_SOURCE_ID:'unsupported-fixture-source'},
      {SUDO_FUNDING_SOURCE_ID:'',NODE_ENV:'production',SUDO_BASE_URL:'https://api.sandbox.sudo.cards'},
    ]){
      Object.assign(config,unavailable);
      const choices=await request('/assignments');assert.equal(choices.status,200);assert.equal(choices.data.issuerReady,false);
      assert.equal(Object.hasOwn(choices.data,'SUDO_SECRET_API_KEY'),false);
      const denied=await request('/cards','POST',{label:'Unavailable issuer',dailyLimit:1000,monthlyLimit:2000,holder:firstHolder});
      assert.equal(denied.status,503);assert.match(denied.data.message,/Card issuing is currently unavailable/);
    }
    assert.equal(issuerCalls.length,beforeCalls);assert.equal((await pool.query('SELECT count(*)::int AS n FROM cards')).rows[0].n,beforeCards);
  } finally {Object.assign(config,{SUDO_SECRET_API_KEY:previous.key,SUDO_DEBIT_ACCOUNT_ID:previous.debit,SUDO_FUNDING_SOURCE_ID:previous.source,NODE_ENV:previous.node,SUDO_BASE_URL:previous.url});}
  assert.equal((await request('/assignments')).data.issuerReady,true);
});

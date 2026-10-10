import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url = process.env.OBLIGON_TEST_DATABASE_URL;
if (url) assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname), 'Only isolated local PostgreSQL may be used');
const schema = `fuel_sale_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const integration = (name, fn) => test(name, { skip: !url }, fn);
let admin, pool, tx, authorize, approvedDiscount, customerSubscription, activateCustomerSubscription;
before(async () => {
 if (!url) return;
 admin = new pg.Pool({ connectionString: url });
 await admin.query(`CREATE SCHEMA ${schema}`);
 const isolated = new URL(url);
 isolated.searchParams.set('options', `-c search_path=${schema} -c timezone=UTC`);
 process.env.DATABASE_URL = isolated.toString();
 process.env.DOTENV_CONFIG_PATH = '/dev/null'; process.env.NODE_ENV = 'test'; process.env.BUSINESS_TIMEZONE = 'Africa/Lagos';
 const db = await import('../src/db.js'); pool = db.getPool(); tx = db.tx;
 ({ authorizeWalletFuelSale: authorize } = await import('../src/lib/fuel-sale.js'));
 ({ approvedDiscount } = await import('../src/lib/discounts.js'));
 ({ customerSubscription, activateCustomerSubscription } = await import('../src/lib/subscriptions.js'));
 await pool.query(`
 CREATE TABLE cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pos_code text UNIQUE, pos_code_expires_at timestamptz, status text DEFAULT 'active', owner_user_id uuid, organization_id uuid, vehicle_id uuid, driver_id uuid, daily_limit_kobo bigint DEFAULT 100000, monthly_limit_kobo bigint DEFAULT 1000000, spend_today_kobo bigint DEFAULT 0, spend_month_kobo bigint DEFAULT 0, updated_at timestamptz DEFAULT now());
 CREATE TABLE stations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_org_id uuid, name text DEFAULT 'Test station');
 CREATE TABLE bank_accounts(id uuid DEFAULT gen_random_uuid(), organization_id uuid, verified boolean DEFAULT true, is_default boolean DEFAULT true);
 CREATE TABLE fuel_prices(station_id uuid, fuel_type text, price_kobo bigint, PRIMARY KEY(station_id,fuel_type));
 CREATE TABLE discount_review_states(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code text UNIQUE);
 INSERT INTO discount_review_states(code) VALUES ('pending'),('approved'),('rejected');
 CREATE TABLE station_discount_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),station_id uuid,fuel_type text,rate_bp int,review_state_id bigint,starts_at timestamptz,ends_at timestamptz,reviewed_at timestamptz DEFAULT now());
 CREATE TABLE card_plans(code text PRIMARY KEY,name text,features jsonb DEFAULT '[]');
 INSERT INTO card_plans(code,name) VALUES ('gold','Gold');
 CREATE TABLE customer_subscriptions(user_id uuid PRIMARY KEY,plan_code text,payment_reference text,status text DEFAULT 'active',current_period_start timestamptz,current_period_end timestamptz,updated_at timestamptz DEFAULT now());
 CREATE TABLE wallets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,organization_id uuid,balance_kobo bigint CHECK(balance_kobo>=0),budget_limit_kobo bigint DEFAULT 0);
 CREATE TABLE wallet_ledger(wallet_id uuid,direction text,amount_kobo bigint,balance_after_kobo bigint,reference text,idempotency_key text UNIQUE,description text,created_at timestamptz DEFAULT now());
 CREATE TABLE transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE,customer_user_id uuid,organization_id uuid,station_id uuid,vehicle_id uuid,driver_id uuid,card_id uuid,fuel_type text,litres numeric,amount_kobo bigint,base_amount_kobo bigint,platform_fee_kobo bigint,partner_net_kobo bigint,discount_request_id uuid,settlement_method text,status text,meta text,created_at timestamptz DEFAULT now());
 CREATE TABLE fuel_orders(card_id uuid,amount_kobo bigint,created_at timestamptz DEFAULT now(),status text,reservation_expires_at timestamptz);
 CREATE TABLE fueling_logs(station_id uuid,transaction_id uuid,fuel_type text,litres numeric);
 `);
});
beforeEach(async () => { if(url) await pool.query('TRUNCATE cards,stations,bank_accounts,fuel_prices,station_discount_requests,customer_subscriptions,wallets,wallet_ledger,transactions,fueling_logs,fuel_orders'); });
after(async () => { if(!url) return; await pool?.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
async function setup() {
 const user = randomUUID(), org = randomUUID();
 const { rows:[station] }=await pool.query('INSERT INTO stations(partner_org_id) VALUES($1) RETURNING id',[org]);
 const { rows:[card] }=await pool.query("INSERT INTO cards(owner_user_id,pos_code,pos_code_expires_at) VALUES($1,'123456',now()+interval '10 minutes') RETURNING id",[user]);
 const { rows:[wallet] }=await pool.query('INSERT INTO wallets(user_id,balance_kobo) VALUES($1,100000) RETURNING id',[user]);
 await pool.query('INSERT INTO bank_accounts(organization_id) VALUES($1)',[org]);
 await pool.query("INSERT INTO fuel_prices(station_id,fuel_type,price_kobo) VALUES($1,'Petrol',1000)",[station.id]);
 await pool.query("INSERT INTO customer_subscriptions(user_id,plan_code,current_period_start,current_period_end,payment_reference) VALUES($1,'gold',now()-interval '1 day',now()+interval '30 days','approved-card')",[user]);
 return { user, org, station: station.id, card: card.id, wallet: wallet.id };
}
const buy = (f, overrides={}) => tx(t => authorize(t,{ partnerOrgId:f.org, stationId:f.station,code:'123456',litres:10,fuelType:'Petrol',reference:`TXN-${randomUUID()}`,...overrides }));
async function unchanged(f) {
 const { rows:[state] }=await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[f.wallet]); assert.equal(Number(state.balance_kobo),100000);
 const { rows:[n] }=await pool.query('SELECT count(*)::int AS n FROM transactions'); assert.equal(n.n,0);
 const { rows:[card] }=await pool.query('SELECT pos_code FROM cards WHERE id=$1',[f.card]); assert.equal(card.pos_code,'123456');
}
integration('POS debits wallet and records exactly the selected station price',async()=>{
 const f=await setup(); const { rows:[other] }=await pool.query('INSERT INTO stations(partner_org_id) VALUES($1) RETURNING id',[f.org]);
 await pool.query("INSERT INTO fuel_prices VALUES($1,'Petrol',5000)",[other.id]);
 const result=await buy(f); assert.equal(Number(result.sale.amount_kobo),10000); assert.equal(result.sale.station_id,f.station);
 const {rows:[wallet]}=await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[f.wallet]); assert.equal(Number(wallet.balance_kobo),90000);
});
integration('insufficient wallet rolls back sale, counters, code and ledger',async()=>{
 const f=await setup();await pool.query('UPDATE wallets SET balance_kobo=9000 WHERE id=$1',[f.wallet]);
 await assert.rejects(buy(f),/Insufficient wallet/);
 const {rows:[wallet]}=await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[f.wallet]);assert.equal(Number(wallet.balance_kobo),9000);
 const {rows:[ledger]}=await pool.query('SELECT count(*)::int AS n FROM wallet_ledger');assert.equal(ledger.n,0);
 const {rows:[card]}=await pool.query('SELECT pos_code,spend_today_kobo FROM cards WHERE id=$1',[f.card]);assert.equal(card.pos_code,'123456');assert.equal(Number(card.spend_today_kobo),0);
});
integration('daily spend limit includes completed purchases',async()=>{
 const f=await setup();await pool.query('UPDATE cards SET daily_limit_kobo=12000 WHERE id=$1',[f.card]);
 await pool.query("INSERT INTO transactions(card_id,amount_kobo,status) VALUES($1,3000,'success')",[f.card]);
 await assert.rejects(buy(f),/daily or monthly limit/);
 const {rows:[wallet]}=await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[f.wallet]);assert.equal(Number(wallet.balance_kobo),100000);
});
integration('monthly limit includes purchases from earlier business days',async()=>{
 const f=await setup();await pool.query('UPDATE cards SET monthly_limit_kobo=12000 WHERE id=$1',[f.card]);
 await pool.query("INSERT INTO transactions(card_id,amount_kobo,status,created_at) VALUES($1,3000,'success',date_trunc('month',now())+interval '1 hour')",[f.card]);
 await assert.rejects(buy(f),/daily or monthly limit/);
});
integration('expired customer subscription cannot buy fuel',async()=>{
 const f=await setup();await pool.query("UPDATE customer_subscriptions SET current_period_end=now()-interval '1 second' WHERE user_id=$1",[f.user]);
 await assert.rejects(buy(f),/active paid subscription/); await unchanged(f);
});
integration('missing customer subscription cannot buy fuel',async()=>{
 const f=await setup();await pool.query('DELETE FROM customer_subscriptions WHERE user_id=$1',[f.user]);
 await assert.rejects(buy(f),/active paid subscription/);await unchanged(f);
});
integration('invalid code is rejected without falling back to a driver PIN',async()=>{
 const f=await setup();await assert.rejects(buy(f,{code:'654321'}),/Invalid, expired, or inactive/);await unchanged(f);
});
integration('station belonging to another partner cannot be charged',async()=>{
 const f=await setup();await assert.rejects(buy(f,{partnerOrgId:randomUUID()}),/Station not found/);await unchanged(f);
});
integration('one authorization code permits one atomic sale across concurrent requests',async()=>{
 const f=await setup();const results=await Promise.allSettled([buy(f),buy(f)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const {rows:[wallet]}=await pool.query('SELECT balance_kobo FROM wallets WHERE id=$1',[f.wallet]);assert.equal(Number(wallet.balance_kobo),90000);
 const {rows:[n]}=await pool.query('SELECT count(*)::int AS n FROM wallet_ledger');assert.equal(n.n,1);
});
async function discount(f,state,start,end) {
 await pool.query(`INSERT INTO station_discount_requests(station_id,fuel_type,rate_bp,review_state_id,starts_at,ends_at) VALUES($1,'Petrol',1000,(SELECT id FROM discount_review_states WHERE code=$2),${start},${end})`,[f.station,state]);
}
integration('approved active discount charges customer 9000, partner 8000, platform 1000',async()=>{
 const f=await setup();await discount(f,'approved',"now()-interval '1 day'","now()+interval '1 day'");const result=await buy(f);
 assert.deepEqual([Number(result.sale.base_amount_kobo),Number(result.sale.amount_kobo),Number(result.sale.partner_net_kobo),Number(result.sale.platform_fee_kobo)],[10000,9000,8000,1000]);assert.ok(result.sale.discount_request_id);
});
integration('pending discount leaves published price unchanged',async()=>{
 const f=await setup();await discount(f,'pending',"now()-interval '1 day'","now()+interval '1 day'");const result=await buy(f);assert.equal(Number(result.sale.amount_kobo),10000);assert.equal(result.sale.discount_request_id,null);
});
integration('expired approved discount leaves published price unchanged',async()=>{
 const f=await setup();await discount(f,'approved',"now()-interval '2 days'","now()-interval '1 day'");const result=await buy(f);assert.equal(Number(result.sale.amount_kobo),10000);
});
integration('future approved discount does not apply before its scheduled start',async()=>{
 const f=await setup();await discount(f,'approved',"now()+interval '1 day'","now()+interval '2 days'");const result=await buy(f);assert.equal(Number(result.sale.amount_kobo),10000);
});
integration('replaying approval never extends an already activated paid subscription',async()=>{
 const f=await setup(); const request={user_id:f.user,plan_code:'gold',payment_reference:'new-approved'};
 await tx(t=>activateCustomerSubscription(t,request));const before=await customerSubscription(f.user);await tx(t=>activateCustomerSubscription(t,request));const after=await customerSubscription(f.user);
 assert.equal(after.subscription.current_period_end.toISOString(),before.subscription.current_period_end.toISOString());assert.equal(after.active,true);
});

integration('monthly wallet budget includes previous fuel debits and rolls back excess purchases',async()=>{
 const f=await setup();await pool.query('UPDATE wallets SET budget_limit_kobo=12000 WHERE id=$1',[f.wallet]);
 await pool.query("INSERT INTO wallet_ledger(wallet_id,direction,amount_kobo,balance_after_kobo,reference) VALUES($1,'debit',3000,100000,'TXN-previous')",[f.wallet]);
 await assert.rejects(buy(f),/budget/);await unchanged(f);
});

integration('active direct checkout reservations block wallet POS purchases above card limits',async()=>{
 const f=await setup();await pool.query('UPDATE cards SET daily_limit_kobo=12000 WHERE id=$1',[f.card]);
 await pool.query("INSERT INTO fuel_orders(card_id,amount_kobo,status,reservation_expires_at) VALUES($1,3000,'awaiting_payment',now()+interval '10 minutes')",[f.card]);
 await assert.rejects(buy(f),/daily or monthly limit/);await unchanged(f);
});
integration('expired direct checkout reservations do not block wallet POS purchases',async()=>{
 const f=await setup();await pool.query('UPDATE cards SET daily_limit_kobo=12000 WHERE id=$1',[f.card]);
 await pool.query("INSERT INTO fuel_orders(card_id,amount_kobo,status,reservation_expires_at) VALUES($1,3000,'awaiting_payment',now()-interval '1 second')",[f.card]);
 const result=await buy(f);assert.equal(Number(result.sale.amount_kobo),10000);
});

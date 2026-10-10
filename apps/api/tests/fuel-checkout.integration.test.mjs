import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.OBLIGON_TEST_DATABASE_URL;
if (url) assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname), 'Only an isolated localhost test database is allowed');
const schema = `fuel_checkout_${process.pid}_${randomUUID().replaceAll('-','')}`;
let admin, pool, service, fixtures, created = false;
const integration = (name, run) => test(name,{skip:!url},run);
before(async()=>{
 if(!url)return;
 admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);created=true;
 const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema} -c timezone=UTC`);
 process.env.DATABASE_URL=isolated.toString();process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';process.env.BUSINESS_TIMEZONE='Africa/Lagos';
 pool=(await import('../src/db.js')).getPool();
 await pool.query(`
 CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text,full_name text,phone text);
 CREATE TABLE organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
 CREATE TABLE pricing_plans(code text PRIMARY KEY,name text,features jsonb DEFAULT '[]',price_kobo bigint DEFAULT 100);
 CREATE TABLE subscriptions(organization_id uuid,plan_code text,status text,current_period_start timestamptz,current_period_end timestamptz);
 CREATE TABLE stations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_org_id uuid REFERENCES organizations(id),name text DEFAULT 'Test station',status text DEFAULT 'active',is_open boolean DEFAULT true);
 CREATE TABLE card_plans(code text PRIMARY KEY,name text,features jsonb DEFAULT '[]');
 CREATE TABLE customer_subscriptions(user_id uuid,plan_code text,current_period_start timestamptz,current_period_end timestamptz,status text);
 CREATE TABLE cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_user_id uuid,organization_id uuid,status text DEFAULT 'active',daily_limit_kobo bigint DEFAULT 100000,monthly_limit_kobo bigint DEFAULT 1000000,created_at timestamptz DEFAULT now());
 CREATE TABLE fuel_prices(station_id uuid,fuel_type text,price_kobo bigint);
 CREATE TABLE discount_review_states(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,code text);
 CREATE TABLE station_discount_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),station_id uuid,fuel_type text,rate_bp integer,starts_at timestamptz,ends_at timestamptz,reviewed_at timestamptz DEFAULT now(),review_state_id bigint);
 CREATE TABLE settlement_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,bank_account_id uuid,provider text DEFAULT 'flutterwave',status text DEFAULT 'active',subaccount_id text DEFAULT 'RS_TEST',currency text DEFAULT 'NGN');
 CREATE UNIQUE INDEX ON settlement_accounts(organization_id) WHERE status='active';
 CREATE TABLE bank_accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,is_default boolean DEFAULT true,verified boolean DEFAULT true);
 CREATE TABLE transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE,customer_user_id uuid,station_id uuid,card_id uuid,fuel_type text,litres numeric,amount_kobo bigint,base_amount_kobo bigint,platform_fee_kobo bigint,partner_net_kobo bigint,discount_request_id uuid,settlement_method text,status text,meta text,created_at timestamptz DEFAULT now());
 CREATE TABLE fueling_logs(station_id uuid,transaction_id uuid,fuel_type text,litres numeric);
 `);
 const migration=await readFile(new URL('../src/migrations/023_fuel_orders.sql',import.meta.url),'utf8');await pool.query(`BEGIN;${migration}COMMIT;`);
 service=await import('../src/lib/fuel-checkout.js');
});
beforeEach(async()=>{
 if(!url)return;
 await pool.query('TRUNCATE users,organizations,pricing_plans,subscriptions,stations,card_plans,customer_subscriptions,cards,fuel_prices,discount_review_states,station_discount_requests,settlement_accounts,bank_accounts,transactions,fueling_logs,fuel_orders CASCADE');
 const {rows:[user]}=await pool.query("INSERT INTO users(email,full_name)VALUES('test@example.invalid','Test customer')RETURNING *");
 const {rows:[org]}=await pool.query('INSERT INTO organizations DEFAULT VALUES RETURNING id');
 const {rows:[station]}=await pool.query('INSERT INTO stations(partner_org_id)VALUES($1)RETURNING id',[org.id]);
 await pool.query("INSERT INTO pricing_plans(code,name)VALUES('basic','Basic')");
 await pool.query("INSERT INTO subscriptions VALUES($1,'basic','active',now()-interval '1 day',now()+interval '1 month')",[org.id]);
 await pool.query("INSERT INTO card_plans(code,name)VALUES('basic','Basic');");
 await pool.query("INSERT INTO customer_subscriptions VALUES($1,'basic',now()-interval '1 day',now()+interval '1 month','active')",[user.id]);
 const {rows:[card]}=await pool.query('INSERT INTO cards(owner_user_id)VALUES($1)RETURNING id',[user.id]);
 await pool.query("INSERT INTO fuel_prices VALUES($1,'PMS Petrol',1000)",[station.id]);
 await pool.query("INSERT INTO discount_review_states(code)VALUES('approved'),('pending')");
 await pool.query("INSERT INTO station_discount_requests(station_id,fuel_type,rate_bp,starts_at,ends_at,review_state_id)SELECT $1,'PMS Petrol',1000,now()-interval '1 day',now()+interval '1 day',id FROM discount_review_states WHERE code='approved'",[station.id]);
 const {rows:[bank]}=await pool.query('INSERT INTO bank_accounts(organization_id)VALUES($1)RETURNING id',[org.id]);
 const {rows:[account]}=await pool.query('INSERT INTO settlement_accounts(organization_id,bank_account_id)VALUES($1,$2)RETURNING id',[org.id,bank.id]);
 fixtures={user,orgId:org.id,stationId:station.id,cardId:card.id,bankId:bank.id,accountId:account.id,input:{stationId:station.id,fuelType:'PMS Petrol',litres:10,idempotencyKey:randomUUID()},calls:[]};
});
after(async()=>{await pool?.end();if(created)await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin?.end();});
function payments(overrides={}){
 return {activeProvider:()=> 'flutterwave',startCheckout:async args=>{fixtures.calls.push(args);return{authorization_url:'https://checkout.flutterwave.com/test',simulated:false,provider:'flutterwave',reference:args.txRef};},verifyCheckout:async args=>({paid:true,amountKobo:args.expectedAmountKobo,currency:'NGN',reference:args.reference,providerTransactionId:'101',...overrides})};
}
integration('station checkout charges 9000 and splits 1000 platform fee and 8000 station earnings',async()=>{
 const result=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 assert.equal(result.order.amount_kobo,'9000');
 assert.deepEqual(fixtures.calls[0].split,{subaccountId:'RS_TEST',platformFeeKobo:1000});
 assert.equal(fixtures.calls[0].amountKobo,9000);
});
integration('the same checkout idempotency key opens one provider payment',async()=>{
 const a=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 const b=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 assert.equal(a.order.reference,b.order.reference);assert.equal(fixtures.calls.length,1);
});
integration('inactive customer subscriptions cannot buy fuel',async()=>{
 await pool.query("UPDATE customer_subscriptions SET current_period_end=now()-interval '1 minute'");
 await assert.rejects(service.startFuelOrder(fixtures.user,fixtures.input,payments()),/active paid subscription/);
 assert.equal(fixtures.calls.length,0);
});
integration('a missing active station settlement account blocks checkout before taking payment',async()=>{
 await pool.query("UPDATE settlement_accounts SET status='suspended'");
 await assert.rejects(service.startFuelOrder(fixtures.user,fixtures.input,payments()),/settlement/);
 assert.equal(fixtures.calls.length,0);
});
integration('pending checkout reservations enforce card limits across concurrent purchases',async()=>{
 await pool.query('UPDATE cards SET daily_limit_kobo=12000');
 await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 await assert.rejects(service.startFuelOrder(fixtures.user,{...fixtures.input,idempotencyKey:randomUUID()},payments()),/limit/);
 assert.equal(fixtures.calls.length,1);
});
integration('exact confirmed payment creates one processor-split transaction and a recoverable fulfillment code',async()=>{
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 const confirmed=await service.confirmFuelOrder(order.reference,'101',false,payments());
 await service.confirmFuelOrder(order.reference,'101',false,payments());
 assert.equal(confirmed.status,'paid');assert.match(confirmed.authorization_code,/^\d{6}$/);
 const {rows}=await pool.query('SELECT amount_kobo,platform_fee_kobo,partner_net_kobo,settlement_method FROM transactions');
 assert.deepEqual(rows,[{amount_kobo:'9000',platform_fee_kobo:'1000',partner_net_kobo:'8000',settlement_method:'processor_split'}]);
 const {rows:[logs]}=await pool.query('SELECT count(*)::int AS n FROM fueling_logs');assert.equal(logs.n,0,'Fuel is not dispensed until station fulfillment');
});
integration('underpayment cannot create fuel authorization or a transaction',async()=>{
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 await assert.rejects(service.confirmFuelOrder(order.reference,'101',false,payments({amountKobo:8999})),/exact/);
 const {rows:[count]}=await pool.query('SELECT count(*)::int AS n FROM transactions');assert.equal(count.n,0);
});
integration('a paid order can only be fulfilled once at its own station and partner',async()=>{
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 const paid=await service.confirmFuelOrder(order.reference,'101',false,payments());
 await assert.rejects(service.fulfillFuelOrder({partnerOrgId:randomUUID(),stationId:fixtures.stationId,code:paid.authorization_code}),/not found/);
 const input={partnerOrgId:fixtures.orgId,stationId:fixtures.stationId,code:paid.authorization_code};
 const results=await Promise.allSettled([service.fulfillFuelOrder(input),service.fulfillFuelOrder(input)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const {rows:[logs]}=await pool.query('SELECT count(*)::int AS n FROM fueling_logs');assert.equal(logs.n,1);
});
integration('a station without a paid partner subscription cannot accept a direct customer charge',async()=>{
 await pool.query("UPDATE subscriptions SET status='cancelled'");
 await assert.rejects(service.startFuelOrder(fixtures.user,fixtures.input,payments()),/station subscription/);
 assert.equal(fixtures.calls.length,0);
});
integration('an unapproved discount never changes the charged station price',async()=>{
 await pool.query("UPDATE station_discount_requests SET review_state_id=(SELECT id FROM discount_review_states WHERE code='pending')");
 const result=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 assert.equal(Number(result.order.amount_kobo),10000);
 assert.deepEqual(fixtures.calls[0].split,{subaccountId:'RS_TEST',platformFeeKobo:0});
});
integration('negative and nonfinite litres are rejected before creating any provider charge',async()=>{
 for(const litres of [-1,0,Infinity,NaN,0.001])await assert.rejects(service.startFuelOrder(fixtures.user,{...fixtures.input,litres},payments()),/Litres/);
 assert.equal(fixtures.calls.length,0);
});
integration('a checkout request key cannot be reused for a different purchase',async()=>{
 await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 await assert.rejects(service.startFuelOrder(fixtures.user,{...fixtures.input,litres:11},payments()),/another fuel order/);
 assert.equal(fixtures.calls.length,1);
});
integration('a payment for another reference cannot authorize this order',async()=>{
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 await assert.rejects(service.confirmFuelOrder(order.reference,'101',false,payments({reference:'OTHER-REFERENCE'})),/exact/);
});
integration('a payment in another currency cannot authorize this order',async()=>{
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 await assert.rejects(service.confirmFuelOrder(order.reference,'101',false,payments({currency:'USD'})),/exact/);
});
integration('a missing or failed payment cannot authorize fuel',async()=>{
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 await assert.rejects(service.confirmFuelOrder(order.reference,'101',false,payments({paid:false})),/exact/);
});
integration('concurrent customer checkout requests cannot bypass a daily card limit',async()=>{
 await pool.query('UPDATE cards SET daily_limit_kobo=12000');
 const results=await Promise.allSettled([service.startFuelOrder(fixtures.user,fixtures.input,payments()),service.startFuelOrder(fixtures.user,{...fixtures.input,idempotencyKey:randomUUID()},payments())]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(fixtures.calls.length,1);
});
integration('a late confirmed payment remains recoverable after its pending reservation expires',async()=>{
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 await pool.query("UPDATE fuel_orders SET reservation_expires_at=now()-interval '1 day'");
 const paid=await service.confirmFuelOrder(order.reference,'101',false,payments());
 assert.equal(paid.status,'paid');assert.match(paid.authorization_code,/^\d{6}$/);
});
integration('a station cannot fulfill a paid fuel code belonging to another station',async()=>{
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 const paid=await service.confirmFuelOrder(order.reference,'101',false,payments());
 await assert.rejects(service.fulfillFuelOrder({partnerOrgId:fixtures.orgId,stationId:randomUUID(),code:paid.authorization_code}),/not found/);
});
integration('terminating the customer card cannot bypass its direct purchase limits by omitting cardId',async()=>{
 await pool.query("UPDATE cards SET status='terminated'");
 await assert.rejects(service.startFuelOrder(fixtures.user,fixtures.input,payments()),/Active customer card/);
 assert.equal(fixtures.calls.length,0);
});
integration('late confirmed money enters paid review when spending after reservation expiry exhausts the card limit',async()=>{
 await pool.query('UPDATE cards SET daily_limit_kobo=12000');
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 await pool.query("UPDATE fuel_orders SET reservation_expires_at=now()-interval '1 day'");
 await pool.query("INSERT INTO transactions(reference,card_id,amount_kobo,status,settlement_method)VALUES('WALLET-AFTER-EXPIRY',$1,8000,'success','wallet_transfer')",[fixtures.cardId]);
 const paid=await service.confirmFuelOrder(order.reference,'101',false,payments());
 assert.equal(paid.status,'paid_review');assert.equal(paid.authorization_code,null);assert.equal(paid.provider_transaction_id,'101');assert.ok(paid.paid_at);
 assert.match(paid.review_reason,/limit/);
 await assert.rejects(service.fulfillFuelOrder({partnerOrgId:fixtures.orgId,stationId:fixtures.stationId,code:'100000'}),/not found/);
});
integration('a verified default bank cannot authorize a settlement account linked to a different bank',async()=>{
 const {rows:[unverifiedBank]}=await pool.query('INSERT INTO bank_accounts(organization_id,is_default,verified)VALUES($1,false,false)RETURNING id',[fixtures.orgId]);
 await pool.query('UPDATE settlement_accounts SET bank_account_id=$1',[unverifiedBank.id]);
 await assert.rejects(service.startFuelOrder(fixtures.user,fixtures.input,payments()),/settlement account/);
 assert.equal(fixtures.calls.length,0);
});
integration('changing the default bank never rewrites an existing paid fuel order destination',async()=>{
 const {order}=await service.startFuelOrder(fixtures.user,fixtures.input,payments());
 await service.confirmFuelOrder(order.reference,'101',false,payments());
 await pool.query("UPDATE bank_accounts SET is_default=false WHERE id=$1",[fixtures.bankId]);
 await pool.query("UPDATE settlement_accounts SET status='suspended' WHERE id=$1",[fixtures.accountId]);
 const {rows:[newBank]}=await pool.query('INSERT INTO bank_accounts(organization_id)VALUES($1)RETURNING id',[fixtures.orgId]);
 const {rows:[newAccount]}=await pool.query("INSERT INTO settlement_accounts(organization_id,bank_account_id,subaccount_id)VALUES($1,$2,'RS_NEW')RETURNING id",[fixtures.orgId,newBank.id]);
 const next=await service.startFuelOrder(fixtures.user,{...fixtures.input,idempotencyKey:randomUUID()},payments());
 assert.equal(next.order.settlement_account_id,newAccount.id);assert.equal(fixtures.calls[1].split.subaccountId,'RS_NEW');
 const {rows:[original]}=await pool.query('SELECT settlement_account_id FROM fuel_orders WHERE reference=$1',[order.reference]);
 assert.equal(original.settlement_account_id,fixtures.accountId);
});

import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url=process.env.OBLIGON_TEST_DATABASE_URL;
if(url)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname),'Only isolated local PostgreSQL may be used');
const schema=`savings_${process.pid}_${randomUUID().replaceAll('-','')}`;
const integration=(name,fn)=>test(name,{skip:!url},fn);
let admin,pool,customerSavings,userId;
before(async()=>{
 if(!url)return;
 admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);
 const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema} -c timezone=UTC`);
 process.env.DATABASE_URL=isolated.toString();process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';
 pool=(await import('../src/db.js')).getPool();({customerSavings}=await import('../src/lib/savings.js'));
 await pool.query(`CREATE TABLE transactions(customer_user_id uuid,organization_id uuid,fuel_type text,litres numeric,unit_price_kobo bigint,base_amount_kobo bigint,amount_kobo bigint,status text DEFAULT 'success',created_at timestamptz DEFAULT now());
 CREATE TABLE fuel_prices(fuel_type text,price_kobo bigint);`);
});
beforeEach(async()=>{if(!url)return;userId=randomUUID();await pool.query('TRUNCATE transactions,fuel_prices');await pool.query("INSERT INTO fuel_prices VALUES('Petrol',100000),('Petrol',100000)");});
after(async()=>{if(!url)return;await pool?.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
async function purchase({litres=1,base=100000,paid=100000,unit=100000,fuel='Petrol',status='success',user=userId,created='2026-10-14T10:00:00Z'}={}){
 await pool.query('INSERT INTO transactions(customer_user_id,fuel_type,litres,unit_price_kobo,base_amount_kobo,amount_kobo,status,created_at)VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[user,fuel,litres,unit,base,paid,status,created]);
}
integration('unequal-volume purchases sum actual recorded discounts rather than averaging unit prices',async()=>{
 await purchase({litres:1,base:100000,paid:50000,unit:50000});
 await purchase({litres:99,base:9900000,paid:9900000,unit:100000});
 const result=await customerSavings({userId});assert.equal(result.savedKobo,50000);assert.equal(result.pricedCount,2);assert.equal(result.basis,'recorded_discount');
});
integration('recorded historical savings do not change when current network prices change',async()=>{
 await purchase({base:100000,paid:90000,unit:90000});
 const before=await customerSavings({userId});assert.equal(before.savedKobo,10000);
 await pool.query('UPDATE fuel_prices SET price_kobo=200000');
 assert.deepEqual(await customerSavings({userId}),before);
});
integration('discount evidence remains reportable without a rounded per-litre price or network benchmark',async()=>{
 await pool.query('TRUNCATE fuel_prices');await purchase({litres:'1.01',base:101003,paid:90903,unit:null});
 const result=await customerSavings({userId});assert.equal(result.savedKobo,10100);assert.equal(result.pricedCount,1);
});
integration('legacy missing price evidence is excluded without inventing an old base price',async()=>{
 await purchase({base:null,paid:50000,unit:50000});
 const result=await customerSavings({userId});assert.equal(result.savedKobo,0);assert.equal(result.pricedCount,0);
});
integration('paying more than the recorded base cannot cancel a genuine discount',async()=>{
 await purchase({base:100000,paid:90000,unit:90000});await purchase({base:100000,paid:120000,unit:120000});
 assert.equal((await customerSavings({userId})).savedKobo,10000);
});
integration('customer, successful status and date window bound the recorded savings',async()=>{
 await purchase({base:100000,paid:90000});
 await purchase({base:100000,paid:80000,created:'2026-09-30T10:00:00Z'});
 await purchase({base:100000,paid:10000,user:randomUUID()});
 await purchase({base:100000,paid:10000,status:'pending'});
 const result=await customerSavings({userId,since:new Date('2026-10-01T00:00:00Z')});assert.equal(result.savedKobo,10000);assert.equal(result.pricedCount,1);
 assert.equal((await customerSavings({userId})).savedKobo,30000);
});
integration('integer kobo totals remain exact for fractional litres and multiple fuel types',async()=>{
 await purchase({litres:'0.03',base:101,paid:90,unit:3367});
 await purchase({litres:'0.02',base:201,paid:181,unit:10050,fuel:'Diesel'});
 const result=await customerSavings({userId});assert.equal(result.savedKobo,31);assert.equal(result.byFuel.length,2);
});
integration('reporting rejects totals outside exact JavaScript integer bounds',async()=>{
 await purchase({base:'9007199254740993',paid:0,unit:1});
 await assert.rejects(customerSavings({userId}),/supported reporting range/);
});

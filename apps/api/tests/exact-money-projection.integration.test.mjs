import assert from 'node:assert/strict';
import { before,after,beforeEach,test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const url=process.env.OBLIGON_TEST_DATABASE_URL;
if(url)assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname),'Only isolated local PostgreSQL may be used');
const schema=`exact_projection_${process.pid}_${randomUUID().replaceAll('-','')}`;
const integration=(name,run)=>test(name,{skip:!url},run);
let admin,pool,setSpendProjection;
before(async()=>{
 if(!url)return;
 admin=new pg.Pool({connectionString:url});await admin.query(`CREATE SCHEMA ${schema}`);
 const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema} -c timezone=UTC`);
 process.env.DATABASE_URL=isolated.toString();process.env.DOTENV_CONFIG_PATH='/dev/null';process.env.NODE_ENV='test';
 pool=(await import('../src/db.js')).getPool();({setSpendProjection}=await import('../src/lib/spend.js'));
 await pool.query('CREATE TABLE monthly_spend_projections(user_id uuid,month date,projected_kobo bigint,updated_at timestamptz DEFAULT now(),UNIQUE(user_id,month))');
});
beforeEach(async()=>{if(url)await pool.query('TRUNCATE monthly_spend_projections');});
after(async()=>{if(!url)return;await pool?.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();});
integration('projection stores bounded exact decimal kobo and supports changing the same month',async()=>{
 const user=randomUUID();assert.equal((await setSpendProjection(user,'100.29')).projectedKobo,10029);
 assert.equal((await setSpendProjection(user,'0.01')).projectedKobo,1);
 const {rows:[count]}=await pool.query('SELECT count(*)::int AS n FROM monthly_spend_projections');assert.equal(count.n,1);
});
integration('projection refuses sub-kobo amounts without writing a rounded plan',async()=>{
 await assert.rejects(setSpendProjection(randomUUID(),'100.005'));
 const {rows:[count]}=await pool.query('SELECT count(*)::int AS n FROM monthly_spend_projections');assert.equal(count.n,0);
});
integration('projection refuses coercible arrays scientific notation and excessive amounts',async()=>{
 for(const value of [[100],'1e3',true,'1000000000.01'])await assert.rejects(setSpendProjection(randomUUID(),value));
 const {rows:[count]}=await pool.query('SELECT count(*)::int AS n FROM monthly_spend_projections');assert.equal(count.n,0);
});

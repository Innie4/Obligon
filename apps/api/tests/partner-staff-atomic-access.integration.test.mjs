import assert from 'node:assert/strict';
import {before,after,beforeEach,afterEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import express from 'express';
const database=process.env.OBLIGON_TEST_DATABASE_URL;
if(database)assert.ok(['localhost','127.0.0.1'].includes(new URL(database).hostname));
const check=(name,run)=>test(name,{skip:!database,timeout:10000},run);
const schema=`staff_atomic_${randomUUID().replaceAll('-','')}`,owner=randomUUID(),actor=randomUUID(),target=randomUUID(),org=randomUUID(),actorMembership=randomUUID(),targetMembership=randomUUID();
let setup,pool,server,base,tables;
const originalHash=bcrypt.hash;
before(async()=>{
 if(!database)return;
 setup=new pg.Pool({connectionString:database});await setup.query(`CREATE SCHEMA ${schema}`);
 tables=(await setup.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row=>row.tablename);
 for(const table of tables){assert.match(table,/^[a-z0-9_]+$/);await setup.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);}
 const isolated=new URL(database);isolated.searchParams.set('options',`-c search_path=${schema}`);isolated.searchParams.set('application_name',schema);
 Object.assign(process.env,{DATABASE_URL:isolated.toString(),DATABASE_SSL:'false',DOTENV_CONFIG_PATH:'/dev/null',NODE_ENV:'test',RESEND_API_KEY:'',TERMII_API_KEY:'',SUPABASE_AUTH_ENABLED:'false'});
 pool=(await import('../src/db.js')).getPool();
 let router;
 if(process.env.PARTNER_STAFF_BASELINE==='true'){
  const require=createRequire(import.meta.url);
  const source=execFileSync('git',['show','HEAD:apps/api/src/routes/partner.routes.js'],{cwd:new URL('../../..',import.meta.url),encoding:'utf8'})
   .replace(/(["'])(\.\.?\/[^"']+)\1/g,(_,quote,path)=>`${quote}${new URL(path,new URL('../src/routes/partner.routes.js',import.meta.url))}${quote}`)
   .replace(/from (["'])(express|multer)\1/g,(_,quote,name)=>`from ${JSON.stringify(pathToFileURL(require.resolve(name)).href)}`);
  router=(await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
 }else router=(await import('../src/routes/partner.routes.js')).default;
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:actor,role:'partner',orgId:org,orgType:'partner',organization_name:'Partner'};next();});app.use('/api/partner',router);app.use((error,req,res,next)=>res.status(error.status??500).json({message:error.message}));
 await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}/api/partner`;
});
beforeEach(async()=>{
 if(!database)return;
 await pool.query(`TRUNCATE ${tables.map(name=>`"${name}"`).join(',')}`);
 await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,notification_prefs) VALUES($1,'owner@example.invalid','unused','Owner','partner','{"email":false,"sms":false,"push":false}'),($2,'admin@example.invalid','unused','Admin','partner','{"email":false,"sms":false,"push":false}'),($3,'target@example.invalid','unused','Target','partner','{"email":false,"sms":false,"push":false}')`,[owner,actor,target]);
 await pool.query("INSERT INTO organizations(id,owner_user_id,name,type,partner_type,verification_status) VALUES($1,$2,'Partner','partner','fuel_station','verified')",[org,owner]);
 await pool.query(`INSERT INTO memberships(id,organization_id,user_id,email,role,status) VALUES($1,$2,$3,'admin@example.invalid','admin','active'),($4,$2,$5,'target@example.invalid','viewer','active')`,[actorMembership,org,actor,targetMembership,target]);
 await pool.query("INSERT INTO pricing_plans(code,name,price_kobo,interval,features,active) VALUES('staff-plan','Staff',10000,'month','[]',true)");
 await pool.query("INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end) VALUES($1,'staff-plan','active',now()-interval '1 day',now()+interval '1 month')",[org]);
});
afterEach(()=>{bcrypt.hash=originalHash;});
after(async()=>{bcrypt.hash=originalHash;if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();if(setup){await setup.query(`DROP SCHEMA ${schema} CASCADE`);await setup.end();}});
async function request(path,method='POST',body){const response=await fetch(base+path,{method,headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};}
const draft={fullName:'New staff',email:'new@example.invalid',role:'admin',cardAccess:true};

check('staff creation serializes demotion with its credential and membership writes',async()=>{
 let entered,release,demoted=false;const observed=new Promise(resolve=>{entered=resolve;});const gate=new Promise(resolve=>{release=resolve;});
 bcrypt.hash=async(...args)=>{entered();await gate;return originalHash(...args);};
 const creation=request('/staff','POST',draft);await observed;
 const demotion=pool.query("UPDATE memberships SET role='viewer' WHERE id=$1",[actorMembership]).then(()=>{demoted=true;});
 try{await new Promise(resolve=>setTimeout(resolve,40));assert.equal(demoted,false,'Demotion must not commit between credential creation and membership creation');}
 finally{release();await creation;await demotion;}
 assert.equal((await creation).status,200,JSON.stringify((await creation).data));assert.equal((await pool.query('SELECT role FROM memberships WHERE id=$1',[actorMembership])).rows[0].role,'viewer');
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM memberships WHERE email='new@example.invalid'")).rows[0].n,1);
 assert.equal((await request('/staff','POST',{...draft,email:'another@example.invalid'})).status,403);
});
check('staff deletion serializes actor revocation with the target deletion',async()=>{
 const blocker=await pool.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM memberships WHERE id=$1 FOR UPDATE',[targetMembership]);
 let revoked=false;
 const deletion=request(`/staff/${targetMembership}`,'DELETE');
 let revocation;
 try{
  let blocked=false;
  for(let attempt=0;attempt<100;attempt++){
   if((await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",[schema])).rows[0].n){blocked=true;break;}
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.ok(blocked,'Deletion should reach the held target row');
  revocation=pool.query("UPDATE memberships SET status='suspended' WHERE id=$1",[actorMembership]).then(()=>{revoked=true;});
  await new Promise(resolve=>setTimeout(resolve,40));assert.equal(revoked,false,'Revocation must serialize with the authorized deletion');
 }finally{await blocker.query('ROLLBACK');blocker.release();await deletion;if(revocation)await revocation;}
 assert.equal((await deletion).status,200);assert.equal((await pool.query('SELECT count(*)::int AS n FROM memberships WHERE id=$1',[targetMembership])).rows[0].n,0);
 assert.equal((await request('/staff','POST',draft)).status,403);
});
check('failed staff audit rolls back the new credentials and membership together',async()=>{
 await pool.query(`CREATE FUNCTION reject_staff_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='staff.created' THEN RAISE EXCEPTION 'Fixture audit failure'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER reject_staff_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_staff_audit()`);
 try{assert.equal((await request('/staff','POST',draft)).status,500);assert.equal((await pool.query("SELECT count(*)::int AS n FROM users WHERE email='new@example.invalid'")).rows[0].n,0);assert.equal((await pool.query("SELECT count(*)::int AS n FROM memberships WHERE email='new@example.invalid'")).rows[0].n,0);}
 finally{await pool.query('DROP TRIGGER reject_staff_audit ON audit_logs');}
});

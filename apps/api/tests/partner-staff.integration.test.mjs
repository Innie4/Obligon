import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import express from 'express';
const database = process.env.OBLIGON_TEST_DATABASE_URL;
if (database) { const url = new URL(database); assert.ok(['postgres:','postgresql:'].includes(url.protocol) && ['localhost','127.0.0.1','[::1]'].includes(url.hostname), 'Isolated loopback PostgreSQL required'); }
const check = (name, fn) => test(name, { skip: !database }, fn);
const schema = `staff_${process.pid}_${randomUUID().replaceAll('-','')}`, owner = randomUUID(), staff = randomUUID(), org = randomUUID(), foreign = randomUUID(), membership = randomUUID(), ownerMembership = randomUUID();
let admin, pool, server, base, ownsSchema = false;
before(async () => {
 if (!database) return;
 admin = new pg.Pool({ connectionString: database }); await admin.query(`CREATE SCHEMA ${schema}`); ownsSchema = true;
 for (const table of ['users','organizations','memberships','subscriptions','pricing_plans','audit_logs','notifications']) await admin.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
 const url = new URL(database); url.searchParams.set('options', `-c search_path=${schema}`);
 Object.assign(process.env, { DATABASE_URL: url.toString(), DATABASE_SSL:'false', DOTENV_CONFIG_PATH:'/dev/null', NODE_ENV:'test', ALLOW_PAYMENT_SIMULATION:'false' });
 pool = (await import('../src/db.js')).getPool();
 const app = express(); app.use(express.json()); app.use((req,res,next) => { req.user = { id: req.headers['x-fixture-user'] ?? owner, role:'partner', orgId:org, orgType:'partner', organization_name:'Staff fixture' }; next(); });
 app.use('/api/partner',(await import('../src/routes/partner.routes.js')).default); app.use((err,req,res,next) => res.status(err.status ?? 500).json({ message:err.message }));
 await new Promise(resolve => { server=app.listen(0,'127.0.0.1',resolve); }); base=`http://127.0.0.1:${server.address().port}/api/partner`;
});
beforeEach(async () => {
 if (!database) return;
 await pool.query('TRUNCATE users,organizations,memberships,subscriptions,pricing_plans,audit_logs,notifications');
 await pool.query(`INSERT INTO users(id,email,password_hash,full_name,role,notification_prefs) VALUES($1,'owner@example.invalid','unused','Owner','partner','{"email":false,"sms":false,"push":false}'),($2,'staff@example.invalid','unused','Staff','partner','{"email":false,"sms":false,"push":false}')`,[owner,staff]);
 await pool.query("INSERT INTO organizations(id,owner_user_id,name,type) VALUES($1,$2,'Staff fixture','partner'),($3,$2,'Foreign fixture','partner')",[org,owner,foreign]);
 await pool.query("INSERT INTO memberships(id,organization_id,user_id,email,role,status,permissions) VALUES($1,$2,$3,'staff@example.invalid','dispatcher','active','[\"pos.operate\"]'),($4,$2,$5,'owner@example.invalid','owner','active','[]')",[membership,org,staff,ownerMembership,owner]);
 await pool.query("INSERT INTO pricing_plans(code,name,price_kobo,interval,active) VALUES('staff-fixture','Staff fixture',10000,'month',TRUE)");
 await pool.query("INSERT INTO subscriptions(organization_id,plan_code,status,current_period_start,current_period_end) VALUES($1,'staff-fixture','active',now()-interval '1 day',now()+interval '1 month')",[org]);
});
after(async () => { if(server)await new Promise(resolve=>server.close(resolve)); if(pool)await pool.end(); if(admin){if(ownsSchema)await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();} });
async function request(path,method='GET',body,user=owner){const response=await fetch(base+path,{method,headers:{'content-type':'application/json','x-fixture-user':user},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};}
check('staff disable persists, revokes current access, remains visible and can be restored',async()=>{
 assert.equal((await request('/staff','GET',undefined,staff)).status,200);
 assert.equal((await request(`/staff/${membership}`,'PUT',{enabled:false})).status,200);
 assert.equal((await pool.query('SELECT status FROM memberships WHERE id=$1',[membership])).rows[0].status,'suspended');
 assert.equal((await request('/staff','GET',undefined,staff)).status,403);
 const row=(await request('/staff')).data.staff.find(row=>row.id===membership);assert.ok(row);assert.equal(row.status,'SUSPENDED');assert.equal(row.cardAccess,true);
 assert.equal((await request(`/staff/${membership}`,'PUT',{enabled:true})).status,200);assert.equal((await request('/staff','GET',undefined,staff)).status,200);
});
check('staff owner, foreign membership and invalid permission mutations are rejected without state changes',async()=>{
 assert.equal((await request('/staff')).data.staff.find(row=>row.id===ownerMembership).cardAccess,true,'owner retains existing implicit POS capability');
 assert.equal((await request(`/staff/${ownerMembership}`,'PUT',{enabled:false})).status,403);
 assert.equal((await request(`/staff/${ownerMembership}`,'PUT',{cardAccess:false})).status,403);
 for(const value of ['false',null,0,{}])assert.equal((await request(`/staff/${membership}`,'PUT',{enabled:value})).status,400);
 for(const value of ['true',null,1,[]])assert.equal((await request(`/staff/${membership}`,'PUT',{cardAccess:value})).status,400);
 assert.equal((await request(`/staff/${membership}`,'PUT',{role:'owner'})).status,400);
 await pool.query('UPDATE memberships SET organization_id=$1 WHERE id=$2',[foreign,membership]);assert.equal((await request(`/staff/${membership}`,'PUT',{enabled:false})).status,404);
 const row=(await pool.query('SELECT status,role,permissions FROM memberships WHERE id=$1',[ownerMembership])).rows[0];assert.equal(row.status,'active');assert.equal(row.role,'owner');assert.deepEqual(row.permissions,[]);
});
check('supported attendant role joins an existing partner without changing its account role',async()=>{
 await pool.query('DELETE FROM memberships WHERE id=$1',[membership]);
 const result=await request('/staff','POST',{fullName:'Staff',email:'staff@example.invalid',role:'dispatcher',cardAccess:true});assert.equal(result.status,200,JSON.stringify(result.data));
 const row=(await pool.query('SELECT role,permissions,status FROM memberships WHERE id=$1',[result.data.memberId])).rows[0];assert.equal(row.role,'dispatcher');assert.equal(row.status,'active');assert.deepEqual(row.permissions,['pos.operate']);
 assert.equal((await pool.query('SELECT role FROM users WHERE id=$1',[staff])).rows[0].role,'partner');
 assert.equal((await request('/staff','POST',{fullName:'Other',email:'other@example.invalid',role:'attendant'})).status,400);
});
check('staff invitation rejects incompatible existing accounts and malformed card access',async()=>{
 await pool.query('DELETE FROM memberships WHERE id=$1',[membership]);await pool.query("UPDATE users SET role='customer' WHERE id=$1",[staff]);
 assert.equal((await request('/staff','POST',{fullName:'Staff',email:'staff@example.invalid',role:'dispatcher'})).status,400);
 assert.equal((await request('/staff','POST',{fullName:'Staff',email:'staff@example.invalid',role:'dispatcher',cardAccess:'true'})).status,400);
 assert.equal((await pool.query('SELECT count(*)::int n FROM memberships WHERE user_id=$1',[staff])).rows[0].n,0);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const ts = require('typescript');
const access = require('../../../packages/shared/partner-access.mjs');
const adminAccess = require('../../../packages/shared/admin-access.mjs');
const plain = value => JSON.parse(JSON.stringify(value));

function loader(request) {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(require.resolve('../lib/dashboard-search.ts'), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,Error,URLSearchParams,require:name=>{
  if(name==='./services/client')return{api:{request}};
  if(name==='../../../packages/shared/partner-access.mjs')return access;
  if(name==='../../../packages/shared/admin-access.mjs')return adminAccess;
  throw new Error('Unexpected dependency '+name);
 }});
 return exports;
}
const user = (role, extra={}) => ({id:'viewer-a',name:'Test viewer',email:'viewer@example.invalid',initials:'TV',organization:'Fixture',accountTier:'Test',role,...extra});
const customer = user('customer');
const company = user('customer',{organizationId:'fleet-a',organizationType:'company',organizationRole:'viewer',organizationVerificationStatus:'verified'});
const partner = user('partner',{organizationId:'station-a',organizationType:'partner',partnerType:'gas_station',organizationRole:'viewer'});
const admin = user('admin',{staff_role:'super_admin',staff_permissions:adminAccess.ADMIN_PAGES.map(page=>page.key)});
const row = (id, text='Needle record') => ({id,name:text,reference:text,plate:text,subject:text,cells:[text,text],status:'ACTIVE'});
const empty = () => ({transactions:[],stations:[],vehicles:[],cards:[],companies:[],staff:[],disputes:[]});

test('customer records use existing personal endpoints without triggering payment reconciliation',async()=>{
 const calls=[];const api=loader(async path=>{calls.push(path);return path.includes('/stations?')?{stations:[{id:'station',name:'Needle station',address:'Test road'}]}:{transactions:[{id:'transaction',reference:'Needle-ref',station:'Test station'}]};});
 const results=await api.searchDashboardRecords('customer','Needle',customer);
 assert.equal(results.length,2);assert.equal(calls.length,2);assert.ok(calls.includes('/api/customer/transactions?limit=50&offset=0'));
 assert.ok(!calls.some(path=>path.includes('/transactions/all')));
 assert.equal(results.find(x=>x.kind==='Transaction').href,'/customer/transactions?search=Needle-ref');
 assert.equal(results.find(x=>x.kind==='Station').href,'/customer/stations?search=Needle+station');
});
test('company context preserves the personal account role and uses scoped paginated searches',async()=>{
 const calls=[];const api=loader(async path=>{calls.push(path);return {vehicles:[row('vehicle')],cards:[row('card')],transactions:[row('transaction')]};});
 assert.equal((await api.searchDashboardRecords('company','Needle',company)).length,3);
 assert.deepEqual(calls.map(path=>new URL(path,'https://api.example.invalid').pathname).sort(),['/api/company/cards','/api/company/transactions','/api/company/vehicles']);
 for(const path of calls){const params=new URL(path,'https://api.example.invalid').searchParams;assert.equal(params.get('search'),'Needle');assert.equal(params.get('limit'),'6');assert.equal(params.get('offset'),'0');assert.ok(!params.has('organizationId'));}
});
test('admin record kinds lead to their actual existing table pages',async()=>{
 const api=loader(async()=>({companies:[row('company')],staff:[{...row('staff'),name:'Needle Staff',email:'needle@example.invalid'}],disputes:[row('dispute')]}));
 const results=await api.searchDashboardRecords('admin','Needle',admin);
 assert.deepEqual(plain(results.map(x=>new URL(x.href,'https://app.example.invalid').pathname)),['/admin','/admin/staff','/admin/disputes']);
 assert.equal(results.find(x=>x.kind==='Company').href,'/admin?search=Needle+record');
 assert.equal(results.find(x=>x.kind==='Staff member').href,'/admin/staff?search=Needle+Staff');
 assert.ok(results.every(x=>!x.description.includes('@')&&!x.description.includes('₦')));
});
test('restricted admin search never requests or links unassigned record sources',async()=>{
 const calls=[];const api=loader(async path=>{calls.push(path);return {companies:[row('company')],staff:[row('staff')],disputes:[row('dispute')]};});
 const results=await api.searchDashboardRecords('admin','Needle',user('admin',{staff_role:'staff',staff_permissions:['disputes']}));
 assert.equal(calls.length,1);assert.ok(calls[0].startsWith('/api/admin/disputes?'));
 assert.equal(results.length,1);assert.ok(results[0].href.startsWith('/admin/disputes?'));
});
test('admin search does not assume missing page metadata grants full access',async()=>{
 const calls=[];const api=loader(async path=>{calls.push(path);return empty();});
 assert.deepEqual(plain(await api.searchDashboardRecords('admin','Needle',user('admin'))),[]);assert.equal(calls.length,0);
});
test('fuel partner searches only its existing transaction, staff and dispute APIs',async()=>{
 const calls=[];const api=loader(async path=>{calls.push(path);return {...empty(),transactions:[row('transaction')],staff:[{id:'staff',cells:['ST-ID','NS\nNeedle Staff\n08000000000']}],disputes:[row('dispute')]};});
 const results=await api.searchDashboardRecords('partner','Needle',partner);
 assert.equal(results.length,3);assert.equal(calls.length,3);assert.ok(calls.includes('/api/partner/staff'));assert.ok(calls.includes('/api/partner/disputes'));
 assert.ok(results.some(x=>x.href==='/dashboard/staff?search=ST-ID'));
});
test('legacy partner staff contacts never become destination URL tokens',async()=>{
 const api=loader(async()=>({...empty(),staff:[{id:'staff',cells:['ST-legacy','NS\nneedle@example.invalid\n08000000000']}]}));
 const results=await api.searchDashboardRecords('partner','needle',partner);
 assert.equal(results.length,1);assert.equal(results[0].href,'/dashboard/staff?search=ST-legacy');
 assert.ok(!results[0].href.includes('example.invalid'));
});
for(const identity of [{role:'partner',partnerType:'mechanic'},{role:'mechanic',partnerType:'fuel_station'},{role:'partner',partnerType:'other'}])test(`workshop/nonfuel identity ${identity.role}/${identity.partnerType} never requests fuel records`,async()=>{
 const calls=[];const api=loader(async path=>{calls.push(path);return {staff:[]};});
 await api.searchDashboardRecords('partner','Needle',{...partner,...identity});assert.deepEqual(calls,['/api/partner/staff']);
});
test('role, context and pending-company gates reject before any record request',async()=>{
 const calls=[];const api=loader(async path=>{calls.push(path);return empty();});
 for(const [scope,identity] of [['admin',customer],['customer',admin],['partner',company],['company',partner],['unknown',partner],['customer',null],['company',{...company,organizationVerificationStatus:'pending'}],['company',{...company,organizationRole:null}]]){
  await assert.rejects(api.searchDashboardRecords(scope,'Needle',identity),api.DashboardSearchUnavailableError);
 }
 assert.equal(calls.length,0);
});
test('short queries make no requests and oversized queries report an explicit error',async()=>{
 const calls=[];const api=loader(async path=>{calls.push(path);return empty();});
 assert.deepEqual(plain(await api.searchDashboardRecords('customer',' a ',customer)),[]);
 await assert.rejects(api.searchDashboardRecords('customer','x'.repeat(81),customer),/80 characters/);assert.equal(calls.length,0);
});
test('query and destination tokens are encoded as values and cannot inject routes or parameters',async()=>{
 const value='AB&/ 12#';const calls=[];const api=loader(async path=>{calls.push(path);return {...empty(),vehicles:[{id:'vehicle',plate:value,model:'Fixture'}]};});
 const results=await api.searchDashboardRecords('company',value,company);assert.equal(results.length,1);
 for(const path of calls){const url=new URL(path,'https://api.example.invalid');assert.equal(url.searchParams.get('search'),value);assert.equal(url.searchParams.size,3);}
 const destination=new URL(results[0].href,'https://app.example.invalid');assert.equal(destination.pathname,'/company/vehicles');assert.equal(destination.searchParams.get('search'),value);assert.equal(destination.hash,'');
});
test('one failed source retains matching authorized records and reports unavailable categories',async()=>{
 const api=loader(async path=>{if(path.includes('/cards?'))throw new Error('Provider secret must never become search copy');return {...empty(),vehicles:[row('vehicle')]};});
 await assert.rejects(api.searchDashboardRecords('company','Needle',company),error=>{
  assert.ok(error instanceof api.DashboardSearchUnavailableError);assert.equal(error.results.length,1);assert.deepEqual(plain(error.unavailable),['Cards']);assert.ok(!error.message.includes('secret'));return true;
 });
});
test('total transport failure is unavailable, rather than a successful empty search',async()=>{
 const api=loader(async()=>{throw new Error('Offline');});
 await assert.rejects(api.searchDashboardRecords('customer','Needle',customer),error=>error instanceof api.DashboardSearchUnavailableError&&error.results.length===0&&error.unavailable.length===2);
});
test('missing IDs and malformed response lists never create invented record links',async()=>{
 const api=loader(async path=>path.includes('/stations?')?{stations:null}:{transactions:[{reference:'Needle missing'},row('real')]});
 await assert.rejects(api.searchDashboardRecords('customer','Needle',customer),error=>{
  assert.equal(error.results.length,1);assert.equal(error.results[0].id,'Transaction:real');assert.deepEqual(plain(error.unavailable),['Recent transactions','Stations']);return true;
 });
});
test('each search is capped at three calls and twelve matching records',async()=>{
 let calls=0;const rows=Array.from({length:150},(_,i)=>row(String(i)));
 const api=loader(async()=>{calls++;return {companies:rows,staff:rows,disputes:rows};});
 const results=await api.searchDashboardRecords('admin','Needle',admin);assert.equal(calls,3);assert.equal(results.length,12);assert.equal(new Set(results.map(x=>x.id)).size,12);
});
test('joined vehicle/card rows cannot create duplicate record keys',async()=>{
 const api=loader(async()=>({...empty(),vehicles:[row('same'),row('same'),row('different')]}));
 const results=await api.searchDashboardRecords('company','Needle',company);assert.equal(results.length,2);assert.equal(new Set(results.map(x=>x.id)).size,2);
});
test('selected search queries are delivered over HTTP as encoded GET requests',async()=>{
 const calls=[];const server=http.createServer((req,res)=>{calls.push({method:req.method,url:req.url});res.setHeader('content-type','application/json');res.end(JSON.stringify({...empty(),vehicles:[{id:'vehicle',plate:'AB & 12',model:'Test'}]}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const api=loader(async path=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`);return response.json();});
  assert.equal((await api.searchDashboardRecords('company','AB & 12',company)).length,1);
  assert.equal(calls.length,3);assert.ok(calls.every(x=>x.method==='GET'&&new URL(x.url,'https://api.example.invalid').searchParams.get('search')==='AB & 12'));
 }finally{await new Promise(resolve=>server.close(resolve));}
});

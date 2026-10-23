const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const access = require('../../../packages/shared/partner-access.mjs');
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : !tree || typeof tree !== 'object' ? [] : [tree, ...nodes(tree.props?.children)];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree);

function compile(path, dependencies, expose = '') {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + expose, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code, {exports, Error, require:name => dependencies[name] ?? {}});
  return exports;
}
const workshop = compile('../lib/partner-workshop.ts', {});
const units = compile('../lib/partner-selling-unit.ts', {'../../../packages/shared/partner-access.mjs':access});
const profile = {name:'Workshop test',address:'Test road',city:'Uyo',website:'',description:'Diagnostics and repair',services:['Computer Diagnostics']};

function fixture({role='owner', reject, pending, status='success'}={}) {
  const slots=[], calls=[]; let cursor=0, tree, editor;
  const React={
    createElement:(type,props,...children)=>({type,props:{...props,children}}),
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return [slots[index],value=>slots[index]=typeof value==='function'?value(slots[index]):value];},
    useRef(initial){const index=cursor++;return slots[index]??=( {current:initial} );},
  };
  const {WorkshopDashboard}=compile('../components/dashboard/WorkshopDashboard.tsx', {
    react:React,'next/link':{default:'Link',__esModule:true},
    '@/components/shared/AuthContext':{useSession:()=>({user:{role:'partner',partnerType:'mechanic',organizationId:'workshop-a',organizationRole:role}})},
    '@/components/shared/States':{AsyncBoundary:'AsyncBoundary'},
    '@/components/shared/useAsync':{useAsync:()=>({status,data:status==='success'?{profile,stats:{staff:3,supportTickets:2}}:null,error:status==='error'?new Error('Workshop unavailable'):null,reload:()=>calls.push(['reload'])})},
    '@/lib/partner-workshop':workshop,
    '@/lib/services':{authenticatedRequest:async(path,options)=>{calls.push({path,method:options.method,payload:JSON.parse(options.body)});if(pending)await pending;if(reject)throw new Error(reject);return {ok:true};}},
  });
  function overview(){cursor=0;tree=WorkshopDashboard({});return tree;}
  function edit(){if(!editor){cursor=0;const page=WorkshopDashboard({edit:true});editor=nodes(page).find(node=>typeof node.type==='function'&&node.type.name==='WorkshopEditor');}cursor=0;tree=editor.type(editor.props);return tree;}
  return {overview,edit,calls,nodes:()=>nodes(tree),text:()=>text(tree),change(name,value){nodes(tree).find(node=>node.props?.name===name).props.onChange({target:{value}});edit();},submit(){return nodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});}};
}

test('workshop overview displays real workshop/team/support data without fuel or money metrics',()=>{
  const ui=fixture();ui.overview();assert.match(ui.text(),/Workshop overview/);assert.match(ui.text(),/Workshop test/);assert.match(ui.text(),/Team members 3/);assert.match(ui.text(),/Support requests 2/);
  const links=ui.nodes().filter(node=>node.type==='Link').map(node=>node.props.href);
  assert.deepEqual(links,['/dashboard/workshop','/dashboard/staff','/dashboard/settings#partner-support']);
  assert.doesNotMatch(ui.text(),/litres|sales revenue|settlement totals/i);
});

test('viewer can read workshop fields but has no enabled editor or save control',()=>{
  const ui=fixture({role:'viewer'});ui.edit();assert.equal(ui.nodes().find(node=>node.type==='fieldset').props.disabled,true);assert.equal(ui.nodes().some(node=>node.type==='button'&&node.props.type==='submit'),false);
});

test('workshop save uses only its profile endpoint and preserves services',async()=>{
  const ui=fixture();ui.edit();ui.change('name','Updated workshop');await ui.submit();ui.edit();
  assert.equal(ui.calls[0].path,'/api/partner/workshop');assert.equal(ui.calls[0].method,'PUT');assert.equal(ui.calls[0].payload.name,'Updated workshop');assert.deepEqual(ui.calls[0].payload.services,['Computer Diagnostics']);assert.match(ui.text(),/Workshop profile saved/);
});

test('failed workshop save retains edits and shows the real error',async()=>{
  const ui=fixture({reject:'Profile save failed'});ui.edit();ui.change('name','Keep my edit');await ui.submit();ui.edit();assert.match(ui.text(),/Profile save failed/);assert.equal(ui.nodes().find(node=>node.props?.name==='name').props.value,'Keep my edit');assert.doesNotMatch(ui.text(),/Workshop profile saved/);
});

test('overlapping workshop submissions send one request while the first is pending',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);const ui=fixture({pending});ui.edit();const first=ui.submit();const second=ui.submit();assert.equal(ui.calls.length,1);finish();await Promise.all([first,second]);
});

test('gas prices require an explicit valid approved unit and liquid legacy prices remain litres',()=>{
  assert.equal(units.priceSellingUnit('CNG'),undefined);assert.equal(units.priceSellingUnit('LPG Autogas'),undefined);assert.equal(units.priceSellingUnit('CNG','litre'),undefined);assert.equal(units.priceSellingUnit('CNG','kg'),'kg');assert.equal(units.priceSellingUnit('CNG','scm'),'scm');assert.equal(units.priceSellingUnit('LPG','litre'),'litre');assert.equal(units.priceSellingUnit('PMS Petrol'),'litre');
});

function pricingFixture({approvedSellingUnits={CNG:'kg'},sellingUnit='kg'}={}) {
 const slots=[],calls=[];let cursor=0,tree;
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(initial){const i=cursor++;slots[i]??={value:initial};return [slots[i].value,value=>slots[i].value=typeof value==='function'?value(slots[i].value):value];}};
 const data={stations:[{id:'gas-station',name:'Gas only',approvedSellingUnits}],prices:[{stationId:'gas-station',fuelType:'CNG',price:200,sellingUnit},{stationId:'gas-station',fuelType:'PMS',price:900,sellingUnit:'litre'}],history:[]};
 const {FuelPricingPage}=compile('../components/dashboard/DashboardScreen.tsx',{
 react:React,'next/dynamic':{default:()=> 'StationProfileForm',__esModule:true},'../../../../packages/shared/partner-access.mjs':access,'@/lib/partner-selling-unit':units,
 '@/components/shared/AuthContext':{useSession:()=>({user:{role:'partner',partnerType:'gas_station'}})},
 '@/components/shared/Toast':{useToast:()=>({success(){},error:value=>calls.push(['error',value])})},
 '@/components/shared/useAsync':{useAsync:()=>({status:'success',data,reload(){}})},
 '@/lib/services':{api:{getPartnerPricing(){}},mutationsApi:{updatePrices:async(updates,stationId)=>calls.push({updates,stationId})}},
 },'\nexport {FuelPricingPage};');
 function render(){cursor=0;tree=FuelPricingPage();return tree;}render();return {calls,render,nodes:()=>nodes(tree),text:()=>text(tree),submit:()=>nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}})};
}

test('gas pricing only offers approved gas products and sends their approved unit',async()=>{
 const ui=pricingFixture();const fuels=ui.nodes().find(n=>n.type==='select'&&n.props['aria-label']==='Fuel type');assert.deepEqual(nodes(fuels).filter(n=>n.type==='option').map(n=>n.props.value),['','CNG']);assert.ok(ui.nodes().some(n=>n.props?.['aria-label']==='CNG price per kg'));await ui.submit();assert.equal(ui.calls[0].updates[0].sellingUnit,'kg');assert.equal(ui.calls[0].updates[0].fuelType,'CNG');
});

test('approving a new gas unit clears the old rate instead of converting or relabelling it',()=>{
 const ui=pricingFixture({approvedSellingUnits:{CNG:'scm'},sellingUnit:'kg'});const price=ui.nodes().find(n=>n.props?.['aria-label']==='CNG price per standard m³');assert.equal(price.props.value,'');
});

test('pending gas unit approval explains why price publication is unavailable',()=>{
 const ui=pricingFixture({approvedSellingUnits:{}});assert.match(ui.text(),/No selling units have been approved/);assert.equal(ui.nodes().find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,true);
});

test('admin station review submits its explicitly selected legal gas unit for approval',async()=>{
 const slots=[],calls=[];let cursor=0,tree,pending=[];
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),
 useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>slots[i].value=typeof value==='function'?value(slots[i].value):value];},
 useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
 useCallback(callback,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>!Object.is(v,slots[i].deps[j])))slots[i]={callback,deps};return slots[i].callback;},
 useEffect(callback,deps){const i=cursor++;if(!slots[i]||deps.some((v,j)=>!Object.is(v,slots[i].deps[j])))pending.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:callback()};});},
 };
 const row={id:'gas-review',name:'Gas station',status:'pending',fuels:['CNG'],sellingUnits:{CNG:'kg'},approvedSellingUnits:{CNG:'kg'}};
 const {IntakeConsole}=compile('../components/admin-dashboard/IntakeConsole.tsx',{react:React,'../../../../packages/shared/partner-access.mjs':access,'@/lib/services':{authenticatedRequest:async(path,options)=>{calls.push({path,options});return options?{ok:true}:{stations:[row],total:1};}}});
 function render(){cursor=0;tree=IntakeConsole();const jobs=pending;pending=[];jobs.forEach(fn=>fn());}const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
 render();await flush();render();nodes(tree).find(n=>n.type==='button'&&text(n).trim()==='Review record').props.onClick();render();
 const unit=nodes(tree).find(n=>n.props?.['aria-label']==='CNG approved selling unit');assert.equal(unit.props.value,'kg');unit.props.onChange({target:{value:'scm'}});render();
 const decision=nodes(tree).find(n=>n.type==='select'&&!n.props['aria-label']);decision.props.onChange({target:{value:'active'}});render();
 nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'Approved station standard cubic metre unit'}});render();nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();
 const write=calls.find(call=>call.options?.method==='POST');assert.equal(write.path,'/api/admin/stations/gas-review/review');assert.deepEqual(JSON.parse(write.options.body).sellingUnits,{CNG:'scm'});assert.equal(JSON.parse(write.options.body).status,'active');
});

function recoveryFixture({reject,pending,screen='RecoveryReview'}={}){
 const slots=[],calls=[];let cursor=0,tree;
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(initial){const i=cursor++;slots[i]??={value:initial};return [slots[i].value,value=>slots[i].value=typeof value==='function'?value(slots[i].value):value];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};}};
 const operation={id:'operation-id',organization_id:'company-id',label:'Existing company card',state:'provider_created',issuer_customer_id:'issuer-customer',card_id:null,updated_at:'2026-10-23'};
 const api={authenticatedRequest:async(path,options)=>{calls.push({path,options});if(options){if(pending)await pending;if(reject)throw new Error(reject);}return {ok:true};}};
 let read=0;
 const exports=compile('../components/admin-dashboard/RecoveryReview.tsx',{react:React,'@/lib/services':api,'@/components/shared/States':{AsyncBoundary:'AsyncBoundary'},'@/components/shared/useAsync':{useAsync:()=>({status:'success',data:++read%2?{operations:[operation]}:{refunds:[{id:'refund-id',customer:'Test customer',reference:'REF',status:'pending',reviewRequired:true,reviewReason:'Provider review required',amountLabel:'₦200',reason:'Recorded refund'}]},reload:()=>calls.push({refresh:true})})}},'\nexport {IssuanceRecovery};');
 const props={operation,onChanged:()=>calls.push({refresh:true})};function render(){cursor=0;read=0;tree=exports[screen](screen==='RecoveryReview'?{}:props);return tree;}render();return {render,calls,nodes:()=>nodes(tree),text:()=>text(tree),submit:()=>nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}})};
}

test('issuer recovery requires the exact existing provider ID even for a locally recorded provider card',async()=>{
 const ui=recoveryFixture({screen:'IssuanceRecovery'});assert.equal(ui.nodes().find(n=>n.type==='button').props.disabled,true);await ui.submit();assert.equal(ui.calls.length,0);ui.nodes().find(n=>n.type==='input').props.onChange({target:{value:'existing-provider-card'}});ui.render();await ui.submit();assert.equal(ui.calls[0].path,'/api/admin/company-card-issuances/operation-id/reconcile');assert.deepEqual(JSON.parse(ui.calls[0].options.body),{providerCardId:'existing-provider-card'});ui.render();assert.match(ui.text(),/local issuance reconciled/);
});

test('issuer lookup refusal stays visible and does not announce reconciliation success',async()=>{
 const ui=recoveryFixture({screen:'IssuanceRecovery',reject:'Card belongs to another issuer customer'});ui.nodes().find(n=>n.type==='input').props.onChange({target:{value:'foreign-card'}});ui.render();await ui.submit();ui.render();assert.match(ui.text(),/another issuer customer/);assert.doesNotMatch(ui.text(),/local issuance reconciled/);
});

test('admin bounded payment recovery calls only reconciliation and refreshes existing queues',async()=>{
 const ui=recoveryFixture();const action=ui.nodes().find(n=>n.type==='button'&&text(n).includes('Reconcile payments and refunds'));await action.props.onClick();for(let i=0;i<10;i++)await Promise.resolve();ui.render();const write=ui.calls.find(c=>c.options);assert.equal(write.path,'/api/admin/reconcile');assert.deepEqual(JSON.parse(write.options.body),{limit:100});assert.equal(ui.calls.filter(c=>c.refresh).length,2);assert.match(ui.text(),/Provider review required/);assert.doesNotMatch(ui.text(),/mark as paid|create new card/i);
});

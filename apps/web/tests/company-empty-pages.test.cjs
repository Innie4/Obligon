const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const React = require('react');
const { execFileSync } = require('node:child_process');
const baseline = process.env.COMPANY_AUDIT_BASELINE === 'true';
const {renderToStaticMarkup} = require('react-dom/server');
const cache = new Map();
let choicesOverride = null;
const webRoot = path.resolve(__dirname,'..');
const emptyResult = {status:'success',data:{vehicles:[],cards:[],metrics:[],team:[],tickets:[],requests:[],active:[],schedules:[],fleetHealth:{total:0,healthyPct:100,inService:0},detailed:[],unreadCount:0,invoices:[],paymentMethods:[],plan:null},error:null,reload(){}};
function load(file) {
  if(cache.has(file))return cache.get(file);
  const exports={};cache.set(file,exports);
  const customRequire=name=>{
    if(name.endsWith("/partner-access.mjs")) return require("../../../packages/shared/partner-access.mjs");
    if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
    if(name==='@/components/shared/useAsync')return {useAsync:()=>baseline?{...emptyResult,data:[]}:emptyResult};
    if(name==='@/components/shared/useDialogFocus')return {useDialogFocus(){}};
    if(name==='@/components/shared/AuthContext')return {useSession:()=>({user:{name:'Fixture Member',email:'fixture@example.invalid'},refresh:async()=>{}})};
    if(name==='@/components/shared/Toast')return {useToast:()=>({success(){},error(){}})};
    if(name==='@/lib/services')return {api:{},mutationsApi:{},saveBlob(){}};
    if(name==='@/lib/services/company')return {companyApi:new Proxy({}, {get:()=>async()=>({})})};
    if(name.startsWith('@/'))return load(path.join(webRoot,name.slice(2))+(fs.existsSync(path.join(webRoot,name.slice(2))+'.tsx')?'.tsx':'.ts'));
    if(name.startsWith('./'))return load(path.join(path.dirname(file),name)+'.tsx');
    if(name==='react')return {...React,useState:initial=>React.useState(choicesOverride && initial && typeof initial==='object' && 'cards' in initial ? choicesOverride : initial)};
    return require(name);
  };
  const source = baseline && /Company(Screen|Modals)\.tsx$/.test(file) ? execFileSync('git',['show',`HEAD:${path.relative(path.resolve(webRoot,'../..'),file)}`],{cwd:webRoot,encoding:'utf8'}) : fs.readFileSync(file,'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:customRequire,URLSearchParams,console});
  return exports;
}
const {CompanyScreen}=load(path.join(webRoot,'components/company-dashboard/CompanyScreen.tsx'));
for(const [page,label] of [['vehicles','Add Vehicle'],['cards','Issue New Card'],['team','Invite Team Member'],['roadside','Request Emergency Help'],['maintenance','Schedule Service'],['support','Raise Support Ticket']]) {
  test(`empty ${page} page retains its first creation action`,()=>{
    const html=renderToStaticMarkup(React.createElement(CompanyScreen,{pageKey:page}));
    assert.match(html,new RegExp(`<button[^>]*>[\\s\\S]*?${label}[\\s\\S]*?</button>`));
  });
}
const {CompanyModals}=load(path.join(webRoot,'components/company-dashboard/CompanyModals.tsx'));
test('support ticket modal presents subject and message fields',()=>{
  const html=renderToStaticMarkup(React.createElement(CompanyModals,{modal:'supportTicket',onClose(){},onSaved(){}}));
  assert.match(html,/<form/);assert.match(html,/Subject/);assert.match(html,/Message/);assert.match(html,/<textarea/);
});
test('first card modal presents complete issuer identity setup and two separate limits',()=>{
  choicesOverride={cards:[],vehicles:[],drivers:[],issuerCustomerConfigured:false,issuerReady:true};
  try {const html=renderToStaticMarkup(React.createElement(CompanyModals,{modal:'newCard',onClose(){},onSaved(){}}));
    for(const label of ['Daily spend limit','Monthly spend limit','Card holder first name','Card holder last name','Date of birth','BVN','Residential address','Postal code'])assert.match(html,new RegExp(label, 'i'));
  } finally {choicesOverride=null;}
});
test('station locator renders a previous API response without per-fuel prices',()=>{
  const original=emptyResult.data;
  emptyResult.data={details:[{id:'legacy-station',name:'Legacy station',address:'Fixture road',city:'Lagos',lat:6,lng:3,hours:'24 hours',fuels:['Diesel'],rating:4.5}]};
  try {const html=renderToStaticMarkup(React.createElement(CompanyScreen,{pageKey:'stations'}));assert.match(html,/Legacy station/);assert.match(html,/Get directions/);assert.match(html,/prices.*unavailable/i);}
  finally {emptyResult.data=original;}
});

test('legacy card assignment form cannot save missing asset IDs',()=>{
  choicesOverride={cards:[{id:'legacy-card',label:'Legacy',masked_pan:'•••• 1111',status:'active'}],vehicles:[],drivers:[],issuerCustomerConfigured:false};
  try {const html=renderToStaticMarkup(React.createElement(CompanyModals,{modal:'assign',context:{cardId:'legacy-card'},onClose(){},onSaved(){}}));assert.match(html,/assignment details are unavailable/);assert.match(html,/<button[^>]*type="submit"[^>]*disabled=""/);}
  finally {choicesOverride=null;}
});
test('current explicitly unassigned card can save a deliberate assignment',()=>{
  choicesOverride={cards:[{id:'current-card',label:'Current',masked_pan:'•••• 1111',status:'active',vehicle_id:null,driver_id:null}],vehicles:[],drivers:[],issuerCustomerConfigured:true};
  try {const html=renderToStaticMarkup(React.createElement(CompanyModals,{modal:'assign',context:{cardId:'current-card'},onClose(){},onSaved(){}}));assert.doesNotMatch(html,/<button[^>]*type="submit"[^>]*disabled=""/);}
  finally {choicesOverride=null;}
});

test('previous API capabilities cannot enable a silently ignored stable driver filter',()=>{
  const original=emptyResult.data;
  emptyResult.data={vehicles:[],drivers:[{id:'00000000-0000-4000-8000-000000000001',name:'Sam Example'}],transactions:[],total:0};
  try {const html=renderToStaticMarkup(React.createElement(CompanyScreen,{pageKey:'transactions'}));assert.match(html,/Driver filtering is currently unavailable/);assert.match(html,/Driver[\s\S]*?<select[^>]*disabled=""/);}
  finally {emptyResult.data=original;}
});

test('company station locator labels gas prices using their recorded selling units',()=>{
 const original=emptyResult.data;
 try{for(const sellingUnit of ['kg','scm']){emptyResult.data={details:[{id:'gas-station',name:'Gas station',address:'Test road',city:'Uyo',lat:5,lng:7,hours:'24 hours',fuels:['CNG'],prices:[{fuel:'CNG',priceLabel:'₦200',sellingUnit}]}]};const html=renderToStaticMarkup(React.createElement(CompanyScreen,{pageKey:'stations'}));assert.match(html,new RegExp(sellingUnit==='kg'?'kg':'standard m³'));assert.doesNotMatch(html,/₦200 \/L/);}}
 finally{emptyResult.data=original;}
});

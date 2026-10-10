const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const exportsFor=(path,globals={})=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(path),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,...globals});return exports;};
const {customerFeatureAvailable,customerAccountLabel}=exportsFor('../lib/customer-entitlements.ts');
test('expired or absent paid period disables budget control despite included catalogue feature',()=>{
 assert.equal(customerFeatureAvailable(null,'Fuel Budget Management'),false);
 assert.equal(customerFeatureAvailable({active:false,features:[{label:'Fuel Budget Management',state:'included'}]},'Fuel Budget Management'),false);
});
test('active catalogue inclusion enables budget management',()=>{
 assert.equal(customerFeatureAvailable({active:true,features:[{label:'Fuel Budget Management',state:'included'}]},'Fuel Budget Management'),true);
});
test('unavailable or missing catalogue feature stays disabled during active period',()=>{
 assert.equal(customerFeatureAvailable({active:true,features:[{label:'Fuel Budget Management',state:'unavailable'}]},'Fuel Budget Management'),false);
 assert.equal(customerFeatureAvailable({active:true,features:[]},'Fuel Budget Management'),false);
});
test('legacy explicit exclusion cannot accidentally enable a paid control',()=>{
 for(const feature of [{included:false},{value:false},{value:'—'},{value:'Not included'}])assert.equal(customerFeatureAvailable({active:true,features:[{label:'Fuel Budget Management',...feature}]},'Fuel Budget Management'),false);
});
test('offline Bronze and Gold catalogues preserve premium feature exclusions',async()=>{
 const client=exportsFor('../lib/services/client.ts',{process:{env:{NEXT_PUBLIC_ENABLE_MOCK_MODE:'true'}},require:()=>({})});
 const plans=await client.createApiClient('mock').getCardPlans();
 const bronze=plans.find(p=>p.code==='bronze'),gold=plans.find(p=>p.code==='gold');
 for(const label of ['Fuel Consumption Analytics','Loyalty Rewards','Partner Mechanics','Priority Support','Access to Car Wash','VIP Lounge','Intelligence Notifications','Towing Services'])assert.equal(bronze.features.find(f=>f.label===label).state,'unavailable',label);
 for(const label of ['Partner Mechanics','VIP Lounge','Towing Services'])assert.equal(gold.features.find(f=>f.label===label).state,'unavailable',label);
 assert.equal(bronze.features.find(f=>f.label==='Virtual Fuel Card').state,'included');
});

test('customer account label uses current subscription instead of stale session tier',()=>{
 assert.equal(customerAccountLabel(null),'Free account');
 assert.equal(customerAccountLabel({active:false,subscription:{name:'Premium',plan_code:'premium'}}),'Free account');
 assert.equal(customerAccountLabel({active:true,subscription:{name:'Gold',plan_code:'gold'}}),'Gold plan');
 assert.equal(customerAccountLabel({active:true,subscription:{plan_code:'bronze'}}),'bronze plan');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const token = 'ab'.repeat(24), destination = `/auth/company-invitation?invite=${token}`;
const invitation = {organizationId:'fleet-fixture',companyName:'Test Fleet',role:'manager',status:'pending',expiresAt:'2030-01-01'};
const signedUser = {id:'synthetic-user',email:'invitee@example.invalid',role:'customer',emailVerified:true,organizationType:null,organizationId:null};
const transpile = (path, extra='') => ts.transpileModule(fs.readFileSync(require.resolve(path),'utf8')+extra,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
function nodes(tree) { if(Array.isArray(tree))return tree.flatMap(nodes);if(!tree||typeof tree!=='object')return [];return [tree,...nodes(tree.props?.children)]; }
function textOf(tree) { if(Array.isArray(tree))return tree.map(textOf).join('');if(tree==null||typeof tree==='boolean')return '';return typeof tree==='object'?textOf(tree.props?.children):String(tree); }
const flush = () => new Promise(resolve=>setImmediate(resolve));
function fixture(path,componentName,{user=signedUser,status='authenticated',search='',mfa=false,invite=invitation,readError,selectError,verifyResult={emailVerified:true,phoneVerified:false,allVerified:false,remaining:['phone']}}={}) {
  const states=[],effectStates=[],pending=[],events=[],storage=new Map(),timers=[];
  let stateIndex=0,effectIndex=0,tree,currentUser=user;
  const router={push:value=>events.push(['push',value]),replace:value=>events.push(['replace',value])};
  const React={
    createElement:(type,props,...children)=>({type,props:{...props,children}}),
    useState:initial=>{const i=stateIndex++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useEffect:(effect,deps=[])=>{const i=effectIndex++,old=effectStates[i];if(!old||deps.some((d,k)=>!Object.is(d,old.deps[k])))pending.push(()=>{old?.cleanup?.();effectStates[i]={deps,cleanup:effect()};});},
    useRef:value=>{const i=stateIndex++;if(!(i in states))states[i]={current:value};return states[i];},useMemo:fn=>fn(),useCallback:fn=>fn,useId:()=>`selector-${stateIndex}`,
  };
  const auth={
    sessionRevision:()=>0,isCurrentAuthResult:()=>true,
    pendingMfaChallenge:()=> 'synthetic-password-proof',
    signup:async payload=>{events.push(['signup',payload]);return {user:{...signedUser,emailVerified:false}};},
    mfaChallenge:async payload=>{events.push(['challenge',payload]);return {user:signedUser};},
    verifySendBoth:async()=>{events.push(['send']);return {channels:{email:currentUser?.emailVerified?{sent:false,alreadyVerified:true}:{sent:true},phone:currentUser?.phoneVerified?{sent:false,alreadyVerified:true}:{sent:false}}};},
    verifyConfirmEither:async(code,channel)=>{events.push(['verify',code,channel]);if(verifyResult instanceof Error)throw verifyResult;return verifyResult;},
  };
  const company={
    read:async value=>{events.push(['read',value]);if(readError)throw new Error(readError);return {invitation:invite};},
    accept:async value=>{events.push(['accept',value]);return {ok:true,organization:{id:invitation.organizationId}};},
    select:async value=>{events.push(['select',value]);if(selectError)throw new Error(selectError);return value?{...signedUser,organizationId:value,organizationType:'company'}:signedUser;},
    contexts:async()=>({organizations:[{id:invitation.organizationId,name:invitation.companyName}]}),
  };
  function load(modulePath) {
    const exports={};
    vm.runInNewContext(transpile(modulePath,modulePath.includes('AuthForms')?'\nexport {LoginForm,SignupForm};':modulePath.includes('CompanyShell')?'\nexport {CompanyTopbar};':''),{
      exports,React,Error,URL,URLSearchParams,
      window:{location:{search},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})},
      sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
      setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(id){if(timers[id-1])timers[id-1]=()=>{};},setInterval:()=>1,clearInterval(){},
      require:name=>{
      if(name==='@/lib/partner-workshop') return {workshopServices:['Computer Diagnostics','Engine Overhaul','Brake & Suspension','Tyres & Wheel Alignment','Auto Electrical','Mobile Roadside Unit']};
        if(name==='react')return React;
        if(name.endsWith('/nigeria-locations.mjs'))return require('../../../packages/shared/nigeria-locations.mjs');
        if(name==='next/link')return {default:'Link',__esModule:true};
        if(name==='next/navigation')return {useRouter:()=>router,usePathname:()=>'/company'};
        if(name==='@/lib/company-invitation-routing')return load('../lib/company-invitation-routing.ts');
        if(name==='@/lib/auth-routing')return load('../lib/auth-routing.ts');
        if(name==='@/lib/mock/company-data')return load('../lib/mock/company-data.ts');
        if(name==='@/components/site/routes')return load('../components/site/routes.ts');
        if(name==='@/lib/session-store')return {readPersistedSession:()=>currentUser,readRememberedEmail:()=>'',writeRememberedEmail(){}};
        if(name==='@/components/shared/AuthContext')return {useSession:()=>({user:currentUser,status,
          login:async payload=>{events.push(['login',payload]);currentUser=signedUser;return {mfaRequired:mfa};},
          setUser:value=>{currentUser=value;events.push(['session',value]);},refresh:async()=>{currentUser={...currentUser,emailVerified:verifyResult.emailVerified,phoneVerified:verifyResult.phoneVerified,accountVerified:verifyResult.accountVerified};},logout:async()=>{currentUser=null;status="unauthenticated";events.push(['logout']);}})};
        if(name==='@/components/shared/Toast')return {useToast:()=>({success(){},error(){}})};
        if(name==='@/lib/services/company-invitations')return {companyInvitationsApi:company};
        if(name==='@/lib/services')return {authApi:auth,LIVE_MODE:true};
        if(name==='@/components/shared/useDialogFocus')return {useDialogFocus(){}};
        return new Proxy({}, {get:(_,key)=>String(key)});
      }
    });return exports;
  }
  const exports=load(path);
  let currentProps={token,children:'Fleet content',...(componentName==='MFASetupUI'?{stage:'challenge'}:{})};
  function render(props=currentProps){currentProps=props;stateIndex=0;effectIndex=0;tree=exports[componentName](props);while(pending.length)pending.shift()();return tree;}
  render();
  return {render,events,timers,nodes:()=>nodes(tree),text:()=>textOf(tree),changeUser(value){currentUser=value;render();render();},async settle(){await flush();render();},change(id,value){nodes(tree).find(n=>(n.type==='input'||n.type==='select')&&n.props.id===id).props.onChange({target:{value}});render();},async click(label){await nodes(tree).find(n=>n.type==='button'&&textOf(n)===label).props.onClick();await flush();render();},async submit(){await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();render();},getExports:()=>exports};
}
test('legacy invitation query maps to a validated internal acceptance destination',()=>{
  const helpers=fixture('../lib/company-invitation-routing.ts','companyInvitationPath',{user:null});
  const {authReturnPath,withAuthReturn,companyInvitationPath}=helpers.getExports();
  assert.equal(authReturnPath(`?invite=${token}`),destination);
  assert.equal(authReturnPath(`?returnUrl=${encodeURIComponent(destination)}`),destination);
  assert.equal(withAuthReturn('/auth/login',destination),`/auth/login?returnUrl=${encodeURIComponent(destination)}`);
  for(const invalid of ['//evil.example','/\\evil.example','https://evil.example','/%0aevil.example'])assert.equal(authReturnPath(`?returnUrl=${encodeURIComponent(invalid)}`),null);
  assert.equal(companyInvitationPath('invalid-token'),null);
});
test('signed-out invitation provides sign-in and signup links that preserve acceptance',async()=>{
  const ui=fixture('../components/auth/CompanyInvitation.tsx','CompanyInvitation',{user:null,status:'unauthenticated'});await ui.settle();
  const links=ui.nodes().filter(n=>n.type==='Link');assert.ok(links.some(n=>n.props.href===`/auth/login?returnUrl=${encodeURIComponent(destination)}`));assert.ok(links.some(n=>n.props.href===`/auth/signup?returnUrl=${encodeURIComponent(destination)}`));assert.equal(ui.events.length,0);
});
test('a verified invitee accepts, selects the company and keeps their account role before navigation',async()=>{
  const ui=fixture('../components/auth/CompanyInvitation.tsx','CompanyInvitation');await ui.settle();await ui.click('Accept invitation');
  assert.deepEqual(ui.events.map(([kind])=>kind),['read','accept','select','session','push']);assert.equal(ui.events.at(-2)[1].role,'customer');assert.equal(ui.events.at(-1)[1],'/company');
});
test('unverified invitees have a verification destination and no acceptance button',async()=>{
  const ui=fixture('../components/auth/CompanyInvitation.tsx','CompanyInvitation',{user:{...signedUser,emailVerified:false}});await ui.settle();
  assert.equal(ui.nodes().some(n=>n.type==='button'&&textOf(n)==='Accept invitation'),false);assert.ok(ui.nodes().some(n=>n.type==='Link'&&n.props.href===`/auth/verify-email?returnUrl=${encodeURIComponent(destination)}`));
});
test('accepted links can retry opening the company without replaying acceptance',async()=>{
  const ui=fixture('../components/auth/CompanyInvitation.tsx','CompanyInvitation',{invite:{...invitation,status:'accepted'}});await ui.settle();await ui.click('Open company dashboard');assert.equal(ui.events.some(([kind])=>kind==='accept'),false);assert.equal(ui.events.at(-1)[1],'/company');
});
for(const status of ['expired','revoked'])test(`${status} invitation exposes no acceptance or company selection`,async()=>{
  const ui=fixture('../components/auth/CompanyInvitation.tsx','CompanyInvitation',{invite:{...invitation,status}});await ui.settle();assert.equal(ui.nodes().some(n=>n.type==='button'&&/^(Accept invitation|Open company dashboard)$/.test(textOf(n))),false);assert.ok(ui.text().includes(status));
});
test('wrong-account errors expose account switching while never accepting',async()=>{
  const ui=fixture('../components/auth/CompanyInvitation.tsx','CompanyInvitation',{readError:'Sign in with the invited email'});await ui.settle();assert.ok(ui.nodes().some(n=>n.props.role==='alert'));await ui.click('Sign in with another account');assert.deepEqual(ui.events.slice(-2).map(([kind])=>kind),['logout','push']);assert.equal(ui.events.at(-1)[1],`/auth/login?returnUrl=${encodeURIComponent(destination)}`);
});
for(const mfa of [false,true])test(`login preserves invitation through ${mfa?'password MFA':'successful sign-in'}`,async()=>{
  const ui=fixture('../components/auth/AuthForms.tsx','LoginForm',{status:'unauthenticated',user:null,search:`?returnUrl=${encodeURIComponent(destination)}`,mfa});await ui.settle();ui.change('login-email','invitee@example.invalid');ui.change('login-password','synthetic-password');await ui.submit();assert.equal(ui.events.at(-1)[1],mfa?`/auth/mfa/challenge?returnUrl=${encodeURIComponent(destination)}`:destination);
});
test('signup for invitation creates a customer account and keeps the verification return path',async()=>{
  const ui=fixture('../components/auth/AuthForms.tsx','SignupForm',{status:'unauthenticated',user:null,search:`?returnUrl=${encodeURIComponent(destination)}`});await ui.settle();
  ui.change('signup-name','Synthetic Invitee');ui.change('signup-email','invitee@example.invalid');ui.change('signup-phone','08012345678');ui.change('signup-state','Lagos');ui.change('signup-localGovernmentArea','Ikeja');ui.change('signup-password','synthetic-password');await ui.submit();
  assert.equal(ui.events.find(([kind])=>kind==='signup')[1].role,'customer');assert.equal(ui.events.at(-1)[1],`/auth/verify-email?returnUrl=${encodeURIComponent(destination)}`);
});
test('MFA completion keeps server role and returns to invitation with no proof in URL',async()=>{
  const ui=fixture('../components/auth/MFAUI.tsx','MFASetupUI',{search:`?returnUrl=${encodeURIComponent(destination)}`});ui.render({stage:'challenge'});await ui.settle();let input=ui.nodes().find(n=>typeof n.type==='function'&&n.type.name==='TotpInput');input.props.onChange('123456');ui.render({stage:'challenge'});await ui.submit();assert.equal(ui.events.at(-1)[1],destination);assert.equal(ui.events.at(-2)[1].role,'customer');assert.equal(ui.events.at(-1)[1].includes('synthetic-password-proof'),false);
});
test('email verification returns to invitation while phone remains pending',async()=>{
  const ui=fixture('../components/auth/VerificationUI.tsx','VerificationUI',{user:{...signedUser,emailVerified:false},search:`?returnUrl=${encodeURIComponent(destination)}`});await ui.settle();ui.change('otp-code','123456');await ui.settle();
  // The component's existing numeric field submits automatically through its timer.
  for(const timer of ui.timers.splice(0))await timer();await ui.settle();
  if(ui.nodes().some(n=>n.type==='form'))await ui.submit();for(const timer of ui.timers.splice(0))await timer();
  assert.ok(ui.events.some(([kind,path])=>kind==='push'&&path===destination));
});
test('leaving company calls context reset and preserves role before opening the personal dashboard',async()=>{
  const ui=fixture('../components/company-dashboard/CompanyContextSelector.tsx','ReturnToPrimaryAccount',{user:{...signedUser,organizationType:'company',organizationId:'fleet-fixture'}});await ui.click('Return to personal account');assert.deepEqual(ui.events.map(([kind])=>kind),['select','session','push']);assert.equal(ui.events[0][1],null);assert.equal(ui.events[1][1].role,'customer');assert.equal(ui.events[2][1],'/customer');
});
test('company shell gates a customer until a company context is selected',()=>{
  const ui=fixture('../components/company-dashboard/CompanyShell.tsx','CompanyShell',{user:signedUser});assert.ok(ui.text().includes('Choose your company'));assert.equal(ui.text().includes('Fleet content'),false);
});
test('company shell prevents pending operations and explains admin contract approval',()=>{
 const user={...signedUser,organizationId:'fleet-fixture',organizationType:'company',organizationVerificationStatus:'pending'};
 const ui=fixture('../components/company-dashboard/CompanyShell.tsx','CompanyShell',{user});
 assert.match(ui.text(),/Contract approval required/);assert.match(ui.text(),/contract is agreed/);assert.equal(ui.text().includes('Fleet content'),false);
 assert.ok(ui.nodes().some(n=>n.type==='Link'&&n.props.href==='/company/support'));
 const approved=fixture('../components/company-dashboard/CompanyShell.tsx','CompanyShell',{user:{...user,organizationVerificationStatus:'verified'}});
 assert.equal(approved.text().includes('Fleet content'),true);assert.equal(approved.text().includes('Contract approval required'),false);
});
test('company search offers only approved destinations for the current company',()=>{
 for(const approval of ['pending','verified']){
  const ui=fixture('../components/company-dashboard/CompanyShell.tsx','CompanyTopbar',{user:{...signedUser,organizationType:'company',organizationVerificationStatus:approval}});
  const search=ui.nodes().find(n=>n.type==='DashboardSearch');
  const routes=search.props.entries.map(n=>n.href);
  assert.equal(routes.includes('/company/vehicles'),approval==='verified');assert.equal(routes.includes('/company/support'),true);
 }
});
test('switching company closes its mobile menu before replacing the dialog subtree',()=>{
 const user={...signedUser,organizationId:'fleet-A',organizationType:'company',organizationVerificationStatus:'verified'};
 const ui=fixture('../components/company-dashboard/CompanyShell.tsx','CompanyShell',{user});
 ui.nodes().find(n=>n.type?.name==='CompanyTopbar').props.onOpenMenu();ui.render();
 assert.equal(ui.nodes().filter(n=>n.props.role==='dialog').length,1);
 ui.changeUser({...user,organizationId:'fleet-B',organizationVerificationStatus:'pending'});
 assert.equal(ui.nodes().filter(n=>n.props.role==='dialog').length,0);assert.match(ui.text(),/Contract approval required/);
});
function clientFixture({request}={}) {
  let tokens={accessToken:'original-access',refreshToken:'original-refresh'};
  const requests=[],writes=[],exports={};
  vm.runInNewContext(transpile('../lib/services/company-invitations.ts'),{exports,Error,
    require:name=>name==='@/lib/services'?{api:{request:async(path,options)=>{requests.push({path,options});return request?request(path,options):{user:signedUser,accessToken:'selected-access',refreshToken:'selected-refresh'};}}}:
      {readTokens:()=>tokens,writeTokens:value=>{tokens=value;writes.push(value);}}});
  return {api:exports.companyInvitationsApi,requests,writes,changeSession:value=>{tokens=value;}};
}
test('company selection binds the request to the current refresh credential and persists both signed tokens',async()=>{
  const client=clientFixture();const user=await client.api.select('fleet-fixture');assert.equal(user.role,'customer');assert.equal(client.requests[0].path,'/api/auth/company-context');assert.deepEqual(JSON.parse(client.requests[0].options.body),{organizationId:'fleet-fixture',refreshToken:'original-refresh'});assert.equal(client.writes[0].refreshToken,'selected-refresh');
});
test('company selection cannot restore a session after logout or account replacement',async()=>{
  let resolve;const client=clientFixture({request:()=>new Promise(done=>{resolve=done;})});const pending=client.api.select('fleet-fixture');client.changeSession(null);resolve({user:signedUser,accessToken:'stale-access',refreshToken:'stale-refresh'});await assert.rejects(pending,/session changed/);assert.equal(client.writes.length,0);
});
test('company selection fails without a live refresh credential',async()=>{
  const client=clientFixture();client.changeSession(null);await assert.rejects(client.api.select('fleet-fixture'),/Sign in again/);assert.equal(client.requests.length,0);
});
test('company selection failure never overwrites existing signed tokens',async()=>{
  const client=clientFixture({request:async()=>{throw new Error('Membership suspended');}});await assert.rejects(client.api.select('fleet-fixture'),/suspended/);assert.equal(client.writes.length,0);
});

test('signup verification selects the code channel and submits only that proof',async()=>{
  const ui=fixture('../components/auth/VerificationUI.tsx','VerificationUI',{user:{...signedUser,emailVerified:false,phoneVerified:false,phone:'+2348012345678'}});
  await ui.settle();
  ui.change('otp-code','123456');
  ui.nodes().find(node=>node.props?.type==='radio'&&node.props.value==='phone').props.onChange();
  await ui.settle();
  assert.equal(ui.nodes().find(node=>node.props.id==='otp-code').props.value,'');
  assert.equal(ui.nodes().find(node=>node.props?.type==='radio'&&node.props.value==='phone').props.checked,true);
  assert.equal(ui.events.filter(([kind])=>kind==='verify').length,0);
  ui.change('otp-code','654321');await ui.submit();
  assert.deepEqual(ui.events.filter(([kind])=>kind==='verify'),[['verify','654321','phone']]);
});

for(const channel of ['email','phone']) test(`signup ${channel} proof completes the account without marking the other contact verified`,async()=>{
  const ui=fixture('../components/auth/VerificationUI.tsx','VerificationUI',{user:{...signedUser,emailVerified:false,phoneVerified:false,phone:'+2348012345678'},verifyResult:{accountVerified:true,emailVerified:channel==='email',phoneVerified:channel==='phone',allVerified:false,remaining:[channel==='email'?'phone':'email']}});
  await ui.settle();ui.nodes().find(node=>node.props?.type==='radio'&&node.props.value===channel).props.onChange();await ui.settle();
  ui.change('otp-code','123456');await ui.submit();await ui.settle();
  assert.equal(ui.nodes().some(node=>node.type==='form'),false);
  assert.match(ui.text(),/Account verification complete/);
  assert.doesNotMatch(ui.text(),/Your email and phone are verified/);
  const other=ui.nodes().find(node=>node.type==='div'&&node.props.key===(channel==='email'?'Phone':'Email'));
  assert.doesNotMatch(textOf(other),/Verified/);
  assert.deepEqual(ui.events.filter(([kind])=>kind==='verify'),[['verify','123456',channel]]);
  for(const timer of ui.timers.splice(0))timer();await ui.settle();
  assert.ok(ui.events.some(([kind,path])=>kind==='push'&&path==='/customer'));
});

test('switching signup code channels clears a rejected code without trying another channel automatically',async()=>{
  const ui=fixture('../components/auth/VerificationUI.tsx','VerificationUI',{user:{...signedUser,emailVerified:false,phoneVerified:false,phone:'+2348012345678'},verifyResult:new Error('Fixture email code rejected')});
  await ui.settle();ui.change('otp-code','123456');await ui.submit();
  assert.match(ui.text(),/Fixture email code rejected/);
  ui.nodes().find(node=>node.props?.type==='radio'&&node.props.value==='phone').props.onChange();await ui.settle();
  assert.equal(ui.nodes().find(node=>node.props.id==='otp-code').props.value,'');
  assert.doesNotMatch(ui.text(),/Fixture email code rejected/);
  assert.deepEqual(ui.events.filter(([kind])=>kind==='verify'),[['verify','123456','email']]);
});

test('invitation email proof remains sufficient without falsely claiming phone verification',async()=>{
  const ui=fixture('../components/auth/VerificationUI.tsx','VerificationUI',{user:{...signedUser,emailVerified:false,phoneVerified:false,phone:'+2348012345678'},search:`?returnUrl=${encodeURIComponent(destination)}`});
  await ui.settle();ui.change('otp-code','123456');await ui.submit();await ui.settle();
  assert.match(ui.text(),/Email verified/);
  assert.doesNotMatch(ui.text(),/Your account is verified|Your email and phone are verified/);
  for(const timer of ui.timers.splice(0))timer();await ui.settle();
  assert.ok(ui.events.some(([kind,path])=>kind==='push'&&path===destination));
  assert.deepEqual(ui.events.filter(([kind])=>kind==='verify'),[['verify','123456','email']]);
});

test('phone proof cannot complete an email-required company invitation flow',async()=>{
  const ui=fixture('../components/auth/VerificationUI.tsx','VerificationUI',{user:{...signedUser,emailVerified:false,phoneVerified:false,phone:'+2348012345678'},search:`?returnUrl=${encodeURIComponent(destination)}`,verifyResult:{accountVerified:true,emailVerified:false,phoneVerified:true,allVerified:false,remaining:['email']}});
  await ui.settle();ui.nodes().find(node=>node.props?.type==='radio'&&node.props.value==='phone').props.onChange();await ui.settle();
  ui.change('otp-code','123456');await ui.submit();await ui.settle();
  assert.equal(ui.nodes().some(node=>node.type==='form'),true);
  assert.match(ui.text(),/Verify your email address to accept this company invitation/);
  assert.equal(ui.nodes().find(node=>node.props?.type==='radio'&&node.props.value==='email').props.checked,true);
  assert.equal(ui.nodes().find(node=>node.props?.type==='radio'&&node.props.value==='phone').props.disabled,true);
  for(const timer of ui.timers.splice(0))timer();
  assert.equal(ui.events.some(([kind])=>kind==='push'),false);
});

for(const channel of ['email','phone']) test(`an existing ${channel} proof skips automatic delivery, with an explicit optional-contact action`,async()=>{
  const ui=fixture('../components/auth/VerificationUI.tsx','VerificationUI',{user:{...signedUser,emailVerified:channel==='email',phoneVerified:channel==='phone',phone:'+2348012345678'}});
  await ui.settle();await ui.settle();
  assert.match(ui.text(),/Account verification complete/);
  assert.equal(ui.events.filter(([kind])=>kind==='send').length,0);
  await ui.click('Verify remaining contact');await ui.settle();
  assert.equal(ui.events.filter(([kind])=>kind==='send').length,1);
  const radios=ui.nodes().filter(node=>node.props?.type==='radio');
  assert.equal(radios.find(node=>node.props.value===channel).props.disabled,true);
  assert.equal(radios.find(node=>node.props.value!==channel).props.checked,true);
});

test('neither verified contact still triggers the initial dual-channel delivery request',async()=>{
  const ui=fixture('../components/auth/VerificationUI.tsx','VerificationUI',{user:{...signedUser,emailVerified:false,phoneVerified:false,phone:'+2348012345678'}});
  await ui.settle();await ui.settle();
  assert.equal(ui.events.filter(([kind])=>kind==='send').length,1);
  assert.equal(ui.nodes().some(node=>node.type==='form'),true);
});

test('phone-only company invitees must still verify email before acceptance',async()=>{
  const ui=fixture('../components/auth/CompanyInvitation.tsx','CompanyInvitation',{user:{...signedUser,emailVerified:false,phoneVerified:true,accountVerified:true}});
  await ui.settle();
  assert.equal(ui.nodes().some(node=>node.type==='button'&&textOf(node)==='Accept invitation'),false);
  assert.match(ui.text(),/Verify your email address to accept this invitation/);
});

test('optional signup verification cancels the completed-account redirect and can be skipped',async()=>{
  const ui=fixture('../components/auth/VerificationUI.tsx','VerificationUI',{user:{...signedUser,emailVerified:false,phoneVerified:false,phone:'+2348012345678'},verifyResult:{accountVerified:true,emailVerified:true,phoneVerified:false,allVerified:false,remaining:['phone']}});
  await ui.settle();ui.change('otp-code','123456');await ui.submit();await ui.settle();
  await ui.click('Verify remaining contact');await ui.settle();
  for(const timer of ui.timers.splice(0))timer();await ui.settle();
  assert.equal(ui.events.some(([kind])=>kind==='push'),false);
  assert.equal(ui.events.filter(([kind])=>kind==='send').length,2);
  assert.equal(ui.nodes().some(node=>node.type==='form'),true);
  await ui.click('Skip optional verification');
  assert.match(ui.text(),/Account verification complete/);
  assert.doesNotMatch(ui.text(),/Your email and phone are verified/);
});

for(const [emailVerified,phoneVerified] of [[false,false],[true,false],[false,true],[true,true]]) test(`success summary keeps contact badges truthful (${emailVerified}/${phoneVerified})`,async()=>{
  const ui=fixture('../components/auth/SuccessHonesty.tsx','SuccessHonesty',{user:{...signedUser,emailVerified,phoneVerified}});
  const complete=emailVerified||phoneVerified;
  assert.match(ui.text(),complete?/Account Verified/:/Account Created/);
  const rows=ui.nodes().filter(node=>node.type==='li');
  assert.match(textOf(rows[0]),emailVerified?/Verified$/:/Not yet verified$/);
  assert.match(textOf(rows[1]),phoneVerified?/Verified$/:/Not yet verified$/);
  if(!emailVerified||!phoneVerified)assert.doesNotMatch(ui.text(),/are both confirmed/);
});

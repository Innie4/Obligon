const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const nodes = tree => !tree ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => !tree ? '' : Array.isArray(tree) ? tree.map(text).join(' ') : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
function load(path, dependencies = {}, expose = '', globals = {}) {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + expose, { fileName: require.resolve(path), compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
 vm.runInNewContext(code, { exports, Error, URL, URLSearchParams, Date, JSON, crypto: { randomUUID: () => 'allocation-test-key' }, require: name => dependencies[name] ?? {}, ...globals });
 return exports;
}
function hooks() {
 const slots = []; let cursor = 0, effects = [];
 const React = { createElement: element,
  useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
  useRef(initial) { return slots[cursor++] ??= { current: initial }; },
  useCallback(fn) { cursor++; return fn; },
  useEffect(fn, deps) { const i = cursor++, previous = slots[i]; if (!previous || !deps || deps.some((value, n) => !Object.is(value, previous.deps?.[n]))) { effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); slots[i] = { deps }; } },
 };
 return { React, render(component, props = {}) { cursor = 0; const tree = component(props); const pending = effects; effects = []; pending.forEach(fn => fn()); return tree; } };
}
const flush = async () => { for (let n = 0; n < 24; n++) await Promise.resolve(); };
const event = { preventDefault() {} };
const config = { fee: { bearer: 'customer', basisPoints: 150, percent: 1.5 }, minimumTopupKobo: 10000, provider: 'flutterwave' };
const wallet = { company: { balanceKobo: 100000, balanceLabel: '₦1,000.00' }, members: [{ userId: 'member', name: 'Member', email: 'member@example.invalid', balanceLabel: '₦0.00' }], recent: [] };
function fixture(name, services = {}, company = {}, file = 'CompanyModals') {
 const runtime = hooks(), storage = new Map(), calls = [], errors = [];
 const props = { modal: 'walletFund', onClose() {}, onSaved() {} };
 const globals = { window: { location: { search: '', pathname: '/company/billing', assign: url => calls.push(url) }, history: { replaceState() {} } }, sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
 const mutationsApi = { ...services };
 const dependencies = { react: runtime.React, '@/components/shared/useDialogFocus': { useDialogFocus() {} }, '@/components/shared/Toast': { useToast: () => ({ error: e => errors.push(e), success() {} }) }, '@/components/shared/AuthContext': { useSession: () => ({ user: { id: 'owner', organization: 'Fleet', organizationId:'company-a' } }) }, '@/lib/services': { mutationsApi, publicApi: { getPaymentConfig: async () => config }, ApiError: class ApiError extends Error {} }, '@/lib/services/company': { companyApi: { wallet: async () => wallet, choices: async () => ({ cards: [{ id: 'card', masked_pan: '•••• 1234', label: 'Fleet', status: 'active' }], vehicles: [], drivers: [], issuerCustomerConfigured: true }), ...company } }, '@/lib/customer-funding-quote': load('../lib/customer-funding-quote.ts'), '@/components/shared/useAsync': { useAsync: loader => { calls.push(loader); return { status: 'success', data: { vehicles: [], cards: [], transactions: [], metrics: [], total: 51, drivers: [], capabilities: { stableDriverFilters: true } }, reload() {} }; } }, '@/lib/mock/company-data': { pageCopy: { vehicles: { title: 'Vehicles' }, cards: { title: 'Cards' }, transactions: { title: 'Transactions' } } } };
 const mod = load(`../components/company-dashboard/${file}.tsx`, dependencies, `\nexport { ${name} };`, globals);
 return { ...runtime, component: mod[name], props, calls, errors, storage, mutationsApi, dependencies, globals };
}
const find = (tree, type, label) => nodes(tree).find(node => node.type === type && (!label || text(node).includes(label)));
test('company fleet services preserve total and caller pagination/search', async () => {
 const paths = []; const { companyApi } = load('../lib/services/company.ts', { './client': { api: { request: async path => { paths.push(path); return { vehicles: [], cards: [], total: 123 }; } } } });
 assert.equal((await companyApi.vehicles('limit=20&offset=100&search=Truck')).total, 123);
 assert.equal((await companyApi.cards('limit=20&offset=100')).total, 123);
 assert.match(paths[0], /offset=100.*search=Truck/); assert.match(paths[1], /offset=100/);
});
test('vehicle and card pages load another page and search resets its offset', async () => {
 for (const name of ['Vehicles', 'Cards']) {
  const fixtureValue = fixture(name, {}, {}, 'CompanyScreen'); let tree = fixtureValue.render(fixtureValue.component, { onModal() {} });
  const pagination = nodes(tree).find(node => typeof node.type === 'function' && node.props.total === 51); assert.ok(pagination, name);
  pagination.props.onPageChange(2); tree = fixtureValue.render(fixtureValue.component, { onModal() {} });
  let query; fixtureValue.dependencies['@/lib/services/company'].companyApi[name.toLowerCase()] = async value => { query = new URLSearchParams(value); };
  await fixtureValue.calls.at(-1)(); assert.equal(query.get('offset'), '40'); assert.equal(query.get('limit'), '20');
  find(tree, 'input').props.onChange({ target: { value: 'Truck' } }); tree = fixtureValue.render(fixtureValue.component, { onModal() {} });
  assert.equal(nodes(tree).find(node => node.props?.total === 51).props.page, 0);
  await fixtureValue.calls.at(-1)(); assert.equal(query.get('offset'), '0'); assert.equal(query.get('search'), 'Truck');
 }
});
test('company transaction filter resets page and preserves export filters', () => {
 const f = fixture('Transactions', {}, {}, 'CompanyScreen'); let tree = f.render(f.component, { onModal() {} });
 const pagination = nodes(tree).find(node => node.props?.total === 51); assert.ok(pagination); pagination.props.onPageChange(2);
 tree = f.render(f.component, { onModal() {} }); find(tree, 'select').props.onChange({ target: { value: 'LAG-22' } });
 tree = f.render(f.component, { onModal() {} }); assert.equal(nodes(tree).find(node => node.props?.total === 51).props.page, 0);
 const header = nodes(tree).find(node => node.props?.action?.context); assert.equal(header.props.action.context.vehicle, 'LAG-22');
});
test('company funding blocks missing fee configuration and fractional naira', async () => {
 const f = fixture('CompanyWalletFund', { companyTopUpWallet: async () => { throw Error('must not call'); } });
 let tree = f.render(f.component, f.props); assert.equal(find(tree, 'button', 'payment').props.disabled, true); await flush();
 tree = f.render(f.component, f.props); find(tree, 'input').props.onChange({ target: { value: '100.25' } });
 tree = f.render(f.component, f.props); assert.equal(find(tree, 'button', 'payment').props.disabled, true); assert.match(text(tree), /whole/);
});
test('company funding binds disclosed charge and never credits balance from checkout', async () => {
 const calls = []; const f = fixture('CompanyWalletFund', { companyTopUpWallet: async (...args) => { calls.push(args); return { reference: 'TOPUP-test', paymentUrl: 'https://checkout.example.invalid', amountKobo: 10100, feeKobo: 200, totalKobo: 10300 }; } });
 f.render(f.component, f.props); await flush(); let tree = f.render(f.component, f.props); find(tree, 'input').props.onChange({ target: { value: '101' } });
 tree = f.render(f.component, f.props); assert.match(text(tree), /₦103\.00/); await find(tree, 'form').props.onSubmit(event);
 assert.deepEqual(calls[0], [10100, 'Card / Bank', 10300]); assert.equal(f.calls[0], 'https://checkout.example.invalid/'); assert.ok([...f.storage.values()].includes('TOPUP-test'));
 await find(tree, 'form').props.onSubmit(event); assert.equal(calls.length, 1);
});
test('company funding failed settings can retry and a mismatched quote never redirects', async () => {
 const f = fixture('CompanyWalletFund', { companyTopUpWallet: async () => ({ reference:'TOPUP-test',paymentUrl:'https://checkout.example.invalid',amountKobo:100000,feeKobo:2000,totalKobo:102000 }) });
 let fail = true; f.dependencies['@/lib/services'].publicApi.getPaymentConfig = async () => { if (fail) throw Error('Settings offline'); return config; };
 f.render(f.component,f.props); await flush(); let tree = f.render(f.component,f.props); assert.match(text(tree),/Settings offline/); assert.equal(nodes(tree).find(node=>node.type==='button'&&node.props.type==='submit').props.disabled,true);
 fail = false; find(tree,'button','Retry payment settings').props.onClick(); f.render(f.component,f.props); await flush(); tree = f.render(f.component,f.props);
 await find(tree,'form').props.onSubmit(event); tree = f.render(f.component,f.props); assert.match(text(tree),/not confirmed for this quote/); assert.equal(f.calls.length,0);
});
test('member allocation preserves same request key after an uncertain failure', async () => {
 const calls = []; let fail = true; const f = fixture('CompanyWalletAllocate', { companyAllocateWallet: async payload => { calls.push({ ...payload }); if (fail) throw Error('Response lost; retry'); return { reference: 'ALC-test' }; } });
 const props = { ...f.props, modal: 'walletAllocate' }; f.render(f.component, props); await flush(); let tree = f.render(f.component, props);
 find(tree, 'select').props.onChange({ target: { value: 'member' } }); find(tree, 'input').props.onChange({ target: { value: '100' } });
 tree = f.render(f.component, props); await find(tree, 'form').props.onSubmit(event); tree = f.render(f.component, props); assert.match(text(tree), /Response lost/);
 fail = false; await find(tree, 'form').props.onSubmit(event); assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey); assert.equal(calls[1].amountKobo, 10000); assert.equal(f.storage.size, 0);
});
test('member allocation restores the same request after reopening or reloading', async () => {
 const first = fixture('CompanyWalletAllocate',{ companyAllocateWallet: async () => { throw Error('Response lost'); } });
 first.render(first.component,first.props); await flush(); let tree=first.render(first.component,first.props); find(tree,'select').props.onChange({target:{value:'member'}}); find(tree,'input').props.onChange({target:{value:'100'}});
 tree=first.render(first.component,first.props); await find(tree,'form').props.onSubmit(event); const stored=JSON.parse([...first.storage.values()][0]);
 let actual; const next=fixture('CompanyWalletAllocate',{ companyAllocateWallet:async payload=>{actual=payload;return {reference:'ALC-confirmed'};} }); for(const [key,value] of first.storage)next.storage.set(key,value);
 next.render(next.component,next.props); await flush(); tree=next.render(next.component,next.props); assert.equal(find(tree,'select').props.disabled,true); assert.equal(find(tree,'input').props.disabled,true); await find(tree,'form').props.onSubmit(event);
 assert.equal(actual.idempotencyKey,stored.idempotencyKey); assert.equal(actual.amountKobo,stored.amountKobo); assert.equal(actual.toUserId,stored.toUserId);
});
test('single-use company code remains visible with its actual expiry and wallet source', async () => {
 const f = fixture('CompanyPosCode', { companyCardPosCode: async () => ({ code: '123456', expiresAt: '2026-10-14T11:15:00Z', maskedPan: '•••• 1234' }) });
 const props = { ...f.props, modal: 'posCode', context: { cardId: 'card' } }; f.render(f.component, props); await flush(); let tree = f.render(f.component, props);
 await find(tree, 'form').props.onSubmit(event); tree = f.render(f.component, props); assert.match(text(tree), /123456/); assert.match(text(tree), /single.use/i); assert.match(text(tree), /company wallet/i); assert.ok(nodes(tree).some(node => node.type === 'time' && node.props.dateTime === '2026-10-14T11:15:00Z'));
});
test('company support conversation shows status and keeps failed reply draft for retry', async () => {
 const calls = []; let fail = true; const f = fixture('CompanySupportConversation', { replyCompanyTicket: async (id, body) => { calls.push([id, body]); if (fail) throw Error('Reply unavailable'); return { ok: true }; } }, { ticketMessages: async () => ({ status: 'closed', messages: [{ id: 'msg', sender: 'Support', role: 'admin', body: 'Review recorded', time: 'Today' }] }) });
 const props = { ...f.props, modal: 'supportConversation', context: { ticketId: 'ticket', reference: 'TK-test' } }; f.render(f.component, props); await flush(); let tree = f.render(f.component, props);
 assert.match(text(tree), /closed/i); assert.match(text(tree), /Review recorded/); find(tree, 'textarea').props.onChange({ target: { value: 'Still needs help' } });
 tree = f.render(f.component, props); await find(tree, 'form').props.onSubmit(event); tree = f.render(f.component, props); assert.match(text(tree), /Reply unavailable/); assert.equal(find(tree, 'textarea').props.value, 'Still needs help');
 fail = false; await find(tree, 'form').props.onSubmit(event); tree = f.render(f.component, props); assert.equal(find(tree, 'textarea').props.value, ''); assert.deepEqual(calls[1], ['ticket', 'Still needs help']);
});

// Two fleets may have the same display name; a pending request belongs to its ID.
test('same-name company selection cannot restore another company allocation', async () => {
 const a=fixture('CompanyWalletAllocate',{companyAllocateWallet:async()=>{throw Error('Response lost');}});
 a.render(a.component,a.props);await flush();let tree=a.render(a.component,a.props);find(tree,'select').props.onChange({target:{value:'member'}});find(tree,'input').props.onChange({target:{value:'100'}});
 tree=a.render(a.component,a.props);await find(tree,'form').props.onSubmit(event);assert.equal(a.storage.size,1);
 let submitted;const b=fixture('CompanyWalletAllocate',{companyAllocateWallet:async payload=>{submitted=payload;return {reference:'ALC-b'};}});
 b.dependencies['@/components/shared/AuthContext'].useSession=()=>({user:{id:'owner',organization:'Fleet',organizationId:'company-b'}});
 for(const [key,value] of a.storage)b.storage.set(key,value);b.render(b.component,b.props);await flush();tree=b.render(b.component,b.props);
 assert.equal(find(tree,'input').props.value,'');await find(tree,'form').props.onSubmit(event);assert.equal(submitted,undefined);
 find(tree,'select').props.onChange({target:{value:'member'}});find(tree,'input').props.onChange({target:{value:'200'}});tree=b.render(b.component,b.props);await find(tree,'form').props.onSubmit(event);
 assert.equal(submitted.organizationId,'company-b');assert.equal(submitted.amountKobo,20000);assert.ok([...b.storage.keys()].every(key=>key.endsWith('company-a')));
});

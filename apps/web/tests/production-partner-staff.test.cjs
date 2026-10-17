const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => nodes(tree).flatMap(node => node.props?.children ?? []).filter(value => typeof value === 'string' || typeof value === 'number').join(' ');
function load(path, { dependencies = {}, globals = {}, expose = '' } = {}) {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8') + expose, { fileName: require.resolve(path), compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
 vm.runInNewContext(code, { exports, Error, URLSearchParams, setTimeout, clearTimeout, require: name => name === 'next/dynamic' ? { default: () => 'StationProfileForm', __esModule: true } : dependencies[name] ?? {}, ...globals });
 return exports;
}
function hooks() {
 const slots = []; let cursor = 0, effects = [];
 const React = {
  createElement: element,
  useState(initial) { const index = cursor++; slots[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
  useRef(initial) { return slots[cursor++] ??= { current: initial }; },
  useCallback(fn, deps) { const index = cursor++; if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { fn, deps }; return slots[index].fn; },
  useEffect(fn, deps) { const index = cursor++, previous = slots[index]; if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) { effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); }); slots[index] = { deps }; } },
 };
 return { React, render(component, props = {}) { cursor = 0; const tree = component(props); const pending = effects; effects = []; pending.forEach(effect => effect()); return tree; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };

function fixture(member = null) {
 const runtime = hooks(), calls = [];
 const { StaffMemberModal } = load('../components/dashboard/DashboardScreen.tsx', { expose: '\nexport { StaffMemberModal };', dependencies: {
  react: runtime.React, '@/components/shared/Toast': { useToast: () => ({ success() {} }) },
  '@/lib/services': { mutationsApi: { async addStaff(payload) { calls.push({kind:'add',payload}); }, async updateStaff(id,payload) { calls.push({kind:'update',id,payload}); } } },
 } });
 const render = () => runtime.render(StaffMemberModal, {member,onClose() {},onSaved() {}});
 return {...runtime,render,calls};
}
test('staff form maps attendant to supported dispatcher and sends explicit POS access',async()=>{
 const f=fixture();let tree=f.render();const inputs=nodes(tree).filter(node=>node.type==='input');inputs[0].props.onChange({target:{value:'Test attendant'}});inputs[1].props.onChange({target:{value:'staff@example.invalid'}});
 tree=f.render();assert.equal(nodes(tree).find(node=>node.type==='select').props.value,'dispatcher');
 await nodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});assert.equal(f.calls.length,1);assert.equal(f.calls[0].payload.role,'dispatcher');assert.equal(f.calls[0].payload.cardAccess,true);
});
test('editing disabled staff starts disabled and submits the chosen enabled state',async()=>{
 const f=fixture({id:'member',cells:['ST-TEST','Test'],status:'SUSPENDED',cardAccess:false});let tree=f.render();const enabled=nodes(tree).find(node=>node.type==='input'&&node.props.type==='checkbox');assert.equal(enabled.props.checked,false);
 enabled.props.onChange({target:{checked:true}});tree=f.render();await nodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});assert.equal(f.calls[0].id,'member');assert.equal(f.calls[0].payload.enabled,true);
});

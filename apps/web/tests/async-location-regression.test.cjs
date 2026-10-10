const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('pending background refresh cannot overwrite stations after location changes', async () => {
  const slots = [], effects = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        previous?.cleanup?.();
        slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = fn(); });
      }
    }
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/shared/useAsync.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: () => react });
  const requests = [];
  const render = location => {
    cursor = 0;
    const result = exports.useAsync(() => new Promise(resolve => requests.push({ location, resolve })), [location]);
    effects.splice(0).forEach(effect => effect());
    return result;
  };
  const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  let result = render('west');
  requests.shift().resolve('West stations');
  await flush();
  result = render('west');
  assert.equal(result.data, 'West stations');
  result.refresh();
  render('west');
  const oldRefresh = requests.shift();
  render('east');
  const newLocation = requests.shift();
  newLocation.resolve('East stations');
  await flush();
  oldRefresh.resolve('Stale west stations');
  await flush();
  assert.equal(render('east').data, 'East stations');
});

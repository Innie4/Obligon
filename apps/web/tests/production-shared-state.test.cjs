const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, react = React) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => name === 'react' ? react : name === './StatusPopup' ? load('../components/shared/StatusPopup.tsx', react) : require(name) });
  return exports;
}
const { AsyncBoundary } = load('../components/shared/States.tsx');

function fixture() {
  const slots = [], effects = [], requests = [];
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
    },
  };
  const { useAsync } = load('../components/shared/useAsync.ts', react);
  return {
    requests,
    render(location = 'west') {
      cursor = 0;
      const result = useAsync(() => new Promise((resolve, reject) => requests.push({ location, resolve, reject })), [location]);
      effects.splice(0).forEach(effect => effect());
      return result;
    },
  };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('overlapping same-input polls retain their pending response', async () => {
  const f = fixture(); f.render(); f.requests.shift().resolve('Old records'); await flush();
  f.render().refresh(); f.render(); const pending = f.requests.shift();
  f.render().refresh(); f.render(); assert.equal(f.requests.length,0);
  pending.resolve('Fresh records'); await flush(); assert.equal(f.render().data,'Fresh records');
});

test('initial loading failure remains a blocking error without invented records', async () => {
  const f = fixture(); f.render();
  f.requests.shift().reject(new Error('API unavailable'));
  await flush();
  const result = f.render();
  assert.equal(result.status, 'error');
  assert.equal(result.data, null);
  const html = renderToStaticMarkup(React.createElement(AsyncBoundary, { status: result.status, error: result.error.message }, 'Invented records'));
  assert.match(html, /API unavailable/);
  assert.doesNotMatch(html, /Invented records/);
});

test('failed background refresh preserves last loaded records and announces refresh failure', async () => {
  const f = fixture(); f.render();
  f.requests.shift().resolve('Recorded balance: NGN 250.25'); await flush();
  f.render().refresh(); f.render();
  f.requests.shift().reject(new Error('Temporary outage')); await flush();
  const result = f.render();
  assert.equal(result.data, 'Recorded balance: NGN 250.25');
  assert.equal(result.status, 'success');
  const html = renderToStaticMarkup(React.createElement(AsyncBoundary, { status: result.status, error: result.error.message, onRetry() {} }, result.data));
  assert.match(html, /Recorded balance: NGN 250.25/);
  assert.match(html, /last loaded data/);
  assert.match(html, /Temporary outage/);
  assert.match(html, /Retry refresh/);
});

test('successful background refresh recovers an initial error into usable data', async () => {
  const f = fixture(); f.render();
  f.requests.shift().reject(new Error('Offline')); await flush();
  f.render().refresh(); f.render();
  f.requests.shift().resolve('Current station list'); await flush();
  const result = f.render();
  assert.equal(result.status, 'success');
  assert.equal(result.error, null);
  assert.equal(result.data, 'Current station list');
});

test('successful later poll clears the stale-record warning', async () => {
  const f = fixture(); f.render();
  f.requests.shift().resolve('Old records'); await flush();
  f.render().refresh(); f.render();
  f.requests.shift().reject(new Error('Offline')); await flush();
  f.render().refresh(); f.render();
  f.requests.shift().resolve('Updated records'); await flush();
  const result = f.render();
  assert.equal(result.error, null);
  assert.equal(result.data, 'Updated records');
});

test('a completed stale request cannot unlock overlap with the current location request', async () => {
  const f = fixture(); f.render('west');
  const old = f.requests.shift();
  f.render('east'); const current = f.requests.shift();
  old.resolve('Old west records'); await flush();
  f.render('east').refresh(); f.render('east');
  assert.equal(f.requests.length, 0, 'do not launch a duplicate while the east request is pending');
  current.resolve('East records'); await flush();
  assert.equal(f.render('east').data, 'East records');
});

test('empty boundary retains the creation action supplied by its caller', () => {
  const html = renderToStaticMarkup(React.createElement(AsyncBoundary, {
    status: 'success', isEmpty: true,
    empty: { title: 'No funding history', action: React.createElement('button', null, 'Add funds') },
  }));
  assert.match(html, /No funding history/);
  assert.match(html, /<button>Add funds<\/button>/);
});

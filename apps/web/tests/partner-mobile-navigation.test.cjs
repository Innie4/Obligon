const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('./helpers/status-popup.cjs').withStatusPopups(require('node:vm'));
const ts = require('typescript');
const partnerAccess = require('../../../packages/shared/partner-access.mjs');

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}

function compile(path) {
  return ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
}

const dataExports = {};
vm.runInNewContext(compile('../lib/mock/dashboard-data.ts'), { exports: dataExports });
const dashboardNav = dataExports.dashboardNav;

// The real component and navigation data run together. Only React's hooks,
// Next's current pathname and browser event/element boundaries are simulated.
function fixture(component = 'MobilePartnerAccount', { role = 'partner', partnerType, pathname = '/dashboard', desktop = false } = {}) {
  const states = [], refs = [], effects = [], pending = [];
  const listeners = new Map();
  const mediaListeners = new Set();
  const desktopMedia = {
    matches: desktop,
    addEventListener(name, callback) { assert.equal(name, 'change'); mediaListeners.add(callback); },
    removeEventListener(name, callback) { assert.equal(name, 'change'); mediaListeners.delete(callback); },
  };
  let stateIndex = 0, refIndex = 0, effectIndex = 0, dirty = false, tree;
  const document = {
    activeElement: null,
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  class Element {
    constructor(name) { this.name = name; this.children = []; }
    contains(target) { return target === this || this.children.some(child => child.contains(target)); }
    focus() { document.activeElement = this; }
  }
  const container = new Element('account container');
  const button = new Element('Account button');
  let domNodes = new Map();
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => {
        const next = typeof value === 'function' ? value(states[index]) : value;
        if (!Object.is(next, states[index])) { states[index] = next; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect(callback, dependencies) {
      const index = effectIndex++, previous = effects[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        pending.push(() => {
          previous?.cleanup?.();
          effects[index] = { dependencies, cleanup: callback() };
        });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(compile('../components/dashboard/MobileDashboardNav.tsx'), {
    exports, React, document, Node: Element,
    window: { matchMedia(query) { assert.equal(query, '(min-width: 1024px)'); return desktopMedia; } },
    require(name) {
      if (name.endsWith('/partner-access.mjs')) return partnerAccess;
      if (name === 'react') return React;
      if (name === 'next/link') return { default: 'Link', __esModule: true };
      if (name === 'next/navigation') return { usePathname: () => pathname };
      if (name === '@/lib/mock/dashboard-data') return dataExports;
      if (name === '@/components/shared/AuthContext') return { useSession: () => ({ user: { role, partnerType } }) };
      if (name === '@/components/auth/LogoutButton') return { LogoutButton: 'LogoutButton' };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
      throw new Error(`Unexpected navigation dependency: ${name}`);
    },
  });
  function render() {
    let iterations = 0;
    do {
      dirty = false;
      stateIndex = 0; refIndex = 0; effectIndex = 0;
      tree = exports[component]();
      domNodes = new Map();
      const rendered = nodes(tree);
      container.children = [];
      for (const node of rendered) {
        const element = node === tree ? container : node.type === 'button' ? button : new Element(node.props?.href ?? String(node.type));
        domNodes.set(node, element);
        if (node !== tree) container.children.push(element);
        if (node.props?.ref) node.props.ref.current = element;
      }
      while (pending.length) pending.shift()();
      assert.ok(++iterations <= 10, 'Navigation hook fixture must settle');
    } while (dirty);
    return tree;
  }
  render();
  return {
    render, document, listeners, mediaListeners, Element, container, button,
    nodes: () => nodes(tree),
    links: () => nodes(tree).filter(node => node.type === 'Link'),
    menu: () => nodes(tree).find(node => node.type === 'nav' && node.props['aria-label'] === 'Partner account'),
    disclosure: () => nodes(tree).find(node => node.type === 'button'),
    dom: node => domNodes.get(node),
    clickAccount() { nodes(tree).find(node => node.type === 'button').props.onClick(); render(); },
    navigate(nextPath) { pathname = nextPath; render(); },
    resizeDesktop(matches) {
      desktopMedia.matches = matches;
      for (const callback of [...mediaListeners]) callback({ matches });
      render();
    },
    dispatch(name, event) { for (const callback of [...(listeners.get(name) ?? [])]) callback(event); render(); },
    blur(relatedTarget) { tree.props.onBlur({ currentTarget: container, relatedTarget }); render(); },
    unmount() { effects.forEach(effect => effect.cleanup?.()); },
  };
}

const hrefs = ui => ui.links().map(node => node.props.href);
const activeHrefs = ui => ui.links().filter(node => node.props['aria-current'] === 'page').map(node => node.props.href);
const activeListenerCount = ui => [...ui.listeners.values()].reduce((total, callbacks) => total + callbacks.size, 0);

test('partner bottom navigation and Account partition every real dashboard route exactly once', () => {
  const primary = fixture('MobileDashboardNav');
  const account = fixture();
  account.clickAccount();
  assert.deepEqual(hrefs(primary), ['/dashboard', '/dashboard/transactions', '/dashboard/station-profile', '/dashboard/reports', '/dashboard/settlements']);
  assert.equal(primary.links().length, 5);
  assert.equal(account.links().length, 8);
  const combined = [...hrefs(primary), ...hrefs(account)];
  assert.equal(new Set(combined).size, combined.length);
  assert.deepEqual([...combined].sort(), Array.from(dashboardNav.filter(item => partnerAccess.partnerPageAllowed({role:'partner'},item.key)), item => item.href).sort());
  assert.equal(account.nodes().filter(node => node.type === 'LogoutButton').length, 1);
  account.unmount();
});

test('mechanic navigation exposes workshop and common account routes', () => {
  const primary = fixture('MobileDashboardNav', { role: 'mechanic' });
  const account = fixture('MobilePartnerAccount', { role: 'mechanic' });
  account.clickAccount();
  assert.deepEqual(hrefs(primary), ['/dashboard', '/dashboard/workshop', '/dashboard/staff', '/dashboard/notifications']);
  assert.deepEqual(hrefs(account), ['/dashboard/billing', '/dashboard/verify', '/dashboard/settings']);
  assert.equal(new Set([...hrefs(primary), ...hrefs(account)]).size, 7);
  assert.equal(account.nodes().filter(node => node.type === 'LogoutButton').length, 1);
  account.unmount();
});

test('a partner account with mechanic organization profile has the same workshop navigation as a legacy mechanic', () => {
  const ui = fixture('MobileDashboardNav', { role: 'partner', partnerType: 'mechanic' });
  assert.deepEqual(hrefs(ui), ['/dashboard', '/dashboard/workshop', '/dashboard/staff', '/dashboard/notifications']);
  assert.equal(ui.links().some(node => /transactions|reports|settlements|fuel-pricing|card-verification/.test(node.props.href)), false);
});

test('gas stations retain their operational navigation and never receive a workshop link', () => {
  const primary = fixture('MobileDashboardNav', { role: 'partner', partnerType: 'gas_station' });
  const account = fixture('MobilePartnerAccount', { role: 'partner', partnerType: 'gas_station' });
  account.clickAccount();
  const combined = [...hrefs(primary), ...hrefs(account)];
  assert.ok(combined.includes('/dashboard/station-profile'));
  assert.ok(combined.includes('/dashboard/card-verification'));
  assert.equal(combined.includes('/dashboard/workshop'), false);
  account.unmount();
});

for (const [path, expected] of [
  ['/dashboard', ['/dashboard']],
  ['/mechanic', ['/dashboard']],
  ['/dashboard/transactions', ['/dashboard/transactions']],
  ['/dashboard/transactions/synthetic-detail', ['/dashboard/transactions']],
  ['/dashboard/reports', ['/dashboard/reports']],
  ['/dashboard/transactions-other', []],
  ['/dashboardish', []],
]) {
  test(`primary active state matches an actual route boundary at ${path}`, () => {
    const ui = fixture('MobileDashboardNav', { pathname: path });
    assert.deepEqual(activeHrefs(ui), expected);
  });
}

test('nested Account route marks its link and header disclosure active without activating Overview', () => {
  const account = fixture('MobilePartnerAccount', { pathname: '/dashboard/staff/synthetic-member' });
  assert.match(account.disclosure().props.className, /bg-obligon-green/);
  account.clickAccount();
  assert.deepEqual(activeHrefs(account), ['/dashboard/staff']);
  assert.deepEqual(activeHrefs(fixture('MobileDashboardNav', { pathname: '/dashboard/staff/synthetic-member' })), []);
  account.unmount();
});

test('Account is a closed disclosure until clicked and toggling cleans its document listeners', () => {
  const ui = fixture();
  assert.equal(ui.disclosure().props['aria-expanded'], false);
  assert.equal(ui.disclosure().props['aria-controls'], 'partner-mobile-account');
  assert.equal(ui.menu(), undefined);
  assert.equal(activeListenerCount(ui), 0);
  ui.clickAccount();
  assert.equal(ui.disclosure().props['aria-expanded'], true);
  assert.equal(ui.menu().props.id, 'partner-mobile-account');
  assert.equal(activeListenerCount(ui), 2);
  ui.clickAccount();
  assert.equal(ui.menu(), undefined);
  assert.equal(ui.disclosure().props['aria-expanded'], false);
  assert.equal(activeListenerCount(ui), 0);
});

test('selecting an Account destination closes the menu and removes listeners', () => {
  const ui = fixture();
  ui.clickAccount();
  ui.links().find(node => node.props.href === '/dashboard/billing').props.onClick();
  ui.render();
  assert.equal(ui.menu(), undefined);
  assert.equal(activeListenerCount(ui), 0);
});

test('a pathname change closes Account while an unchanged pathname preserves it', () => {
  const ui = fixture();
  ui.clickAccount();
  ui.navigate('/dashboard');
  assert.ok(ui.menu());
  assert.equal(activeListenerCount(ui), 2);
  ui.navigate('/dashboard/settings');
  assert.equal(ui.menu(), undefined);
  assert.equal(activeListenerCount(ui), 0);
});

test('Escape closes Account, restores its button focus and cleans document handlers', () => {
  const ui = fixture();
  ui.clickAccount();
  ui.dom(ui.links()[0]).focus();
  ui.dispatch('keydown', { key: 'Escape' });
  assert.equal(ui.menu(), undefined);
  assert.equal(ui.document.activeElement, ui.button);
  assert.equal(activeListenerCount(ui), 0);
});

test('other keys and pointer events inside Account preserve its open state', () => {
  const ui = fixture();
  ui.clickAccount();
  ui.dispatch('keydown', { key: 'ArrowDown' });
  assert.ok(ui.menu());
  ui.dispatch('pointerdown', { target: ui.dom(ui.links()[0]) });
  assert.ok(ui.menu());
  assert.equal(activeListenerCount(ui), 2);
  ui.unmount();
});

test('an outside pointer closes Account without taking focus from the outside target', () => {
  const ui = fixture();
  ui.clickAccount();
  const outside = new ui.Element('Outside action');
  outside.focus();
  ui.dispatch('pointerdown', { target: outside });
  assert.equal(ui.menu(), undefined);
  assert.equal(ui.document.activeElement, outside);
  assert.equal(activeListenerCount(ui), 0);
});

test('focus can move within Account but leaving the disclosure closes it', () => {
  const ui = fixture();
  ui.clickAccount();
  ui.blur(ui.dom(ui.links()[0]));
  assert.ok(ui.menu());
  ui.blur(new ui.Element('Outside focus target'));
  assert.equal(ui.menu(), undefined);
  assert.equal(activeListenerCount(ui), 0);
});

test('losing focus without a related target closes Account', () => {
  const ui = fixture();
  ui.clickAccount();
  ui.blur(null);
  assert.equal(ui.menu(), undefined);
  assert.equal(activeListenerCount(ui), 0);
});

test('opening repeatedly never accumulates handlers and unmount removes every listener', () => {
  const ui = fixture();
  for (let i = 0; i < 3; i++) {
    ui.clickAccount();
    ui.render();
    assert.equal(activeListenerCount(ui), 2);
    ui.clickAccount();
    assert.equal(activeListenerCount(ui), 0);
  }
  ui.clickAccount();
  assert.equal(activeListenerCount(ui), 2);
  ui.unmount();
  assert.equal(activeListenerCount(ui), 0);
  assert.equal(ui.mediaListeners.size, 0);
});

test('desktop breakpoint closes Account, unmounts its logout control and cleans document and media listeners', () => {
  const ui = fixture();
  ui.clickAccount();
  assert.equal(ui.mediaListeners.size, 1);
  assert.equal(ui.nodes().filter(node => node.type === 'LogoutButton').length, 1);
  ui.resizeDesktop(false);
  assert.ok(ui.menu());
  assert.equal(ui.mediaListeners.size, 1);
  ui.resizeDesktop(true);
  assert.equal(ui.menu(), undefined);
  assert.equal(ui.disclosure().props['aria-expanded'], false);
  assert.equal(ui.nodes().filter(node => node.type === 'LogoutButton').length, 0);
  assert.equal(activeListenerCount(ui), 0);
  assert.equal(ui.mediaListeners.size, 0);
  ui.resizeDesktop(false);
  assert.equal(ui.menu(), undefined);
});

test('an Account open attempted while desktop already matches immediately closes without leaking handlers', () => {
  const ui = fixture('MobilePartnerAccount', { desktop: true });
  ui.clickAccount();
  assert.equal(ui.menu(), undefined);
  assert.equal(ui.disclosure().props['aria-expanded'], false);
  assert.equal(activeListenerCount(ui), 0);
  assert.equal(ui.mediaListeners.size, 0);
  ui.resizeDesktop(false);
  ui.clickAccount();
  assert.ok(ui.menu());
  assert.equal(ui.mediaListeners.size, 1);
  ui.unmount();
  assert.equal(activeListenerCount(ui), 0);
  assert.equal(ui.mediaListeners.size, 0);
});

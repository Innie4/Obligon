const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
  });
}
function emDashLocations(source, filename) {
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true,
    filename.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = [];
  function visit(node) {
    const text = ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node) ? node.text : '';
    // Keep interpreting historical plan exclusions without displaying their sentinel.
    let owner = node.parent;
    while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
    const legacy = filename === 'lib/customer-entitlements.ts' && text === '\u2014' &&
      owner?.name?.text === 'customerFeatureAvailable' && ts.isArrayLiteralExpression(node.parent) &&
      node.parent.getText(parsed) === "[false, '\u2014', 'Not included']";
    if (!legacy && /\u2014|&mdash;|&#(?:8212|x2014);/i.test(text)) found.push(parsed.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return found;
}

test('copy check catches rendered entities and escaped literals while ignoring comments', () => {
  assert.equal(emDashLocations('const text = "\\u2014"; const view = <p>&mdash;</p>;', 'example.tsx').length, 2);
  assert.deepEqual(emDashLocations('// historical \u2014 note\nconst text = "Not available";', 'example.tsx'), []);
});

test('legacy plan exclusion does not exempt unrelated arrays', () => {
  const filename = 'lib/customer-entitlements.ts';
  assert.deepEqual(emDashLocations("function customerFeatureAvailable() { return [false, '\u2014', 'Not included'].includes(false); }", filename), []);
  assert.equal(emDashLocations("const banner = ['\u2014'];", filename).length, 1);
  assert.equal(emDashLocations("function anotherFeature() { return [false, '\u2014', 'Not included']; }", filename).length, 1);
});

test('static application copy contains no emitted em dashes', () => {
  const offenders = ['app', 'components', 'lib'].flatMap(folder => files(path.join(root, folder))).flatMap(file => {
    const relative = path.relative(root, file).split(path.sep).join('/');
    return emDashLocations(fs.readFileSync(file, 'utf8'), relative).map(line => `${relative}:${line}`);
  });
  assert.deepEqual(offenders, []);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const fontModule = require('next/dist/compiled/@next/font/dist/fontkit');
const fontFromBuffer = fontModule.default.default || fontModule.default;
const fontLoader = require('next/dist/compiled/@next/font/dist/local/loader').default;
const layout = path.resolve(__dirname, '../app/layout.tsx');
const descriptors = [
 { name: 'Inter', file: 'Inter-variable.woff2', hash: '351f50d53207a6a7d8643edfa2520468627b141466d572493c0ef1b3075d0311', variable: '--font-inter', bytes: 364748 },
 { name: 'Plus Jakarta Sans', file: 'PlusJakartaSans-variable.woff2', hash: '49c62cf1fb70f225ea113361f0134a48858c3a7d0175173aa3e38a0c6c8539d2', variable: '--font-plus-jakarta', bytes: 60612 },
];
for (const descriptor of descriptors) {
 test(`${descriptor.name} local asset is the verified normal variable font with Latin and naira coverage`, () => {
  const bytes = fs.readFileSync(path.join(path.dirname(layout), 'fonts', descriptor.file));
  assert.equal(bytes.subarray(0,4).toString(), 'wOF2'); assert.equal(bytes.readUInt32BE(8), bytes.length);
  assert.equal(bytes.length, descriptor.bytes); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), descriptor.hash);
  const font = fontFromBuffer(bytes); assert.equal(font.familyName, descriptor.name); assert.equal(font.subfamilyName, 'Regular');
  assert.ok(font.variationAxes.wght.min <= 400); assert.ok(font.variationAxes.wght.max >= 800); assert.equal(font.variationAxes.wght.default, 400);
  for (const point of [...Array(95)].map((_,index) => index + 32).concat(0x20a6)) assert.equal(font.hasGlyphForCodePoint(point), true, `U+${point.toString(16)}`);
  assert.ok(font.glyphForCodePoint(0x20a6).advanceWidth > 0);
 });
}
test('actual Next local loader emits only local font assets with preserved swap, weight and CSS variables', async () => {
 const source = ts.createSourceFile(layout, fs.readFileSync(layout, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 const options = [];
 function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'localFont') {
   const value = {};
   for (const property of node.arguments[0].properties) { assert.ok(ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)); value[property.name.getText(source)] = property.initializer.text; }
   options.push(value);
  }
  ts.forEachChild(node, visit);
 }
 visit(source); assert.equal(options.length, 2);
 for (let index = 0; index < options.length; index++) {
  const descriptor = descriptors[index], config = options[index], emitted = [];
  assert.equal(config.variable, descriptor.variable); assert.equal(config.display, 'swap'); assert.equal(config.weight, '400 800'); assert.equal(config.style, 'normal');
  const result = await fontLoader({ functionName: '', variableName: `font${index}`, data: [config], resolve: async filename => path.resolve(path.dirname(layout), filename), loaderContext: { fs }, emitFontFile(bytes,extension,preload) { emitted.push({bytes,extension,preload}); return `/_next/static/media/font${index}.${extension}`; } });
  assert.equal(emitted.length, 1); assert.equal(emitted[0].extension, 'woff2'); assert.equal(emitted[0].bytes.length, descriptor.bytes); assert.equal(emitted[0].preload, true);
  assert.equal(result.variable, descriptor.variable); assert.match(result.css, /font-display: swap/); assert.match(result.css, /font-weight: 400 800/); assert.match(result.css, /font-style: normal/); assert.ok(!result.css.includes('https://')); assert.ok(result.adjustFontFallback.sizeAdjust);
 }
});

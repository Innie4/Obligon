const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/station-fuels.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
test('catalog fuel aliases match partner station names without conflating fuels', () => {
  const normalize = exportsObject.stationFuelName;
  assert.equal(normalize('PMS Petrol'), normalize('Petrol'));
  assert.equal(normalize(' pms '), normalize('unleaded'));
  assert.equal(normalize('AGO Diesel'), normalize('Diesel'));
  assert.equal(normalize('LPG Gas'), normalize('LPG'));
  assert.notEqual(normalize('Diesel'), normalize('Petrol'));
  assert.equal(normalize('CNG'), 'CNG');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { NIGERIA_STATES, NIGERIA_LOCATIONS } = require('../../../packages/shared/nigeria-locations.mjs');
const { NIGERIA_CITIES, isNigeriaCity, nigeriaCityLabel, parseNigeriaCityLabel } = require('../../../packages/shared/nigeria-cities.mjs');
const provenance = require('../../../packages/shared/nigeria-cities.sources.json');

test('the populated-place snapshot covers all existing State/FCT keys and preserves recorded counts', () => {
  assert.deepEqual(Object.keys(NIGERIA_CITIES), NIGERIA_STATES);
  assert.equal(Object.values(NIGERIA_CITIES).flat().length, 52320);
  assert.equal(provenance.transformation.deduplicatedNames, 52320);
  for (const [state, cities] of Object.entries(NIGERIA_CITIES)) {
    assert.equal(cities.length, provenance.transformation.countsByState[state], state);
    assert.ok(cities.length > 0, `${state} must have populated places`);
  }
});

test('place names are NFC strings with no case duplicates, and the catalog is immutable', () => {
  assert.equal(Object.isFrozen(NIGERIA_CITIES), true);
  for (const [state, cities] of Object.entries(NIGERIA_CITIES)) {
    assert.equal(Object.isFrozen(cities), true, state);
    assert.equal(new Set(cities.map(city => city.toLowerCase())).size, cities.length, state);
    for (const city of cities) {
      assert.equal(typeof city, 'string');
      assert.equal(city.trim(), city);
      assert.equal(city.normalize('NFC'), city);
      assert.ok(city.length > 0 && city.length <= 200);
      assert.equal(isNigeriaCity(state, city), true);
    }
  }
});

test('city choices contain actual populated places rather than renamed administrative areas', () => {
  for (const [state, city] of [['Lagos', 'Lagos'], ['Lagos', 'Ikeja'], ['Akwa Ibom', 'Uyo'], ['Akwa Ibom', 'Ikot Ekpene'], ['Federal Capital Territory', 'Abuja'], ['Rivers', 'Port Harcourt'], ['Kano', 'Kano']]) {
    assert.equal(isNigeriaCity(state, city), true, `${city}, ${state}`);
  }
  assert.equal(NIGERIA_LOCATIONS.Lagos.includes('Lagos'), false);
  assert.equal(NIGERIA_LOCATIONS['Federal Capital Territory'].includes('Abuja'), false);
  assert.ok(NIGERIA_CITIES.Lagos.length > NIGERIA_LOCATIONS.Lagos.length);
  assert.equal(isNigeriaCity('Lagos', 'Uyo'), false);
  assert.equal(isNigeriaCity('Federal Capital Territory', 'Port Harcourt'), false);
});

test('canonical city validation and bounded labels reject invented, prototype and non-string inputs', () => {
  for (const [state, city] of [['Lagos', 'Imaginary Example City'], ['Unknown State', 'Lagos'], ['constructor', 'name'], ['__proto__', 'toString'], ['Lagos', ['Lagos']], ['Lagos', {}], [null, 'Lagos'], ['Lagos', null], ['lagos', 'Lagos'], ['Lagos', 'lagos']]) {
    assert.equal(isNigeriaCity(state, city), false);
    assert.equal(nigeriaCityLabel(state, city), null);
  }
  assert.equal(nigeriaCityLabel('Lagos', 'Lagos'), 'Lagos, Lagos');
  assert.equal(nigeriaCityLabel('Federal Capital Territory', 'Abuja'), 'Abuja, Federal Capital Territory');
});

test('every combined city/state label round-trips within the established 100-character storage bound', () => {
  for (const [state, cities] of Object.entries(NIGERIA_CITIES)) {
    for (const city of cities) {
      const label = nigeriaCityLabel(state, city);
      assert.equal(label, `${city}, ${state}`);
      assert.ok(label.length <= 100, label);
      assert.deepEqual(parseNigeriaCityLabel(label), { state, city });
    }
  }
});

test('a city name containing commas is parsed by its known State suffix without truncation', () => {
  const city = NIGERIA_CITIES.Imo.find(name => name.includes(','));
  assert.ok(city, 'The snapshot contains an upstream comma-bearing populated-place name');
  assert.deepEqual(parseNigeriaCityLabel(nigeriaCityLabel('Imo', city)), { state: 'Imo', city });
});

test('unique legacy city-only values resolve to the recorded state while ambiguous names are never guessed', () => {
  assert.deepEqual(parseNigeriaCityLabel('Lagos'), { state: 'Lagos', city: 'Lagos' });
  assert.deepEqual(parseNigeriaCityLabel('Uyo'), { state: 'Akwa Ibom', city: 'Uyo' });
  const statesWithKano = Object.entries(NIGERIA_CITIES).filter(([, cities]) => cities.some(city => city.toLowerCase() === 'kano'));
  assert.ok(statesWithKano.length > 1);
  assert.equal(parseNigeriaCityLabel('Kano'), null);
  assert.deepEqual(parseNigeriaCityLabel('Kano, Kano'), { state: 'Kano', city: 'Kano' });
});

test('parsing rejects malformed, cross-state, oversized and unknown values without coercion', () => {
  for (const value of [null, undefined, 0, [], {}, '', 'Imaginary Example City', 'Lagos, Akwa Ibom', 'Uyo, Lagos', 'Lagos, Unknown State', 'constructor', 'x'.repeat(101)]) {
    assert.equal(parseNigeriaCityLabel(value), null);
  }
});

test('provenance binds the exact transformed catalog and discloses licensed source coverage limits', () => {
  const digest = crypto.createHash('sha256').update(JSON.stringify(NIGERIA_CITIES)).digest('hex');
  assert.equal(digest, provenance.transformation.catalogSha256);
  assert.equal(provenance.license.identifier, 'CC-BY-4.0');
  assert.equal(provenance.license.url, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(provenance.transformation.unmappedCurrentPlaceRecords, 310);
  assert.equal(provenance.transformation.mappedCurrentPlaceRecords, 61041);
  assert.equal(provenance.transformation.excludedNonCurrentPopulatedPlaceRecords, 78);
  assert.match(provenance.coverage.limitations, /completeness/i);
  assert.match(provenance.coverage.description, /villages/i);
  for (const source of provenance.sources) {
    assert.match(source.url, /^https:\/\/(download\.geonames\.org|www\.geonames\.org)\//);
    if (source.sha256) assert.match(source.sha256, /^[a-f0-9]{64}$/);
  }
  assert.match(fs.readFileSync(require.resolve('../../../packages/shared/nigeria-cities.mjs'), 'utf8'), /GeoNames.*CC-BY-4\.0/);
});

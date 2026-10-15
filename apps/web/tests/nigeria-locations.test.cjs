const test = require('node:test');
const assert = require('node:assert/strict');
const { NIGERIA_LOCATIONS, NIGERIA_STATES, isNigeriaLocation, nigeriaLocationLabel } = require('../../../packages/shared/nigeria-locations.mjs');

// Counts independently checked against INEC's State Offices directory.
const counts = { Abia:17, Adamawa:21, 'Akwa Ibom':31, Anambra:21, Bauchi:20, Bayelsa:8, Benue:23, Borno:27, 'Cross River':18, Delta:25, Ebonyi:13, Edo:18, Ekiti:16, Enugu:17, 'Federal Capital Territory':6, Gombe:11, Imo:27, Jigawa:27, Kaduna:23, Kano:44, Katsina:34, Kebbi:21, Kogi:21, Kwara:16, Lagos:20, Nasarawa:13, Niger:25, Ogun:20, Ondo:18, Osun:30, Oyo:33, Plateau:17, Rivers:23, Sokoto:23, Taraba:16, Yobe:17, Zamfara:14 };

test('the official catalog covers every State/FCT and all 774 distinct administrative pairs', () => {
  assert.deepEqual(NIGERIA_STATES, Object.keys(counts));
  assert.equal(Object.values(NIGERIA_LOCATIONS).flat().length, 774);
  for (const [state, expected] of Object.entries(counts)) {
    assert.equal(NIGERIA_LOCATIONS[state].length, expected, state);
    assert.equal(new Set(NIGERIA_LOCATIONS[state]).size, expected, `${state}: no duplicate areas`);
    for (const area of NIGERIA_LOCATIONS[state]) {
      assert.equal(isNigeriaLocation(state, area), true);
      assert.equal(nigeriaLocationLabel(state, area), `${area}, ${state}`);
    }
  }
});

test('finite pair validation rejects unknown and cross-state areas without coercing user input', () => {
  for (const pair of [['Lagos','Uyo'],['Akwa Ibom','Ikeja'],['Atlantis','Ikeja'],['Lagos','Imaginary City'],['constructor','name'],['__proto__','toString'],[null,'Ikeja'],['Lagos',{}],['lagos','ikeja'],['Lagos',['Ikeja']]]) {
    assert.equal(isNigeriaLocation(...pair), false);
    assert.equal(nigeriaLocationLabel(...pair), null);
  }
});

test('official source transcription repairs preserve missing and wrapped administrative names', () => {
  for (const pair of [['Kebbi','Arewa-Dandi'],['Kano','Sumaila'],['Abia','Umu-Neochi'],['Federal Capital Territory','Abuja Municipal'],['Gombe','Yamaltu-Deba'],['Nasarawa','Nasarawa Eggon']]) assert.equal(isNigeriaLocation(...pair), true);
  assert.equal(isNigeriaLocation('Kano','Dj'), false);
  assert.equal(isNigeriaLocation('Abia','State Headquarters'), false);
  assert.equal(Object.isFrozen(NIGERIA_LOCATIONS), true);
  assert.equal(Object.isFrozen(NIGERIA_STATES), true);
  assert.equal(Object.isFrozen(NIGERIA_LOCATIONS.Lagos), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogEntitlements, subscriptionIsActive, customerFeatureIncluded } from '../src/lib/subscriptions.js';
test('paid periods expire and future/trial/cancelled periods cannot unlock partner access', () => {
 const now = new Date('2026-10-10T00:00:00Z');
 assert.equal(subscriptionIsActive({status:'active',current_period_start:'2026-10-01',current_period_end:'2026-11-01'}, now), true);
 for (const status of ['trialing','canceled','past_due']) assert.equal(subscriptionIsActive({status,current_period_start:'2026-10-01',current_period_end:'2026-11-01'}, now), false);
 assert.equal(subscriptionIsActive({status:'active',current_period_start:'2026-10-01',current_period_end:now}, now), false);
 assert.equal(subscriptionIsActive({status:'active',current_period_start:'2026-11-01',current_period_end:'2026-12-01'}, now), false);
});
test('customer catalogue features fail closed for absent, malformed and excluded entries', () => {
 for (const features of [null, {}, [], [null], ['Fuel Purchase'], [{label:'Fuel Purchase'}], [{label:'Fuel Purchase',state:'unavailable'}], [{label:'Fuel Purchase',state:'included',included:false}], [{label:'Fuel Purchase',state:'included',value:false}], [{label:'Fuel Purchase',value:'Not included'}]]) {
  assert.equal(customerFeatureIncluded(features, 'Fuel Purchase'), false, JSON.stringify(features));
 }
 for (const state of ['included','Advanced','Premium','30%','Full approved station discount']) assert.equal(customerFeatureIncluded([{label:'Fuel Purchase',state}], 'fuel purchase'), true);
 assert.equal(customerFeatureIncluded([{name:'Fuel Purchase',value:true}], 'Fuel Purchase'), true);
});
test('catalog features define actual limits, not user supplied entitlements', () => {
 assert.deepEqual(catalogEntitlements(['Up to 5 vehicles','5 fuel cards','Basic reporting','Email support']), {vehicles:5,cards:5,advancedReports:false,apiAccess:false,prioritySupport:false});
 assert.deepEqual(catalogEntitlements(['Unlimited vehicles','Unlimited cards','Advanced analytics','API access','Priority support']), {vehicles:null,cards:null,advancedReports:true,apiAccess:true,prioritySupport:true});
});

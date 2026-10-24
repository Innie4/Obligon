import assert from 'node:assert/strict';
import { test } from 'node:test';
import { personalFuelAlerts } from '../src/lib/personal-fuel-alerts.js';

test('personal fuel alerts use the card owner while company sales never trigger personal budget alerts',async()=>{
 const called=[];const generate=async userId=>{called.push(userId);return {generated:1};};
 assert.equal((await personalFuelAlerts({userId:'personal-owner',organizationId:null},generate)).generated,1);
 assert.equal((await personalFuelAlerts({userId:'fleet-owner',organizationId:'company'},generate)).reason,'not_personal');
 assert.deepEqual(called,['personal-owner']);
});
test('failed informational alert generation cannot reject an already committed fuel purchase',async()=>{
 const result=await personalFuelAlerts({userId:'personal-owner'},async()=>{throw new Error('Isolated outbox transaction unavailable');});
 assert.equal(result.generated,0);assert.equal(result.reason,'retry_on_next_purchase_or_overview');
});

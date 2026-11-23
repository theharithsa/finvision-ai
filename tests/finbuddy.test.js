import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectionBridge } from '../src/firebase/finbuddy.js';

test('individual projection and handoff are private, refreshable and fail closed', async t => {
  const projection = { adopted: true, revision: 2, goals: [{ id: 'owner' }], activeSavings: [{ id: 'instruction' }] };
  let result = projection;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/v1/finvision/projection');
    assert.equal(options.credentials, 'omit');
    return Response.json(result);
  });
  const b = projectionBridge(() => {});
  const user = { getIdToken: async () => 'synthetic' };
  const legacy = { goals: [], activeSavings: [] };
  await b.switchUser(user);
  assert.deepEqual(b.individual(legacy).goals, projection.goals);
  assert.deepEqual(legacy.goals, []);
  assert.deepEqual(b.legacyFields([], [], 91), {});
  result = { ...projection, goals: [{id:'updated'}] };
  await b.refresh();
  assert.equal(b.individual(legacy).goals[0].id, 'updated');
  result = {};
  await b.refresh();
  assert.equal(b.status, 'unavailable');
  assert.deepEqual(b.legacyFields([], [], 91), {});
  await b.switchUser(null);
  assert.equal(b.projection, null);
});

test('an in-flight request cannot cross account switches', async t => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  t.mock.method(globalThis, 'fetch', async () => pending);
  const bridge = projectionBridge(() => {});
  const old = bridge.switchUser({ getIdToken: async () => 'synthetic' });
  await bridge.switchUser(null);
  finish(Response.json({ adopted:true, goals:[{id:'old'}], activeSavings:[] }));
  await old;
  assert.equal(bridge.status, 'local');
  assert.equal(bridge.projection, null);
});

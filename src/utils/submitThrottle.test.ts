import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubmitThrottle, createStoreMutationGuard } from './submitThrottle';

test('createSubmitThrottle blocks concurrent double-clicks synchronously', async () => {
  let clock = 1000;
  const throttle = createSubmitThrottle({ cooldownMs: 600, now: () => clock });
  let executions = 0;

  let resolveFirst!: (val: string) => void;
  const firstPromise = throttle.run(
    () =>
      new Promise<string>((resolve) => {
        executions += 1;
        resolveFirst = resolve;
      })
  );

  assert.equal(throttle.isLocked(), true);

  // Instant second click while first is still in flight
  const secondResult = await throttle.run(async () => {
    executions += 1;
    return 'second';
  });

  assert.deepEqual(secondResult, { executed: false });
  assert.equal(executions, 1);

  resolveFirst('first-ok');
  const firstResult = await firstPromise;
  assert.deepEqual(firstResult, { executed: true, value: 'first-ok' });

  // Immediately after completion, still within 600ms cooldown
  clock = 1300;
  assert.equal(throttle.isLocked(), true);
  const thirdResult = await throttle.run(async () => {
    executions += 1;
    return 'third';
  });
  assert.deepEqual(thirdResult, { executed: false });
  assert.equal(executions, 1);

  // After cooldown expires, new submission works
  clock = 1700;
  assert.equal(throttle.isLocked(), false);
  const fourthResult = await throttle.run(async () => {
    executions += 1;
    return 'fourth-ok';
  });
  assert.deepEqual(fourthResult, { executed: true, value: 'fourth-ok' });
  assert.equal(executions, 2);
});

test('createSubmitThrottle unlocks immediately on error so user can retry', async () => {
  let clock = 5000;
  const throttle = createSubmitThrottle({ cooldownMs: 600, now: () => clock });
  let attempts = 0;

  await assert.rejects(
    throttle.run(async () => {
      attempts += 1;
      throw new Error('Network timeout');
    }),
    /Network timeout/
  );

  assert.equal(throttle.isLocked(), false);

  const retry = await throttle.run(async () => {
    attempts += 1;
    return 42;
  });
  assert.deepEqual(retry, { executed: true, value: 42 });
  assert.equal(attempts, 2);
});

test('createStoreMutationGuard deduplicates in-flight and rapid identical payloads', async () => {
  let clock = 10000;
  const guard = createStoreMutationGuard({ duplicateCooldownMs: 1500, now: () => clock });
  let apiCalls = 0;
  let releaseApi!: (val: { id: number }) => void;

  const p1 = guard.run('createWholesaleSale', { shopId: 1, pieces: 100, amount: 180000 }, () => {
    apiCalls += 1;
    return new Promise<{ id: number }>((resolve) => {
      releaseApi = resolve;
    });
  });

  assert.equal(guard.isInFlight('createWholesaleSale'), true);

  // Concurrent call while first is in flight returns same promise without calling task again
  const p2 = guard.run('createWholesaleSale', { shopId: 1, pieces: 100, amount: 180000 }, async () => {
    apiCalls += 1;
    return { id: 999 };
  });

  releaseApi({ id: 101 });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.deepEqual(r1, { id: 101 });
  assert.deepEqual(r2, { id: 101 });
  assert.equal(apiCalls, 1);
  assert.equal(guard.isInFlight('createWholesaleSale'), false);

  // Rapid identical retry within 1500ms returns cached result without hitting API again
  clock = 10400;
  const r3 = await guard.run(
    'createWholesaleSale',
    { shopId: 1, pieces: 100, amount: 180000 },
    async () => {
      apiCalls += 1;
      return { id: 102 };
    }
  );
  assert.deepEqual(r3, { id: 101 });
  assert.equal(apiCalls, 1);

  // Different payload immediately after completion is allowed
  const r4 = await guard.run(
    'createWholesaleSale',
    { shopId: 2, pieces: 50, amount: 90000 },
    async () => {
      apiCalls += 1;
      return { id: 103 };
    }
  );
  assert.deepEqual(r4, { id: 103 });
  assert.equal(apiCalls, 2);

  // Same payload after cooldown expires is allowed
  clock = 12000;
  const r5 = await guard.run(
    'createWholesaleSale',
    { shopId: 1, pieces: 100, amount: 180000 },
    async () => {
      apiCalls += 1;
      return { id: 104 };
    }
  );
  assert.deepEqual(r5, { id: 104 });
  assert.equal(apiCalls, 3);
});

test('createStoreMutationGuard allows retry immediately when a mutation fails', async () => {
  let clock = 20000;
  const guard = createStoreMutationGuard({ duplicateCooldownMs: 1500, now: () => clock });
  let calls = 0;

  await assert.rejects(
    guard.run('createPurchase', { supplierId: 1, amount: 500000 }, async () => {
      calls += 1;
      throw new Error('DB error');
    }),
    /DB error/
  );

  assert.equal(guard.isInFlight('createPurchase'), false);

  const ok = await guard.run('createPurchase', { supplierId: 1, amount: 500000 }, async () => {
    calls += 1;
    return { id: 77 };
  });
  assert.deepEqual(ok, { id: 77 });
  assert.equal(calls, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSixMonthDemoDataset } from './demoData';
import { getLocalPakistanDate, shiftPakistanDate } from './syncCalculations';

test('buildSixMonthDemoDataset spans ~6 months up to live PKT today', () => {
  const fixedNow = new Date('2026-11-15T10:00:00Z');
  const todayPkt = getLocalPakistanDate(fixedNow);
  const expectedStart = shiftPakistanDate(fixedNow, -175);

  const ds = buildSixMonthDemoDataset(fixedNow);
  assert.equal(ds.endDate, todayPkt);
  assert.equal(ds.startDate, expectedStart);

  // Covers multiple months + today + yesterday
  assert.ok(ds.purchaseLoads.length >= 18);
  assert.ok(ds.sales.length >= 60);
  assert.ok(ds.sales.some((s) => s.saleDate === todayPkt));
  assert.ok(ds.sales.some((s) => s.saleDate === shiftPakistanDate(fixedNow, -1)));
  assert.ok(ds.sales.some((s) => s.saleType === 'OWN_SHOP'));
  assert.ok(ds.sales.some((s) => s.saleType === 'WHOLESALE'));
  assert.ok(ds.purchaseLoads.some((l) => l.status === 'PENDING_RECEIVING' && l.purchaseDate === todayPkt));
});

test('buildSixMonthDemoDataset maintains strict FIFO batch stock conservation', () => {
  const ds = buildSixMonthDemoDataset(new Date('2026-11-15T10:00:00Z'));

  const batchMap = new Map(
    ds.purchaseLoads
      .filter((l) => l.batch)
      .map((l) => [l.batch!.key, l.batch!])
  );

  // Sum of sale items per batch must equal batch.soldPieces
  const soldByBatch: Record<string, number> = {};
  for (const sale of ds.sales) {
    assert.ok(sale.items.length > 0);
    for (const item of sale.items) {
      soldByBatch[item.batchKey] = (soldByBatch[item.batchKey] || 0) + item.quantity;
    }
  }

  let totalRemaining = 0;
  for (const [key, batch] of batchMap.entries()) {
    const sold = soldByBatch[key] || 0;
    assert.equal(batch.soldPieces, sold);
    assert.equal(batch.soldPieces + batch.remainingPieces, batch.originalSaleablePieces);
    assert.ok(batch.remainingPieces >= 0);
    assert.equal(batch.isClosed, batch.remainingPieces === 0);
    totalRemaining += batch.remainingPieces;
  }

  // Healthy active inventory available right away in Demo mode
  assert.ok(totalRemaining >= 500, `Expected healthy remaining birds, got ${totalRemaining}`);
});

test('buildSixMonthDemoDataset shifts dynamically when baseDate changes', () => {
  const dateA = new Date('2026-06-01T12:00:00Z');
  const dateB = new Date('2027-02-10T12:00:00Z');

  const dsA = buildSixMonthDemoDataset(dateA);
  const dsB = buildSixMonthDemoDataset(dateB);

  assert.equal(dsA.endDate, getLocalPakistanDate(dateA));
  assert.equal(dsB.endDate, getLocalPakistanDate(dateB));
  assert.notEqual(dsA.startDate, dsB.startDate);
  assert.ok(dsB.sales.every((s) => s.saleDate <= dsB.endDate && s.saleDate >= dsB.startDate));
});

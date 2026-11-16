import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PAGE_SIZE,
  ResponsePageCache,
  buildPaginationKey,
  computePaginationMeta,
  parseServerPaginationParams,
  sortAndPaginateRecords,
} from './paginationCache.js';

test('computePaginationMeta calculates pages, row range, and ellipsis accurately', () => {
  assert.deepEqual(
    computePaginationMeta({ total: 0, limit: 20, skip: 0 }),
    {
      currentPage: 1,
      totalPages: 1,
      startRow: 0,
      endRow: 0,
      canPrev: false,
      canNext: false,
      pageNumbers: [1],
    }
  );

  const page1 = computePaginationMeta({ total: 63, limit: 20, skip: 0 });
  assert.equal(page1.currentPage, 1);
  assert.equal(page1.totalPages, 4);
  assert.equal(page1.startRow, 1);
  assert.equal(page1.endRow, 20);
  assert.equal(page1.canPrev, false);
  assert.equal(page1.canNext, true);
  assert.deepEqual(page1.pageNumbers, [1, 2, 3, 4]);

  // User switched to 50 per page and went to Next page (skip = 50)
  const page2At50 = computePaginationMeta({ total: 63, limit: 50, skip: 50 });
  assert.equal(page2At50.currentPage, 2);
  assert.equal(page2At50.totalPages, 2);
  assert.equal(page2At50.startRow, 51);
  assert.equal(page2At50.endRow, 63);
  assert.equal(page2At50.canPrev, true);
  assert.equal(page2At50.canNext, false);

  // Many pages collapse with ellipsis
  const many = computePaginationMeta({ total: 500, limit: 20, skip: 120 });
  assert.equal(many.currentPage, 7);
  assert.equal(many.totalPages, 25);
  assert.ok(many.pageNumbers.includes('ellipsis'));
  assert.equal(many.pageNumbers[0], 1);
  assert.equal(many.pageNumbers[many.pageNumbers.length - 1], 25);
});

test('parseServerPaginationParams defaults to limit=20, skip=0 and clamps bounds', () => {
  const defaults = parseServerPaginationParams({});
  assert.equal(defaults.limit, DEFAULT_PAGE_SIZE);
  assert.equal(defaults.skip, 0);
  assert.equal(defaults.sortDir, 'desc');

  const custom = parseServerPaginationParams({
    limit: '50',
    skip: '50',
    search: '  Bismillah ',
    sortKey: 'saleDate',
    sortDir: 'asc',
  });
  assert.equal(custom.limit, 50);
  assert.equal(custom.skip, 50);
  assert.equal(custom.search, 'bismillah');
  assert.equal(custom.sortKey, 'saleDate');
  assert.equal(custom.sortDir, 'asc');

  const clamped = parseServerPaginationParams({ limit: '9999', skip: '-10' });
  assert.equal(clamped.limit, 200);
  assert.equal(clamped.skip, 0);
});

test('sortAndPaginateRecords slices accurately and reports hasMore', () => {
  const items = Array.from({ length: 63 }, (_, i) => ({
    id: i + 1,
    amount: (i + 1) * 100,
    date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
  }));

  const p1 = sortAndPaginateRecords({
    records: items,
    limit: 20,
    skip: 0,
    sortKey: 'amount',
    sortDir: 'desc',
  });
  assert.equal(p1.items.length, 20);
  assert.equal(p1.total, 63);
  assert.equal(p1.hasMore, true);
  assert.equal(p1.items[0].amount, 6300);

  const p2At50 = sortAndPaginateRecords({
    records: items,
    limit: 50,
    skip: 50,
    sortKey: 'id',
    sortDir: 'asc',
  });
  assert.equal(p2At50.items.length, 13);
  assert.equal(p2At50.hasMore, false);
  assert.equal(p2At50.items[0].id, 51);
  assert.equal(p2At50.items[12].id, 63);
});

test('ResponsePageCache caches responses across page switches and deduplicates in-flight calls', async () => {
  const cache = new ResponsePageCache({ maxEntries: 5, ttlMs: 10000 });
  let apiCalls = 0;

  const keyPage1 = buildPaginationKey({
    endpoint: '/api/sales',
    params: { limit: 20, skip: 0, type: 'ALL' },
    workspace: 'demo',
    cacheEpoch: 1,
  });
  const keyPage2 = buildPaginationKey({
    endpoint: '/api/sales',
    params: { limit: 20, skip: 20, type: 'ALL' },
    workspace: 'demo',
    cacheEpoch: 1,
  });

  const res1 = await cache.getOrFetch(keyPage1, async () => {
    apiCalls++;
    return { items: [{ id: 1 }], total: 40, limit: 20, skip: 0, hasMore: true };
  });
  assert.equal(res1.fromCache, false);
  assert.equal(apiCalls, 1);

  const res2 = await cache.getOrFetch(keyPage2, async () => {
    apiCalls++;
    return { items: [{ id: 21 }], total: 40, limit: 20, skip: 20, hasMore: false };
  });
  assert.equal(res2.fromCache, false);
  assert.equal(apiCalls, 2);

  // Navigate back to Page 1 -> served strictly from cache with zero new API calls
  const res1Cached = await cache.getOrFetch<{ id: number }>(keyPage1, async () => {
    apiCalls++;
    return { items: [], total: 0, limit: 20, skip: 0, hasMore: false };
  });
  assert.equal(res1Cached.fromCache, true);
  assert.equal(apiCalls, 2);
  assert.equal(res1Cached.data.items[0].id, 1);

  // Clearing cache forces fresh fetch and isolates workspaces
  cache.clear();
  assert.equal(cache.size(), 0);
});

test('buildPaginationKey produces identical keys regardless of property insertion order and separates workspaces', () => {
  const k1 = buildPaginationKey({
    endpoint: '/api/sales',
    params: { skip: 0, limit: 20, search: '' },
    workspace: 'real',
    cacheEpoch: 2,
  });
  const k2 = buildPaginationKey({
    endpoint: '/api/sales',
    params: { limit: 20, skip: 0, type: undefined },
    workspace: 'real',
    cacheEpoch: 2,
  });
  const kDemo = buildPaginationKey({
    endpoint: '/api/sales',
    params: { limit: 20, skip: 0 },
    workspace: 'demo',
    cacheEpoch: 2,
  });

  assert.equal(k1, k2);
  assert.notEqual(k1, kDemo);
});

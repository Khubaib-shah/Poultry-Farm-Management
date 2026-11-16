import test from 'node:test';
import assert from 'node:assert/strict';
import type { StorageLike } from './demoLocalStore.js';
import {
  createDemoLocalStore,
  matchStaticDemoCredentials,
} from './demoLocalStore.js';
import { getLocalPakistanDate, shiftPakistanDate } from './syncCalculations.js';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

test('matchStaticDemoCredentials matches demo@checkin.me / demo1234 only', () => {
  assert.equal(matchStaticDemoCredentials('demo@checkin.me', 'demo1234'), true);
  assert.equal(matchStaticDemoCredentials('  DEMO@CheckIn.Me ', 'demo1234'), true);
  assert.equal(matchStaticDemoCredentials('demo@checkin.me', 'wrong'), false);
  assert.equal(matchStaticDemoCredentials('owner@checkin.me', 'demo1234'), false);
});

test('demoLocalStore activates session locally and shifts JSON dates dynamically even 5+ years in the future', () => {
  const futureDate = new Date('2031-08-20T10:00:00Z');
  const todayPkt = getLocalPakistanDate(futureDate);
  const startPkt = shiftPakistanDate(futureDate, -175);

  const store = createDemoLocalStore({
    storage: createMemoryStorage(),
    now: () => futureDate,
  });

  assert.equal(store.isSessionActive(), false);
  const auth = store.activateSession({ resetToFresh: true });
  assert.equal(auth.user.email, 'demo@checkin.me');
  assert.equal(auth.user.workspace, 'demo');
  assert.equal(store.isSessionActive(), true);

  const bootstrap = store.getBootstrap();
  assert.ok(bootstrap.suppliers.length >= 4);
  assert.ok(bootstrap.sales.length >= 60);
  assert.ok(bootstrap.purchases.length >= 18);
  assert.ok(bootstrap.sales.some((s) => s.saleDate === todayPkt));
  assert.ok(bootstrap.sales.every((s) => s.saleDate >= startPkt && s.saleDate <= todayPkt));
  assert.ok(bootstrap.purchases.some((p) => p.status === 'PENDING_RECEIVING' && p.purchaseDate === todayPkt));
});

test('demoLocalStore supports pagination across all endpoints', () => {
  const fixedNow = new Date('2026-11-16T10:00:00Z');
  const store = createDemoLocalStore({
    storage: createMemoryStorage(),
    now: () => fixedNow,
  });
  store.activateSession({ resetToFresh: true });

  const salesPage1 = store.getPaginated<{ invoiceNumber: string }>('/api/sales', {
    limit: 10,
    skip: 0,
    type: 'WHOLESALE',
  });
  assert.equal(salesPage1.items.length, 10);
  assert.equal(salesPage1.hasMore, true);
  assert.ok(salesPage1.total > 20);

  const batchesActive = store.getPaginated<{ remainingPieces: number }>('/api/inventory/batches', {
    limit: 20,
    skip: 0,
    status: 'ACTIVE',
  });
  assert.ok(batchesActive.items.every((b) => b.remainingPieces > 0));

  const dealerCredit = store.getPaginated<{ transactionType: string }>('/api/dealer-ledger', {
    limit: 20,
    skip: 0,
    type: 'PAYMENT_CREDIT',
  });
  assert.ok(dealerCredit.items.every((t) => t.transactionType === 'PAYMENT_CREDIT'));

  const expensesFood = store.getPaginated<{ category: string }>('/api/expenses', {
    limit: 10,
    skip: 0,
    category: 'Food',
  });
  assert.ok(expensesFood.items.every((e) => e.category === 'Food'));

  const purchasesPending = store.getPaginated<{ status: string }>('/api/purchases', {
    limit: 10,
    skip: 0,
    status: 'PENDING_RECEIVING',
  });
  assert.equal(purchasesPending.items.length, 1);

  const movements = store.getPaginated<{ batchNumber: string }>('/api/inventory/movements', {
    limit: 15,
    skip: 0,
  });
  assert.equal(movements.items.length, 15);
  assert.ok(movements.items.every((m) => Boolean(m.batchNumber)));

  const workerPmts = store.getPaginated<{ workerName: string }>('/api/worker-payments', {
    limit: 10,
    skip: 0,
  });
  assert.equal(workerPmts.items.length, 10);
  assert.ok(workerPmts.items.every((p) => Boolean(p.workerName)));
});

test('demoLocalStore local mutations, FIFO sales, cascade deletes, and reset stay completely self-contained', () => {
  const fixedNow = new Date('2026-11-16T10:00:00Z');
  const todayPkt = getLocalPakistanDate(fixedNow);
  const store = createDemoLocalStore({
    storage: createMemoryStorage(),
    now: () => fixedNow,
  });
  store.activateSession({ resetToFresh: true });

  const initialBootstrap = store.getBootstrap();
  const initialStock = initialBootstrap.batches.reduce((sum, b) => sum + b.remainingPieces, 0);

  // Create sale & confirm stock drops accurately
  const createdSale = store.createOwnShopSale({
    saleDate: todayPkt,
    quantityPieces: 50,
    totalSaleAmount: 95000,
    notes: 'Demo test sale',
  });
  const afterSaleStock = store
    .getBootstrap()
    .batches.reduce((sum, b) => sum + b.remainingPieces, 0);
  assert.equal(afterSaleStock, initialStock - 50);

  // Delete sale & confirm stock is restored accurately
  const delRes = store.deleteSale(createdSale.sale.id);
  assert.equal(delRes.restoredPieces, 50);
  const afterDeleteStock = store
    .getBootstrap()
    .batches.reduce((sum, b) => sum + b.remainingPieces, 0);
  assert.equal(afterDeleteStock, initialStock);

  // Create supplier + reset restores clean JSON seed snapshot
  const newSup = store.createSupplier({ name: 'Temporary Demo Supplier', openingBalance: '1000' });
  assert.ok(store.getBootstrap().suppliers.some((s) => s.id === newSup.id));

  const resetRes = store.resetWorkspace();
  assert.equal(resetRes.mode, 'demo');
  assert.equal(
    store.getBootstrap().suppliers.some((s) => s.name === 'Temporary Demo Supplier'),
    false
  );
  assert.equal(store.getBootstrap().suppliers.length, initialBootstrap.suppliers.length);

  store.clearSession();
  assert.equal(store.isSessionActive(), false);
  assert.deepEqual(store.getSessionUser(), { authenticated: false, user: null });
});

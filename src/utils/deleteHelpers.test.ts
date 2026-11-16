import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySaleDeletionToBatches,
  recomputeDealerTransactionBalances,
  recalculateSaleAfterBatchRemoval,
  applyMovementDeletionToBatch,
} from './deleteHelpers';

test('applySaleDeletionToBatches restores remainingPieces, decrements soldPieces, and reopens closed batch', () => {
  const batches = [
    { id: 1, remainingPieces: 0, soldPieces: 500, isClosed: true },
    { id: 2, remainingPieces: 120, soldPieces: 80, isClosed: false },
  ];

  const updated = applySaleDeletionToBatches(batches, [
    { stockBatchId: 1, quantity: 45 },
    { stockBatchId: 2, quantity: 15 },
  ]);

  assert.deepEqual(updated[0], { id: 1, remainingPieces: 45, soldPieces: 455, isClosed: false });
  assert.deepEqual(updated[1], { id: 2, remainingPieces: 135, soldPieces: 65, isClosed: false });
});

test('applySaleDeletionToBatches clamps soldPieces at 0 if restoration exceeds soldPieces', () => {
  const batches = [{ id: 10, remainingPieces: 5, soldPieces: 3, isClosed: false }];
  const updated = applySaleDeletionToBatches(batches, [{ stockBatchId: 10, quantity: 10 }]);
  assert.deepEqual(updated[0], { id: 10, remainingPieces: 15, soldPieces: 0, isClosed: false });
});

test('recomputeDealerTransactionBalances maintains running balance with OPENING_BALANCE row', () => {
  const txs = [
    {
      id: 1,
      supplierId: 5,
      debitAmount: '150000.00',
      creditAmount: '0.00',
      balanceAfter: '150000.00',
      referenceType: 'OPENING_BALANCE',
    },
    {
      id: 3,
      supplierId: 5,
      debitAmount: '0.00',
      creditAmount: '200000.00',
      balanceAfter: '950000.00',
      referenceType: 'PAYMENT',
    },
    {
      id: 4,
      supplierId: 5,
      debitAmount: '500000.00',
      creditAmount: '0.00',
      balanceAfter: '1450000.00',
      referenceType: 'PURCHASE_LOAD',
    },
  ];

  // After removing tx id=2 (which was a 1,000,000 purchase), recompute balances
  const { updated, latestBalance } = recomputeDealerTransactionBalances(txs, 150000);
  assert.equal(updated[0].balanceAfter, '150000.00');
  assert.equal(updated[1].balanceAfter, '-50000.00');
  assert.equal(updated[2].balanceAfter, '450000.00');
  assert.equal(latestBalance, 450000);
});

test('recomputeDealerTransactionBalances handles deleting OPENING_BALANCE row cleanly when openingBalance reset to 0', () => {
  const remaining = [
    {
      id: 2,
      supplierId: 5,
      debitAmount: '800000.00',
      creditAmount: '0.00',
      balanceAfter: '950000.00',
      referenceType: 'PURCHASE_LOAD',
    },
    {
      id: 3,
      supplierId: 5,
      debitAmount: '0.00',
      creditAmount: '300000.00',
      balanceAfter: '650000.00',
      referenceType: 'PAYMENT',
    },
  ];

  const { updated, latestBalance } = recomputeDealerTransactionBalances(remaining, 0);
  assert.equal(updated[0].balanceAfter, '800000.00');
  assert.equal(updated[1].balanceAfter, '500000.00');
  assert.equal(latestBalance, 500000);
});

test('recalculateSaleAfterBatchRemoval deletes whole sale when empty and recalculates partial multi-batch sale', () => {
  assert.equal(recalculateSaleAfterBatchRemoval('50000.00', []), null);

  const partial = recalculateSaleAfterBatchRemoval('50000.00', [
    { stockBatchId: 2, quantity: 25, totalCost: '37500.00' },
  ]);
  assert.deepEqual(partial, {
    totalPieces: 25,
    totalCost: '37500.00',
    totalProfit: '12500.00',
    sellingPricePerPiece: '2000.00',
    costPerPiece: '1500.00',
    profitPerPiece: '500.00',
  });
});

test('applyMovementDeletionToBatch reverses damage adjustment and blocks unsafe positive reversal', () => {
  const batch = { id: 1, remainingPieces: 10, soldPieces: 90, isClosed: false };

  const undoDamage = applyMovementDeletionToBatch(batch, -5);
  assert.equal(undoDamage.ok, true);
  if (undoDamage.ok) {
    assert.equal(undoDamage.batch.remainingPieces, 15);
    assert.equal(undoDamage.batch.isClosed, false);
  }

  const undoPositiveOversold = applyMovementDeletionToBatch(batch, 15);
  assert.equal(undoPositiveOversold.ok, false);

  const undoExactRemaining = applyMovementDeletionToBatch(batch, 10);
  assert.equal(undoExactRemaining.ok, true);
  if (undoExactRemaining.ok) {
    assert.equal(undoExactRemaining.batch.remainingPieces, 0);
    assert.equal(undoExactRemaining.batch.isClosed, true);
  }
});

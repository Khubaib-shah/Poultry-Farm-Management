import { calculateSaleMetrics } from './poultryMath';

export interface BatchStockState {
  id: number;
  remainingPieces: number;
  soldPieces: number;
  isClosed: boolean;
}

export interface BatchQuantityRestore {
  stockBatchId: number;
  quantity: number;
}

/**
 * Restores pieces back to stock batches when a sale (or subset of sale items) is deleted.
 * Automatically reopens closed batches if remainingPieces becomes > 0.
 */
export function applySaleDeletionToBatches<T extends BatchStockState>(
  batches: T[],
  restores: BatchQuantityRestore[]
): T[] {
  const restoreMap = new Map<number, number>();
  for (const item of restores) {
    const qty = Math.max(0, Number(item.quantity || 0));
    if (qty > 0) {
      restoreMap.set(item.stockBatchId, (restoreMap.get(item.stockBatchId) || 0) + qty);
    }
  }

  return batches.map((batch) => {
    const addBack = restoreMap.get(batch.id) || 0;
    if (addBack === 0) return batch;
    const nextRemaining = Math.max(0, Number(batch.remainingPieces) + addBack);
    const nextSold = Math.max(0, Number(batch.soldPieces) - addBack);
    return {
      ...batch,
      remainingPieces: nextRemaining,
      soldPieces: nextSold,
      isClosed: nextRemaining <= 0,
    };
  });
}

export interface DealerLedgerLike {
  id: number;
  supplierId: number;
  debitAmount: string | number;
  creditAmount: string | number;
  balanceAfter: string | number;
  referenceType?: string | null;
}

/**
 * Recomputes running balanceAfter chronologically (ascending id) for a supplier's transactions.
 * If remaining transactions already include an OPENING_BALANCE row, starts from 0 so it isn't double-counted.
 * Otherwise starts from supplierOpeningBalance.
 */
export function recomputeDealerTransactionBalances<T extends DealerLedgerLike>(
  transactions: T[],
  supplierOpeningBalance = 0
): { updated: T[]; latestBalance: number } {
  const ordered = [...transactions].sort((a, b) => a.id - b.id);
  const hasOpeningRow = ordered.some((tx) => tx.referenceType === 'OPENING_BALANCE');
  let running = hasOpeningRow ? 0 : Number(supplierOpeningBalance || 0);

  const updated = ordered.map((tx) => {
    const debit = Number(tx.debitAmount || 0);
    const credit = Number(tx.creditAmount || 0);
    running = Number((running + debit - credit).toFixed(2));
    return {
      ...tx,
      balanceAfter: running.toFixed(2),
    };
  });

  return {
    updated,
    latestBalance: running,
  };
}

export interface SaleItemLike {
  stockBatchId: number;
  quantity: number;
  totalCost: string | number;
}

export interface RecalculatedSaleFields {
  totalPieces: number;
  totalCost: string;
  totalProfit: string;
  sellingPricePerPiece: string;
  costPerPiece: string;
  profitPerPiece: string;
}

/**
 * Recalculates a sale's header totals after removing items tied to a deleted stock batch.
 * Returns null if no sale items remain (meaning the whole sale should be deleted).
 */
export function recalculateSaleAfterBatchRemoval(
  saleTotalAmount: string | number,
  remainingItems: SaleItemLike[]
): RecalculatedSaleFields | null {
  if (remainingItems.length === 0) return null;

  const totalPieces = remainingItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if (totalPieces <= 0) return null;

  const totalCostNum = remainingItems.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
  const metrics = calculateSaleMetrics(Number(saleTotalAmount || 0), totalPieces, totalCostNum);

  return {
    totalPieces,
    totalCost: totalCostNum.toFixed(2),
    totalProfit: metrics.totalProfit.toFixed(2),
    sellingPricePerPiece: metrics.sellingPricePerPiece.toFixed(2),
    costPerPiece: metrics.costPerPiece.toFixed(2),
    profitPerPiece: metrics.profitPerPiece.toFixed(2),
  };
}

/**
 * Reverses a manual stock adjustment movement (`quantity` was added to remainingPieces when created).
 * Returns either updated batch counts or an error if undoing a positive adjustment would make stock negative.
 */
export function applyMovementDeletionToBatch<T extends BatchStockState>(
  batch: T,
  movementQuantity: number
): { ok: true; batch: T } | { ok: false; error: string } {
  const nextRemaining = Number(batch.remainingPieces) - Number(movementQuantity);
  if (nextRemaining < 0) {
    return {
      ok: false,
      error: `Cannot delete this stock adjustment because those ${movementQuantity} birds were already sold (remaining stock is ${batch.remainingPieces}).`,
    };
  }
  return {
    ok: true,
    batch: {
      ...batch,
      remainingPieces: nextRemaining,
      isClosed: nextRemaining <= 0,
    },
  };
}

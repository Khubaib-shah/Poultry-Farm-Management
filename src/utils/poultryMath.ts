/**
 * Pure financial and inventory calculation utilities for Poultry Farm Management System
 */

export interface StockBatchCandidate {
  id: number;
  batchNumber: string;
  remainingPieces: number;
  costPerPiece: number;
}

export interface FifoConsumptionResult {
  consumedBatches: Array<{
    batchId: number;
    batchNumber: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
  totalQuantity: number;
  totalCost: number;
  averageCostPerPiece: number;
  remainingShortfall: number;
}

/**
 * Calculates rate per KG for live chicken purchase
 */
export function calculatePurchaseRate(purchaseAmount: number, weightKg: number): number {
  if (weightKg <= 0) return 0;
  return Number((purchaseAmount / weightKg).toFixed(2));
}

/**
 * Calculates actual saleable pieces from stock receiving
 */
export function calculateSaleablePieces(
  receivedPieces: number,
  deadPieces: number = 0,
  damagedPieces: number = 0
): number {
  const saleable = receivedPieces - deadPieces - damagedPieces;
  return Math.max(0, saleable);
}

/**
 * Calculates total landed cost including load transport/expenses
 */
export function calculateLandedCost(
  purchaseAmount: number,
  totalLoadExpenses: number
): number {
  return Number((purchaseAmount + totalLoadExpenses).toFixed(2));
}

/**
 * Calculates cost per saleable piece. Returns 0 if no saleable pieces.
 */
export function calculateCostPerPiece(
  totalLandedCost: number,
  saleablePieces: number
): number {
  if (saleablePieces <= 0) return 0;
  return Number((totalLandedCost / saleablePieces).toFixed(2));
}

/**
 * Calculates profit per piece and total profit for a sale
 */
export function calculateSaleMetrics(
  totalSaleAmount: number,
  quantityPieces: number,
  totalFifoCost: number
): {
  sellingPricePerPiece: number;
  costPerPiece: number;
  profitPerPiece: number;
  totalProfit: number;
  profitMarginPercent: number;
} {
  if (quantityPieces <= 0) {
    return {
      sellingPricePerPiece: 0,
      costPerPiece: 0,
      profitPerPiece: 0,
      totalProfit: 0,
      profitMarginPercent: 0,
    };
  }

  const sellingPricePerPiece = Number((totalSaleAmount / quantityPieces).toFixed(2));
  const costPerPiece = Number((totalFifoCost / quantityPieces).toFixed(2));
  const profitPerPiece = Number((sellingPricePerPiece - costPerPiece).toFixed(2));
  const totalProfit = Number((totalSaleAmount - totalFifoCost).toFixed(2));
  const profitMarginPercent = totalSaleAmount > 0
    ? Number(((totalProfit / totalSaleAmount) * 100).toFixed(2))
    : 0;

  return {
    sellingPricePerPiece,
    costPerPiece,
    profitPerPiece,
    totalProfit,
    profitMarginPercent,
  };
}

/**
 * FIFO Stock Batch Consumption algorithm
 */
export function consumeBatchesFifo(
  batches: StockBatchCandidate[],
  quantityRequested: number
): FifoConsumptionResult {
  let remainingToConsume = quantityRequested;
  let totalCost = 0;
  const consumedBatches: FifoConsumptionResult['consumedBatches'] = [];

  for (const batch of batches) {
    if (remainingToConsume <= 0) break;
    if (batch.remainingPieces <= 0) continue;

    const qtyToTake = Math.min(batch.remainingPieces, remainingToConsume);
    const costForThisBatch = Number((qtyToTake * batch.costPerPiece).toFixed(2));

    consumedBatches.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantity: qtyToTake,
      unitCost: batch.costPerPiece,
      totalCost: costForThisBatch,
    });

    totalCost = Number((totalCost + costForThisBatch).toFixed(2));
    remainingToConsume -= qtyToTake;
  }

  const totalQuantity = quantityRequested - remainingToConsume;
  const averageCostPerPiece = totalQuantity > 0
    ? Number((totalCost / totalQuantity).toFixed(2))
    : 0;

  return {
    consumedBatches,
    totalQuantity,
    totalCost,
    averageCostPerPiece,
    remainingShortfall: remainingToConsume,
  };
}

/**
 * Cost Analysis indicator logic
 */
export function getCostAnalysisStatus(sellingPrice: number, costPerPiece: number): {
  status: 'BELOW_COST' | 'AT_COST' | 'PROFITABLE';
  profitPerPiece: number;
  marginPercent: number;
} {
  const profit = Number((sellingPrice - costPerPiece).toFixed(2));
  const margin = sellingPrice > 0 ? Number(((profit / sellingPrice) * 100).toFixed(2)) : 0;

  let status: 'BELOW_COST' | 'AT_COST' | 'PROFITABLE' = 'PROFITABLE';
  if (profit < 0) {
    status = 'BELOW_COST';
  } else if (profit === 0) {
    status = 'AT_COST';
  }

  return {
    status,
    profitPerPiece: profit,
    marginPercent: margin,
  };
}

/**
 * Profit & Loss Calculation
 */
export function calculatePnl(
  totalRevenue: number,
  cogs: number,
  generalExpenses: number,
  workerPayments: number
): {
  grossProfit: number;
  netProfit: number;
  grossMarginPercent: number;
  netMarginPercent: number;
} {
  const grossProfit = Number((totalRevenue - cogs).toFixed(2));
  const netProfit = Number((grossProfit - generalExpenses - workerPayments).toFixed(2));
  const grossMarginPercent = totalRevenue > 0
    ? Number(((grossProfit / totalRevenue) * 100).toFixed(2))
    : 0;
  const netMarginPercent = totalRevenue > 0
    ? Number(((netProfit / totalRevenue) * 100).toFixed(2))
    : 0;

  return {
    grossProfit,
    netProfit,
    grossMarginPercent,
    netMarginPercent,
  };
}

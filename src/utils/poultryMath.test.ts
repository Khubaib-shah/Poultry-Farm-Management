import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePurchaseRate,
  calculateSaleablePieces,
  calculateLandedCost,
  calculateCostPerPiece,
  calculateSaleMetrics,
  consumeBatchesFifo,
  getCostAnalysisStatus,
  calculatePnl,
} from './poultryMath.ts';

test('calculatePurchaseRate calculates correct PKR per KG', () => {
  assert.equal(calculatePurchaseRate(1500000, 5000), 300);
  assert.equal(calculatePurchaseRate(100000, 350), 285.71);
  assert.equal(calculatePurchaseRate(100000, 0), 0);
});

test('calculateSaleablePieces correctly deducts dead and damaged birds', () => {
  assert.equal(calculateSaleablePieces(1000, 15, 5), 980);
  assert.equal(calculateSaleablePieces(500, 0, 0), 500);
  assert.equal(calculateSaleablePieces(10, 8, 5), 0); // never negative
});

test('calculateLandedCost and calculateCostPerPiece', () => {
  const purchase = 1500000;
  const loadExpenses = 30000; // fuel, transport, loading, driver
  const landed = calculateLandedCost(purchase, loadExpenses);
  assert.equal(landed, 1530000);

  const saleable = 980;
  const costPerPiece = calculateCostPerPiece(landed, saleable);
  assert.equal(costPerPiece, 1561.22);

  // zero pieces protection
  assert.equal(calculateCostPerPiece(landed, 0), 0);
});

test('consumeBatchesFifo consumes oldest batch first and handles multiple batches', () => {
  const batches = [
    { id: 1, batchNumber: 'BATCH-001', remainingPieces: 100, costPerPiece: 1200 },
    { id: 2, batchNumber: 'BATCH-002', remainingPieces: 150, costPerPiece: 1300 },
  ];

  // Request 150 pieces: should take 100 from BATCH-001 and 50 from BATCH-002
  const result = consumeBatchesFifo(batches, 150);
  assert.equal(result.totalQuantity, 150);
  assert.equal(result.remainingShortfall, 0);
  assert.equal(result.consumedBatches.length, 2);
  assert.equal(result.consumedBatches[0].batchId, 1);
  assert.equal(result.consumedBatches[0].quantity, 100);
  assert.equal(result.consumedBatches[0].totalCost, 120000);
  assert.equal(result.consumedBatches[1].batchId, 2);
  assert.equal(result.consumedBatches[1].quantity, 50);
  assert.equal(result.consumedBatches[1].totalCost, 65000);
  assert.equal(result.totalCost, 185000);
  assert.equal(result.averageCostPerPiece, 1233.33);
});

test('consumeBatchesFifo detects shortfall when insufficient stock', () => {
  const batches = [
    { id: 1, batchNumber: 'BATCH-001', remainingPieces: 50, costPerPiece: 1000 },
  ];
  const result = consumeBatchesFifo(batches, 80);
  assert.equal(result.totalQuantity, 50);
  assert.equal(result.remainingShortfall, 30);
});

test('calculateSaleMetrics computes profit per piece and total profit', () => {
  const metrics = calculateSaleMetrics(180000, 100, 140000);
  assert.equal(metrics.sellingPricePerPiece, 1800);
  assert.equal(metrics.costPerPiece, 1400);
  assert.equal(metrics.profitPerPiece, 400);
  assert.equal(metrics.totalProfit, 40000);
  assert.equal(metrics.profitMarginPercent, 22.22);
});

test('getCostAnalysisStatus provides accurate indicator flags', () => {
  assert.equal(getCostAnalysisStatus(1500, 1200).status, 'PROFITABLE');
  assert.equal(getCostAnalysisStatus(1200, 1200).status, 'AT_COST');
  assert.equal(getCostAnalysisStatus(1000, 1200).status, 'BELOW_COST');
});

test('calculatePnl calculates gross and net profit without double counting', () => {
  const pnl = calculatePnl(500000, 350000, 25000, 15000);
  assert.equal(pnl.grossProfit, 150000);
  assert.equal(pnl.netProfit, 110000);
  assert.equal(pnl.grossMarginPercent, 30);
  assert.equal(pnl.netMarginPercent, 22);
});

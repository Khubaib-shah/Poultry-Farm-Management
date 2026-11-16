import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalPakistanDate,
  shiftPakistanDate,
  getPeriodRange,
  computeDashboardFromCollections,
  computeReportFromCollections,
} from './syncCalculations.js';
import { formatPKR, formatSignedPKR } from './formatters.js';
import type {
  Supplier,
  PurchaseLoad,
  StockBatch,
  Sale,
  WorkerPayment,
  BusinessExpense,
  DealerTransaction,
} from '../types/index.js';

const FIXED_DATE = new Date('2026-11-12T10:00:00.000Z'); // 15:00 PKT on 2026-11-12
const NOW_ISO = '2026-11-12T10:00:00.000Z';

test('formatPKR and formatSignedPKR handle positive, zero, and negative values cleanly', () => {
  assert.equal(formatPKR(1250), 'PKR 1,250');
  assert.equal(formatPKR(-840.9), '-PKR 840.9');
  assert.equal(formatSignedPKR(4295.5), '+PKR 4,295.5');
  assert.equal(formatSignedPKR(-840.9), '-PKR 840.9');
  assert.equal(formatSignedPKR(0), 'PKR 0');
});

test('getLocalPakistanDate and getPeriodRange handle all period presets', () => {
  assert.equal(getLocalPakistanDate(FIXED_DATE), '2026-11-12');
  assert.deepEqual(getPeriodRange('today', undefined, undefined, FIXED_DATE), {
    startDate: '2026-11-12',
    endDate: '2026-11-12',
  });
  assert.deepEqual(getPeriodRange('yesterday', undefined, undefined, FIXED_DATE), {
    startDate: '2026-11-11',
    endDate: '2026-11-11',
  });
  assert.deepEqual(getPeriodRange('last7days', undefined, undefined, FIXED_DATE), {
    startDate: '2026-11-06',
    endDate: '2026-11-12',
  });
  assert.deepEqual(getPeriodRange('thismonth', undefined, undefined, FIXED_DATE), {
    startDate: '2026-11-01',
    endDate: '2026-11-12',
  });
  assert.deepEqual(getPeriodRange('custom', '2026-11-01', '2026-11-05', FIXED_DATE), {
    startDate: '2026-11-01',
    endDate: '2026-11-05',
  });
});

function buildSampleCollections() {
  const suppliers: Supplier[] = [
    {
      id: 1,
      name: 'Bismillah Hatchery',
      phone: '0300-1111111',
      address: 'Lahore',
      openingBalance: '100000',
      currentBalance: 250000,
      notes: null,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    },
    {
      id: 2,
      name: 'Al-Rehman Traders',
      phone: '0300-2222222',
      address: 'Gujranwala',
      openingBalance: '0',
      currentBalance: 50000,
      notes: null,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    },
  ];

  const purchases: PurchaseLoad[] = [
    {
      id: 1,
      loadNumber: 'TRK-1001',
      supplierId: 1,
      supplierName: 'Bismillah Hatchery',
      purchaseDate: '2026-11-12',
      vehicleNumber: 'LES-4411',
      driverName: 'Tariq',
      totalWeightKg: '2000',
      purchaseAmount: '600000',
      totalExpenses: 20000,
      totalLandedCost: 620000,
      purchaseRatePerKg: 300,
      status: 'RECEIVED',
      notes: null,
      createdAt: NOW_ISO,
      expenses: [
        {
          id: 11,
          purchaseLoadId: 1,
          category: 'FUEL',
          amount: '12000',
          expenseDate: '2026-11-12',
          description: 'Diesel',
          createdAt: NOW_ISO,
        },
        {
          id: 12,
          purchaseLoadId: 1,
          category: 'DRIVER',
          amount: '8000',
          expenseDate: '2026-11-12',
          description: 'Driver trip pay',
          createdAt: NOW_ISO,
        },
      ],
    },
  ];

  const batches: StockBatch[] = [
    {
      id: 1,
      batchNumber: 'BATCH-1001',
      purchaseLoadId: 1,
      receivingDate: '2026-11-12',
      receivedPieces: 1000,
      deadPieces: 0,
      damagedPieces: 0,
      originalSaleablePieces: 1000,
      soldPieces: 250,
      remainingPieces: 750,
      purchaseAmount: '600000',
      totalLoadExpenses: '20000',
      totalLandedCost: '620000',
      costPerPiece: '620',
      isClosed: false,
      notes: null,
      createdAt: NOW_ISO,
    },
    {
      id: 2,
      batchNumber: 'BATCH-0999',
      purchaseLoadId: 1,
      receivingDate: '2026-11-10',
      receivedPieces: 200,
      deadPieces: 0,
      damagedPieces: 0,
      originalSaleablePieces: 200,
      soldPieces: 120,
      remainingPieces: 80,
      purchaseAmount: '115000',
      totalLoadExpenses: '5000',
      totalLandedCost: '120000',
      costPerPiece: '600',
      isClosed: false,
      notes: null,
      createdAt: NOW_ISO,
    },
  ];

  const sales: Sale[] = [
    {
      id: 1,
      invoiceNumber: 'INV-0001',
      saleType: 'OWN_SHOP',
      shopId: null,
      shopName: null,
      saleDate: '2026-11-12',
      totalPieces: 100,
      sellingPricePerPiece: '800',
      costPerPiece: '620',
      profitPerPiece: '180',
      totalAmount: '80000',
      totalCost: '62000',
      totalProfit: '18000',
      notes: null,
      createdAt: NOW_ISO,
    },
    {
      id: 2,
      invoiceNumber: 'INV-0002',
      saleType: 'WHOLESALE',
      shopId: 1,
      shopName: 'City Broiler Shop',
      saleDate: '2026-11-11',
      totalPieces: 150,
      sellingPricePerPiece: '750',
      costPerPiece: '620',
      profitPerPiece: '130',
      totalAmount: '112500',
      totalCost: '93000',
      totalProfit: '19500',
      notes: null,
      createdAt: NOW_ISO,
    },
  ];

  const expenses: BusinessExpense[] = [
    {
      id: 1,
      category: 'RENT',
      amount: '5000',
      expenseDate: '2026-11-12',
      paymentMethod: 'CASH',
      description: 'Shop daily rent',
      createdAt: NOW_ISO,
    },
    {
      id: 2,
      category: 'ICE',
      amount: '2500',
      expenseDate: '2026-11-11',
      paymentMethod: 'CASH',
      description: 'Ice blocks',
      createdAt: NOW_ISO,
    },
  ];

  const workerPayments: WorkerPayment[] = [
    {
      id: 1,
      workerId: 1,
      workerName: 'Imran Ali',
      amount: '3000',
      paymentDate: '2026-11-12',
      paymentMethod: 'CASH',
      description: 'Daily wage advance',
      createdAt: NOW_ISO,
    },
  ];

  const dealerTransactions: DealerTransaction[] = [
    {
      id: 1,
      supplierId: 1,
      supplierName: 'Bismillah Hatchery',
      transactionType: 'PAYMENT_CREDIT',
      debitAmount: '0',
      creditAmount: '150000',
      balanceAfter: '250000',
      transactionDate: '2026-11-12',
      referenceType: 'MANUAL_PAYMENT',
      referenceId: null,
      paymentMethod: 'BANK',
      notes: 'Bank transfer',
      createdAt: NOW_ISO,
    },
    {
      id: 2,
      supplierId: 1,
      supplierName: 'Bismillah Hatchery',
      transactionType: 'PURCHASE_DEBIT',
      debitAmount: '600000',
      creditAmount: '0',
      balanceAfter: '400000',
      transactionDate: '2026-11-12',
      referenceType: 'PURCHASE_LOAD',
      referenceId: 1,
      paymentMethod: null,
      notes: null,
      createdAt: NOW_ISO,
    },
  ];

  return {
    suppliers,
    purchases,
    batches,
    sales,
    expenses,
    workerPayments,
    dealerTransactions,
  };
}

test('computeDashboardFromCollections computes live KPIs, low stock alerts, and chart lengths', () => {
  const data = buildSampleCollections();
  const dashToday = computeDashboardFromCollections({
    period: 'today',
    chartDaysCount: 7,
    ...data,
    baseDate: FIXED_DATE,
  });

  assert.equal(dashToday.kpis.revenue, 80000);
  assert.equal(dashToday.kpis.ownShopRevenue, 80000);
  assert.equal(dashToday.kpis.wholesaleRevenue, 0);
  assert.equal(dashToday.kpis.cogs, 62000);
  assert.equal(dashToday.kpis.grossProfit, 18000);
  assert.equal(dashToday.kpis.generalExpenses, 5000);
  assert.equal(dashToday.kpis.workerPayments, 3000);
  assert.equal(dashToday.kpis.netProfit, 10000);
  assert.equal(dashToday.kpis.totalAvailableStock, 830);
  assert.equal(dashToday.kpis.dealerOutstandingBalance, 300000);
  assert.equal(dashToday.recent.lowStockBatches.length, 1);
  assert.equal(dashToday.recent.lowStockBatches[0].batchNumber, 'BATCH-0999');
  assert.equal(dashToday.charts.daily.length, 7);
  assert.equal(dashToday.charts.daily[6].date, '11-12');
  assert.equal(dashToday.charts.daily[6].revenue, 80000);
  assert.equal(dashToday.charts.daily[6].expenses, 8000);

  // Supports 30D and 90D chart spans
  const dash30 = computeDashboardFromCollections({
    period: 'last7days',
    chartDaysCount: 30,
    ...data,
    baseDate: FIXED_DATE,
  });
  assert.equal(dash30.charts.daily.length, 30);
  assert.equal(dash30.kpis.revenue, 192500);
});

test('computeReportFromCollections mirrors Profit & Loss, stock valuation, and optimistic additions', () => {
  const data = buildSampleCollections();

  // Simulate an optimistic sale added right now in Zustand
  const optimisticSale: Sale = {
    id: -10,
    invoiceNumber: 'INV-0003',
    saleType: 'WHOLESALE',
    shopId: 2,
    shopName: 'Karachi Poultry',
    saleDate: '2026-11-12',
    totalPieces: 50,
    sellingPricePerPiece: '900',
    costPerPiece: '620',
    profitPerPiece: '280',
    totalAmount: '45000',
    totalCost: '31000',
    totalProfit: '14000',
    notes: null,
    createdAt: NOW_ISO,
  };
  data.sales = [optimisticSale, ...data.sales];
  data.batches[0] = { ...data.batches[0], remainingPieces: 700 };

  const report = computeReportFromCollections({
    startDate: '2026-11-11',
    endDate: '2026-11-12',
    sales: data.sales,
    purchases: data.purchases,
    batches: data.batches,
    expenses: data.expenses,
    workerPayments: data.workerPayments,
    dealerTransactions: data.dealerTransactions,
  });

  // Revenue = 80000 + 112500 + 45000 = 237500
  assert.equal(report.summary.totalRevenue, 237500);
  assert.equal(report.summary.ownShopRevenue, 80000);
  assert.equal(report.summary.wholesaleRevenue, 157500);
  // COGS = 62000 + 93000 + 31000 = 186000
  assert.equal(report.summary.cogs, 186000);
  // Gross profit = 51500
  assert.equal(report.summary.grossProfit, 51500);
  // General expenses = 5000 + 2500 = 7500; worker payments = 3000 => Net = 41000
  assert.equal(report.summary.generalExpenses, 7500);
  assert.equal(report.summary.workerPayments, 3000);
  assert.equal(report.summary.netProfit, 41000);
  assert.equal(report.summary.totalLoadExpenses, 20000);
  assert.equal(report.loadExpenses?.length, 2);
  // Only PAYMENT_CREDIT transactions appear in dealerPayments breakdown
  assert.equal(report.dealerPayments?.length, 1);
  assert.equal(report.dealerPayments?.[0].creditAmount, '150000');
  // Stock valuation = 700*620 + 80*600 = 434000 + 48000 = 482000
  assert.equal(report.stockValuation?.totalPieces, 780);
  assert.equal(report.stockValuation?.totalValue, 482000);
  assert.equal(report.expensesByCategory['RENT'], 5000);
  assert.equal(report.expensesByCategory['ICE'], 2500);
});

test('PKT midnight rollover computes 2026-11-16 at 19:40Z and includes wholesale deliveries & bills', () => {
  const pktMidnightInstant = new Date('2026-11-15T19:40:17.000Z'); // 2026-11-16 00:40:17 PKT
  assert.equal(getLocalPakistanDate(pktMidnightInstant), '2026-11-16');
  assert.equal(shiftPakistanDate(pktMidnightInstant, -1), '2026-11-15');
  assert.deepEqual(getPeriodRange('last7days', undefined, undefined, pktMidnightInstant), {
    startDate: '2026-11-10',
    endDate: '2026-11-16',
  });
  assert.deepEqual(getPeriodRange('thismonth', undefined, undefined, pktMidnightInstant), {
    startDate: '2026-11-01',
    endDate: '2026-11-16',
  });

  const data = buildSampleCollections();
  const midnightSales: Sale[] = [
    {
      id: 34,
      invoiceNumber: 'INV-20261115-0034',
      saleType: 'OWN_SHOP',
      shopId: null,
      shopName: null,
      saleDate: '2026-11-15',
      totalPieces: 3,
      sellingPricePerPiece: '116.67',
      costPerPiece: '99.36',
      profitPerPiece: '17.31',
      totalAmount: '350',
      totalCost: '298.08',
      totalProfit: '51.92',
      notes: null,
      createdAt: NOW_ISO,
    },
    {
      id: 35,
      invoiceNumber: 'WHL-20261116-0035',
      saleType: 'WHOLESALE',
      shopId: 1,
      shopName: 'Shafique Chicken Center',
      saleDate: '2026-11-16',
      totalPieces: 100,
      sellingPricePerPiece: '105',
      costPerPiece: '99.36',
      profitPerPiece: '5.64',
      totalAmount: '10500',
      totalCost: '9936',
      totalProfit: '564',
      notes: null,
      createdAt: NOW_ISO,
    },
    {
      id: 36,
      invoiceNumber: 'WHL-20261116-0036',
      saleType: 'WHOLESALE',
      shopId: 2,
      shopName: 'Another Shop',
      saleDate: '2026-11-16',
      totalPieces: 20,
      sellingPricePerPiece: '100',
      costPerPiece: '99.36',
      profitPerPiece: '0.64',
      totalAmount: '2000',
      totalCost: '1987.20',
      totalProfit: '12.80',
      notes: null,
      createdAt: NOW_ISO,
    },
  ];
  const midnightExpenses: BusinessExpense[] = [
    {
      id: 99,
      category: 'Electricity',
      amount: '300',
      expenseDate: '2026-11-16',
      paymentMethod: 'CASH',
      description: 'Shop bill',
      createdAt: NOW_ISO,
    },
  ];

  const dash = computeDashboardFromCollections({
    period: 'last7days',
    chartDaysCount: 7,
    sales: midnightSales,
    purchases: data.purchases,
    batches: data.batches,
    suppliers: data.suppliers,
    expenses: midnightExpenses,
    workerPayments: [],
    baseDate: pktMidnightInstant,
  });

  assert.equal(dash.endDate, '2026-11-16');
  assert.equal(dash.kpis.revenue, 12850);
  assert.equal(dash.kpis.ownShopRevenue, 350);
  assert.equal(dash.kpis.wholesaleRevenue, 12500);
  assert.equal(dash.kpis.totalPiecesSold, 123);
  assert.equal(dash.kpis.generalExpenses, 300);
  assert.equal(dash.kpis.netProfit, 328.72);
  assert.equal(dash.charts.daily[6].date, '11-16');
  assert.equal(dash.charts.daily[6].revenue, 12500);

  const monthRange = getPeriodRange('thismonth', undefined, undefined, pktMidnightInstant);
  const report = computeReportFromCollections({
    startDate: monthRange.startDate,
    endDate: monthRange.endDate,
    sales: midnightSales,
    purchases: data.purchases,
    batches: data.batches,
    expenses: midnightExpenses,
    workerPayments: [],
    dealerTransactions: [],
  });
  assert.equal(report.summary.totalRevenue, 12850);
  assert.equal(report.summary.ownShopRevenue, 350);
  assert.equal(report.summary.wholesaleRevenue, 12500);
  assert.equal(report.sales.filter((s) => s.saleType === 'WHOLESALE').length, 2);
  assert.equal(report.generalExpenses.length, 1);
});

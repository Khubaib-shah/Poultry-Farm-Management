import {
  Supplier,
  PurchaseLoad,
  StockBatch,
  Sale,
  WorkerPayment,
  BusinessExpense,
  DealerTransaction,
  DashboardData,
  ReportData,
  LoadExpenseDetail,
} from '../types/index.ts';
import {
  calculatePnl,
  calculatePurchaseRate,
  calculateLandedCost,
} from './poultryMath.ts';

export function getLocalPakistanDate(d: Date = new Date()): string {
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const pktDate = new Date(utc + 5 * 3600000);
  return pktDate.toISOString().split('T')[0];
}

export function getPeriodRange(
  period: string,
  customStart?: string,
  customEnd?: string,
  baseDate: Date = new Date()
): { startDate: string; endDate: string } {
  const todayStr = getLocalPakistanDate(baseDate);
  let startDate = todayStr;
  let endDate = todayStr;

  if (period === 'yesterday') {
    const y = new Date(baseDate);
    y.setDate(y.getDate() - 1);
    startDate = getLocalPakistanDate(y);
    endDate = startDate;
  } else if (period === 'last7days') {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 6);
    startDate = getLocalPakistanDate(d);
    endDate = todayStr;
  } else if (period === 'thismonth') {
    startDate = `${todayStr.substring(0, 7)}-01`;
    endDate = todayStr;
  } else if (period === 'custom' && customStart && customEnd) {
    startDate = customStart;
    endDate = customEnd;
  }

  return { startDate, endDate };
}

export function computeDashboardFromCollections(params: {
  period: string;
  customStart?: string;
  customEnd?: string;
  chartDaysCount?: number;
  sales: Sale[];
  purchases: PurchaseLoad[];
  batches: StockBatch[];
  suppliers: Supplier[];
  expenses: BusinessExpense[];
  workerPayments: WorkerPayment[];
  baseDate?: Date;
}): DashboardData {
  const {
    period,
    customStart,
    customEnd,
    chartDaysCount = 7,
    sales,
    purchases,
    batches,
    suppliers,
    expenses,
    workerPayments,
    baseDate = new Date(),
  } = params;

  const { startDate, endDate } = getPeriodRange(period, customStart, customEnd, baseDate);

  const periodSales = sales.filter((s) => s.saleDate >= startDate && s.saleDate <= endDate);
  let revenue = 0;
  let ownShopRevenue = 0;
  let wholesaleRevenue = 0;
  let cogs = 0;
  let totalPiecesSold = 0;

  for (const s of periodSales) {
    const amt = Number(s.totalAmount || 0);
    revenue += amt;
    cogs += Number(s.totalCost || 0);
    totalPiecesSold += Number(s.totalPieces || 0);
    if (s.saleType === 'OWN_SHOP') {
      ownShopRevenue += amt;
    } else {
      wholesaleRevenue += amt;
    }
  }

  const periodExpenses = expenses.filter(
    (e) => e.expenseDate >= startDate && e.expenseDate <= endDate
  );
  const generalExpensesTotal = periodExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const periodWorkerPmts = workerPayments.filter(
    (p) => p.paymentDate >= startDate && p.paymentDate <= endDate
  );
  const workerPaymentsTotal = periodWorkerPmts.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const pnl = calculatePnl(revenue, cogs, generalExpensesTotal, workerPaymentsTotal);

  const totalAvailableStock = batches
    .filter((b) => !b.isClosed)
    .reduce((sum, b) => sum + Number(b.remainingPieces || 0), 0);

  const periodPurchases = purchases.filter(
    (p) => p.purchaseDate >= startDate && p.purchaseDate <= endDate
  );
  const totalPurchaseAmount = periodPurchases.reduce(
    (sum, p) => sum + Number(p.purchaseAmount || 0),
    0
  );
  const totalPurchaseWeight = periodPurchases.reduce(
    (sum, p) => sum + Number(p.totalWeightKg || 0),
    0
  );
  const totalLoadExpenses = periodPurchases.reduce(
    (sum, p) => sum + Number(p.totalExpenses || 0),
    0
  );

  const dealerOutstandingBalance = suppliers.reduce(
    (sum, s) => sum + Number(s.currentBalance ?? s.openingBalance ?? 0),
    0
  );

  // Build chart days
  const daily: DashboardData['charts']['daily'] = [];
  for (let i = chartDaysCount - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    const dayStr = getLocalPakistanDate(d);

    const daySales = sales.filter((s) => s.saleDate === dayStr);
    const rev = daySales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const dayCogs = daySales.reduce((sum, s) => sum + Number(s.totalCost || 0), 0);
    const gp = daySales.reduce((sum, s) => sum + Number(s.totalProfit || 0), 0);
    const piecesSold = daySales.reduce((sum, s) => sum + Number(s.totalPieces || 0), 0);

    const dayGenExp = expenses
      .filter((e) => e.expenseDate === dayStr)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const dayWkrExp = workerPayments
      .filter((p) => p.paymentDate === dayStr)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const exp = dayGenExp + dayWkrExp;

    daily.push({
      date: dayStr.slice(5),
      revenue: Number(rev.toFixed(2)),
      expenses: Number(exp.toFixed(2)),
      cogs: Number(dayCogs.toFixed(2)),
      grossProfit: Number(gp.toFixed(2)),
      netProfit: Number((gp - exp).toFixed(2)),
      piecesSold,
    });
  }

  return {
    period,
    startDate,
    endDate,
    kpis: {
      revenue: Number(revenue.toFixed(2)),
      ownShopRevenue: Number(ownShopRevenue.toFixed(2)),
      wholesaleRevenue: Number(wholesaleRevenue.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      grossProfit: pnl.grossProfit,
      netProfit: pnl.netProfit,
      generalExpenses: Number(generalExpensesTotal.toFixed(2)),
      workerPayments: Number(workerPaymentsTotal.toFixed(2)),
      totalAvailableStock,
      totalPurchaseAmount: Number(totalPurchaseAmount.toFixed(2)),
      totalPurchaseWeight: Number(totalPurchaseWeight.toFixed(2)),
      totalLoadExpenses: Number(totalLoadExpenses.toFixed(2)),
      dealerOutstandingBalance: Number(dealerOutstandingBalance.toFixed(2)),
      totalPiecesSold,
    },
    charts: { daily },
    recent: {
      sales: [...sales].slice(0, 6),
      purchases: [...purchases].slice(0, 5),
      expenses: [...expenses].slice(0, 5),
      lowStockBatches: batches
        .filter((b) => !b.isClosed && b.remainingPieces <= 150)
        .sort((a, b) => a.remainingPieces - b.remainingPieces),
    },
  };
}

export function computeReportFromCollections(params: {
  startDate: string;
  endDate: string;
  sales: Sale[];
  purchases: PurchaseLoad[];
  batches: StockBatch[];
  expenses: BusinessExpense[];
  workerPayments: WorkerPayment[];
  dealerTransactions: DealerTransaction[];
}): ReportData {
  const {
    startDate,
    endDate,
    sales,
    purchases,
    batches,
    expenses,
    workerPayments,
    dealerTransactions,
  } = params;

  const salesList = sales.filter((s) => s.saleDate >= startDate && s.saleDate <= endDate);

  let ownShopRevenue = 0;
  let wholesaleRevenue = 0;
  let totalRevenue = 0;
  let cogs = 0;
  let totalPiecesSold = 0;

  for (const s of salesList) {
    const amt = Number(s.totalAmount || 0);
    totalRevenue += amt;
    cogs += Number(s.totalCost || 0);
    totalPiecesSold += Number(s.totalPieces || 0);
    if (s.saleType === 'OWN_SHOP') {
      ownShopRevenue += amt;
    } else {
      wholesaleRevenue += amt;
    }
  }

  const generalExpensesList = expenses.filter(
    (e) => e.expenseDate >= startDate && e.expenseDate <= endDate
  );
  const generalExpensesTotal = generalExpensesList.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const expensesByCategory: Record<string, number> = {};
  for (const e of generalExpensesList) {
    expensesByCategory[e.category] =
      (expensesByCategory[e.category] || 0) + Number(e.amount || 0);
  }

  const workerPaymentsList = workerPayments.filter(
    (p) => p.paymentDate >= startDate && p.paymentDate <= endDate
  );
  const workerPaymentsTotal = workerPaymentsList.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const purchasesList = purchases.filter(
    (p) => p.purchaseDate >= startDate && p.purchaseDate <= endDate
  );
  const totalPurchasesAmount = purchasesList.reduce(
    (sum, p) => sum + Number(p.purchaseAmount || 0),
    0
  );
  const totalPurchasesWeight = purchasesList.reduce(
    (sum, p) => sum + Number(p.totalWeightKg || 0),
    0
  );

  const loadExpensesList: LoadExpenseDetail[] = [];
  for (const p of purchases) {
    for (const le of p.expenses || []) {
      if (le.expenseDate >= startDate && le.expenseDate <= endDate) {
        loadExpensesList.push({
          ...le,
          loadNumber: p.loadNumber,
          supplierName: p.supplierName,
        });
      }
    }
  }
  const totalLoadExpenses = loadExpensesList.reduce(
    (sum, le) => sum + Number(le.amount || 0),
    0
  );

  const dealerPayments = dealerTransactions.filter(
    (t) =>
      t.transactionType === 'PAYMENT_CREDIT' &&
      t.transactionDate >= startDate &&
      t.transactionDate <= endDate
  );

  const activeBatches = batches.filter((b) => !b.isClosed);
  const stockValuation = {
    totalPieces: activeBatches.reduce((sum, b) => sum + Number(b.remainingPieces || 0), 0),
    totalValue: Number(
      activeBatches
        .reduce((sum, b) => sum + Number(b.remainingPieces || 0) * Number(b.costPerPiece || 0), 0)
        .toFixed(2)
    ),
    activeBatchesCount: activeBatches.length,
  };

  const pnl = calculatePnl(totalRevenue, cogs, generalExpensesTotal, workerPaymentsTotal);

  return {
    startDate,
    endDate,
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      ownShopRevenue: Number(ownShopRevenue.toFixed(2)),
      wholesaleRevenue: Number(wholesaleRevenue.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      grossProfit: pnl.grossProfit,
      grossMarginPercent: pnl.grossMarginPercent,
      generalExpenses: Number(generalExpensesTotal.toFixed(2)),
      workerPayments: Number(workerPaymentsTotal.toFixed(2)),
      netProfit: pnl.netProfit,
      netMarginPercent: pnl.netMarginPercent,
      totalPiecesSold,
      totalPurchasesAmount: Number(totalPurchasesAmount.toFixed(2)),
      totalPurchasesWeight: Number(totalPurchasesWeight.toFixed(2)),
      totalLoadExpenses: Number(totalLoadExpenses.toFixed(2)),
    },
    expensesByCategory,
    sales: salesList,
    generalExpenses: generalExpensesList,
    workerPayments: workerPaymentsList,
    purchases: purchasesList.map((p) => ({
      ...p,
      purchaseRatePerKg: calculatePurchaseRate(
        Number(p.purchaseAmount || 0),
        Number(p.totalWeightKg || 0)
      ),
      totalLandedCost: calculateLandedCost(
        Number(p.purchaseAmount || 0),
        Number(p.totalExpenses || 0)
      ),
    })),
    loadExpenses: loadExpensesList,
    dealerPayments,
    stockValuation,
  };
}

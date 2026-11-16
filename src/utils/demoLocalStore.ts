import type {
  Supplier,
  PurchaseLoad,
  LoadExpense,
  StockBatch,
  StockMovement,
  DealerTransaction,
  Shop,
  Sale,
  SaleItem,
  Worker,
  WorkerPayment,
  BusinessExpense,
  Vehicle,
  AppSettings,
  BootstrapData,
  AuthUser,
} from '../types/index.js';
import {
  DEMO_STATIC_CREDENTIALS,
  buildSixMonthDemoDataset,
} from './demoData.js';
import {
  calculatePurchaseRate,
  calculateSaleablePieces,
  calculateLandedCost,
  calculateCostPerPiece,
  calculateSaleMetrics,
  consumeBatchesFifo,
} from './poultryMath.js';
import {
  applySaleDeletionToBatches,
  recomputeDealerTransactionBalances,
  recalculateSaleAfterBatchRemoval,
  applyMovementDeletionToBatch,
} from './deleteHelpers.js';
import type { PaginatedResponse } from './paginationCache.js';
import {
  parseServerPaginationParams,
  sortAndPaginateRecords,
} from './paginationCache.js';
import { getLocalPakistanDate } from './syncCalculations.js';

const DEMO_SESSION_KEY = 'checkin_demo_session_v1';
const DEMO_SANDBOX_KEY = 'checkin_demo_sandbox_v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memoryStorageMap = new Map<string, string>();
const fallbackMemoryStorage: StorageLike = {
  getItem: (key) => memoryStorageMap.get(key) ?? null,
  setItem: (key, value) => {
    memoryStorageMap.set(key, value);
  },
  removeItem: (key) => {
    memoryStorageMap.delete(key);
  },
};

function resolveStorage(customStorage?: StorageLike): StorageLike {
  if (customStorage) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore inaccessible localStorage
  }
  return fallbackMemoryStorage;
}

export const STATIC_DEMO_USER: AuthUser = {
  id: 999999,
  uid: DEMO_STATIC_CREDENTIALS.uid,
  email: DEMO_STATIC_CREDENTIALS.email,
  name: DEMO_STATIC_CREDENTIALS.name,
  role: DEMO_STATIC_CREDENTIALS.role,
  workspace: 'demo',
};

export function matchStaticDemoCredentials(email: string, password: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return (
    normalizedEmail === DEMO_STATIC_CREDENTIALS.email.trim().toLowerCase() &&
    password === DEMO_STATIC_CREDENTIALS.password
  );
}

interface StoredRawPurchaseLoad {
  id: number;
  loadNumber: string;
  supplierId: number;
  purchaseDate: string;
  totalWeightKg: string;
  purchaseAmount: string;
  vehicleNumber: string | null;
  driverName: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface StoredRawBatch {
  id: number;
  batchNumber: string;
  purchaseLoadId: number;
  receivingDate: string;
  receivedPieces: number;
  deadPieces: number;
  damagedPieces: number;
  originalSaleablePieces: number;
  soldPieces: number;
  remainingPieces: number;
  purchaseAmount: string;
  totalLoadExpenses: string;
  totalLandedCost: string;
  costPerPiece: string;
  isClosed: boolean;
  notes: string | null;
  createdAt: string;
}

interface StoredRawMovement {
  id: number;
  stockBatchId: number;
  movementType: StockMovement['movementType'];
  quantity: number;
  balanceAfter: number;
  unitCost: string;
  referenceType: string | null;
  referenceId: number | null;
  notes: string | null;
  createdAt: string;
}

interface StoredRawDealerTx {
  id: number;
  supplierId: number;
  transactionDate: string;
  transactionType: DealerTransaction['transactionType'];
  debitAmount: string;
  creditAmount: string;
  balanceAfter: string;
  referenceType: string | null;
  referenceId: number | null;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
}

interface StoredRawSale {
  id: number;
  invoiceNumber: string;
  saleType: 'OWN_SHOP' | 'WHOLESALE';
  saleDate: string;
  shopId: number | null;
  totalPieces: number;
  totalAmount: string;
  totalCost: string;
  totalProfit: string;
  sellingPricePerPiece: string;
  costPerPiece: string;
  profitPerPiece: string;
  notes: string | null;
  createdAt: string;
}

interface StoredRawWorkerPayment {
  id: number;
  workerId: number;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  description: string | null;
  createdAt: string;
}

interface DemoSandboxEnvelope {
  anchorDate: string;
  nextId: number;
  suppliers: Supplier[];
  vehicles: Vehicle[];
  shops: Shop[];
  workers: Worker[];
  purchaseLoads: StoredRawPurchaseLoad[];
  loadExpenses: LoadExpense[];
  stockBatches: StoredRawBatch[];
  stockMovements: StoredRawMovement[];
  dealerTransactions: StoredRawDealerTx[];
  sales: StoredRawSale[];
  saleItems: SaleItem[];
  workerPayments: StoredRawWorkerPayment[];
  businessExpenses: BusinessExpense[];
  settings: AppSettings;
}

function buildFreshSandboxEnvelope(baseDate: Date = new Date()): DemoSandboxEnvelope {
  const dataset = buildSixMonthDemoDataset(baseDate);
  const anchorDate = dataset.endDate;
  let seqId = 1;
  const allocId = () => seqId++;

  const supplierIdByKey = new Map<string, number>();
  const suppliers: Supplier[] = dataset.suppliers.map((s) => {
    const id = allocId();
    supplierIdByKey.set(s.key, id);
    const ts = `${s.openingDate}T08:00:00.000Z`;
    return {
      id,
      name: s.name,
      phone: s.phone,
      address: s.address,
      openingBalance: s.openingBalance,
      notes: s.notes,
      createdAt: ts,
      updatedAt: ts,
    };
  });

  const vehicles: Vehicle[] = dataset.vehicles.map((v) => ({
    id: allocId(),
    vehicleNumber: v.vehicleNumber,
    driverName: v.driverName,
    driverPhone: v.driverPhone,
    notes: v.notes,
    createdAt: `${dataset.startDate}T08:00:00.000Z`,
  }));

  const shopIdByKey = new Map<string, number>();
  const shops: Shop[] = dataset.shops.map((sh) => {
    const id = allocId();
    shopIdByKey.set(sh.key, id);
    return {
      id,
      shopName: sh.shopName,
      ownerName: sh.ownerName,
      phone: sh.phone,
      address: sh.address,
      notes: sh.notes,
      createdAt: `${dataset.startDate}T08:00:00.000Z`,
    };
  });

  const workerIdByKey = new Map<string, number>();
  const workers: Worker[] = dataset.workers.map((w) => {
    const id = allocId();
    workerIdByKey.set(w.key, id);
    return {
      id,
      name: w.name,
      phone: w.phone,
      notes: w.notes,
      isActive: w.isActive,
      createdAt: `${dataset.startDate}T08:00:00.000Z`,
    };
  });

  const loadIdByKey = new Map<string, number>();
  const batchIdByKey = new Map<string, number>();
  const purchaseLoads: StoredRawPurchaseLoad[] = [];
  const loadExpenses: LoadExpense[] = [];
  const stockBatches: StoredRawBatch[] = [];

  for (const load of dataset.purchaseLoads) {
    const loadId = allocId();
    loadIdByKey.set(load.key, loadId);
    const loadTs = `${load.purchaseDate}T09:00:00.000Z`;

    purchaseLoads.push({
      id: loadId,
      loadNumber: load.loadNumber,
      supplierId: supplierIdByKey.get(load.supplierKey)!,
      purchaseDate: load.purchaseDate,
      totalWeightKg: load.totalWeightKg,
      purchaseAmount: load.purchaseAmount,
      vehicleNumber: load.vehicleNumber,
      driverName: load.driverName,
      status: load.status,
      notes: load.notes,
      createdAt: loadTs,
    });

    for (const exp of load.loadExpenses) {
      loadExpenses.push({
        id: allocId(),
        purchaseLoadId: loadId,
        category: exp.category,
        amount: exp.amount,
        expenseDate: exp.expenseDate,
        description: exp.description,
        createdAt: `${exp.expenseDate}T09:30:00.000Z`,
      });
    }

    if (load.batch) {
      const b = load.batch;
      const batchId = allocId();
      batchIdByKey.set(b.key, batchId);
      stockBatches.push({
        id: batchId,
        batchNumber: b.batchNumber,
        purchaseLoadId: loadId,
        receivingDate: b.receivingDate,
        receivedPieces: b.receivedPieces,
        deadPieces: b.deadPieces,
        damagedPieces: b.damagedPieces,
        originalSaleablePieces: b.originalSaleablePieces,
        soldPieces: b.soldPieces,
        remainingPieces: b.remainingPieces,
        purchaseAmount: b.purchaseAmount,
        totalLoadExpenses: b.totalLoadExpenses,
        totalLandedCost: b.totalLandedCost,
        costPerPiece: b.costPerPiece,
        isClosed: b.isClosed,
        notes: b.notes,
        createdAt: `${b.receivingDate}T10:00:00.000Z`,
      });
    }
  }

  const dealerTransactions: StoredRawDealerTx[] = dataset.dealerTransactions.map((tx) => ({
    id: allocId(),
    supplierId: supplierIdByKey.get(tx.supplierKey)!,
    transactionDate: tx.transactionDate,
    transactionType: tx.transactionType,
    debitAmount: tx.debitAmount,
    creditAmount: tx.creditAmount,
    balanceAfter: tx.balanceAfter,
    referenceType: tx.referenceType,
    referenceId: tx.loadKey ? loadIdByKey.get(tx.loadKey) ?? null : null,
    paymentMethod: tx.paymentMethod ?? null,
    notes: tx.notes,
    createdAt: `${tx.transactionDate}T11:00:00.000Z`,
  }));

  const saleIdByKey = new Map<string, number>();
  const sales: StoredRawSale[] = [];
  const saleItems: SaleItem[] = [];

  for (const s of dataset.sales) {
    const saleId = allocId();
    saleIdByKey.set(s.key, saleId);
    const saleTs = `${s.saleDate}T14:00:00.000Z`;
    sales.push({
      id: saleId,
      invoiceNumber: s.invoiceNumber,
      saleType: s.saleType,
      saleDate: s.saleDate,
      shopId: s.shopKey ? shopIdByKey.get(s.shopKey) ?? null : null,
      totalPieces: s.totalPieces,
      totalAmount: s.totalAmount,
      totalCost: s.totalCost,
      totalProfit: s.totalProfit,
      sellingPricePerPiece: s.sellingPricePerPiece,
      costPerPiece: s.costPerPiece,
      profitPerPiece: s.profitPerPiece,
      notes: s.notes,
      createdAt: saleTs,
    });

    for (const item of s.items) {
      saleItems.push({
        id: allocId(),
        saleId,
        stockBatchId: batchIdByKey.get(item.batchKey)!,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
      });
    }
  }

  const stockMovements: StoredRawMovement[] = dataset.stockMovements.map((m, idx) => {
    const baseDateStr = m.movementDate || anchorDate;
    const sec = String(idx % 60).padStart(2, '0');
    const min = String(Math.floor(idx / 60) % 60).padStart(2, '0');
    return {
      id: allocId(),
      stockBatchId: batchIdByKey.get(m.batchKey)!,
      movementType: m.movementType,
      quantity: m.quantity,
      balanceAfter: m.balanceAfter,
      unitCost: m.unitCost,
      referenceType: m.referenceType,
      referenceId: m.loadKey
        ? loadIdByKey.get(m.loadKey) ?? null
        : m.saleKey
        ? saleIdByKey.get(m.saleKey) ?? null
        : null,
      notes: m.notes,
      createdAt: `${baseDateStr}T12:${min}:${sec}.000Z`,
    };
  });

  const workerPayments: StoredRawWorkerPayment[] = dataset.workerPayments.map((wp) => ({
    id: allocId(),
    workerId: workerIdByKey.get(wp.workerKey)!,
    amount: wp.amount,
    paymentDate: wp.paymentDate,
    paymentMethod: wp.paymentMethod,
    description: wp.description,
    createdAt: `${wp.paymentDate}T16:00:00.000Z`,
  }));

  const businessExpenses: BusinessExpense[] = dataset.businessExpenses.map((exp) => ({
    id: allocId(),
    category: exp.category,
    amount: exp.amount,
    expenseDate: exp.expenseDate,
    paymentMethod: exp.paymentMethod,
    description: exp.description,
    createdAt: `${exp.expenseDate}T17:00:00.000Z`,
  }));

  return {
    anchorDate,
    nextId: seqId,
    suppliers,
    vehicles,
    shops,
    workers,
    purchaseLoads,
    loadExpenses,
    stockBatches,
    stockMovements,
    dealerTransactions,
    sales,
    saleItems,
    workerPayments,
    businessExpenses,
    settings: {
      businessName: dataset.settings.businessName,
      businessLocation: dataset.settings.businessLocation,
      examplePrice1: dataset.settings.examplePrice1,
      examplePrice2: dataset.settings.examplePrice2,
      lowStockThreshold: dataset.settings.lowStockThreshold,
    },
  };
}

function readSandbox(storage: StorageLike, now: Date = new Date()): DemoSandboxEnvelope {
  const todayStr = getLocalPakistanDate(now);
  try {
    const raw = storage.getItem(DEMO_SANDBOX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoSandboxEnvelope;
      if (parsed && parsed.anchorDate === todayStr && Array.isArray(parsed.suppliers)) {
        return parsed;
      }
    }
  } catch {
    // rebuild clean snapshot if corrupt
  }
  const fresh = buildFreshSandboxEnvelope(now);
  saveSandbox(storage, fresh);
  return fresh;
}

function saveSandbox(storage: StorageLike, state: DemoSandboxEnvelope): void {
  try {
    storage.setItem(DEMO_SANDBOX_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function nextSeqId(state: DemoSandboxEnvelope): number {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

function recomputeSupplierBalancesInSandbox(state: DemoSandboxEnvelope, supplierId: number): number {
  const sup = state.suppliers.find((s) => s.id === supplierId);
  if (!sup) return 0;
  const supTxs = state.dealerTransactions.filter((t) => t.supplierId === supplierId);
  const { updated, latestBalance } = recomputeDealerTransactionBalances(
    supTxs,
    Number(sup.openingBalance)
  );
  const updatedMap = new Map(updated.map((u) => [u.id, u.balanceAfter]));
  state.dealerTransactions = state.dealerTransactions.map((tx) =>
    updatedMap.has(tx.id) ? { ...tx, balanceAfter: updatedMap.get(tx.id)! } : tx
  );
  return latestBalance;
}

function deleteSaleCascadeInSandbox(
  state: DemoSandboxEnvelope,
  saleId: number
): { found: boolean; restoredPieces: number } {
  const sale = state.sales.find((s) => s.id === saleId);
  if (!sale) return { found: false, restoredPieces: 0 };

  const items = state.saleItems.filter((item) => item.saleId === saleId);
  state.stockBatches = applySaleDeletionToBatches(
    state.stockBatches,
    items.map((item) => ({ stockBatchId: item.stockBatchId, quantity: item.quantity }))
  );

  state.stockMovements = state.stockMovements.filter(
    (m) =>
      !(
        m.referenceId === saleId &&
        (m.referenceType === 'SALE' || m.referenceType === 'SHOP_DISTRIBUTION')
      )
  );

  state.saleItems = state.saleItems.filter((item) => item.saleId !== saleId);
  state.sales = state.sales.filter((s) => s.id !== saleId);

  return { found: true, restoredPieces: sale.totalPieces };
}

function deleteBatchCascadeInSandbox(
  state: DemoSandboxEnvelope,
  batchId: number,
  resetParentLoadStatus: boolean
): { found: boolean; deletedSalesCount: number } {
  const batch = state.stockBatches.find((b) => b.id === batchId);
  if (!batch) return { found: false, deletedSalesCount: 0 };

  const affectedSaleIds = [
    ...new Set(state.saleItems.filter((i) => i.stockBatchId === batchId).map((i) => i.saleId)),
  ];

  state.stockMovements = state.stockMovements.filter((m) => m.stockBatchId !== batchId);
  state.saleItems = state.saleItems.filter((i) => i.stockBatchId !== batchId);

  let deletedSalesCount = 0;
  for (const saleId of affectedSaleIds) {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) continue;
    const remainingItems = state.saleItems.filter((i) => i.saleId === saleId);
    const recalc = recalculateSaleAfterBatchRemoval(sale.totalAmount, remainingItems);
    if (!recalc) {
      state.stockMovements = state.stockMovements.filter(
        (m) =>
          !(
            m.referenceId === saleId &&
            (m.referenceType === 'SALE' || m.referenceType === 'SHOP_DISTRIBUTION')
          )
      );
      state.sales = state.sales.filter((s) => s.id !== saleId);
      deletedSalesCount++;
    } else {
      state.sales = state.sales.map((s) =>
        s.id === saleId
          ? {
              ...s,
              totalPieces: recalc.totalPieces,
              totalCost: recalc.totalCost,
              totalProfit: recalc.totalProfit,
              sellingPricePerPiece: recalc.sellingPricePerPiece,
              costPerPiece: recalc.costPerPiece,
              profitPerPiece: recalc.profitPerPiece,
            }
          : s
      );
    }
  }

  state.stockBatches = state.stockBatches.filter((b) => b.id !== batchId);

  if (resetParentLoadStatus && batch.purchaseLoadId) {
    state.purchaseLoads = state.purchaseLoads.map((l) =>
      l.id === batch.purchaseLoadId ? { ...l, status: 'PENDING_RECEIVING' } : l
    );
  }

  return { found: true, deletedSalesCount };
}

function deletePurchaseLoadCascadeInSandbox(
  state: DemoSandboxEnvelope,
  loadId: number
): { found: boolean; supplierId: number | null } {
  const load = state.purchaseLoads.find((l) => l.id === loadId);
  if (!load) return { found: false, supplierId: null };

  const linkedBatches = state.stockBatches.filter((b) => b.purchaseLoadId === loadId);
  for (const b of linkedBatches) {
    deleteBatchCascadeInSandbox(state, b.id, false);
  }

  state.stockMovements = state.stockMovements.filter(
    (m) => !(m.referenceType === 'PURCHASE_LOAD' && m.referenceId === loadId)
  );
  state.loadExpenses = state.loadExpenses.filter((e) => e.purchaseLoadId !== loadId);
  state.dealerTransactions = state.dealerTransactions.filter(
    (t) => !(t.referenceType === 'PURCHASE_LOAD' && t.referenceId === loadId)
  );
  state.purchaseLoads = state.purchaseLoads.filter((l) => l.id !== loadId);

  recomputeSupplierBalancesInSandbox(state, load.supplierId);
  return { found: true, supplierId: load.supplierId };
}

function buildEnrichedPurchases(state: DemoSandboxEnvelope): PurchaseLoad[] {
  const supById = new Map(state.suppliers.map((s) => [s.id, s]));
  const batchByLoad = new Map<number, StockBatch>();
  for (const b of buildEnrichedBatches(state)) {
    batchByLoad.set(b.purchaseLoadId, b);
  }

  return [...state.purchaseLoads]
    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate) || b.id - a.id)
    .map((load) => {
      const sup = supById.get(load.supplierId);
      const exps = state.loadExpenses
        .filter((e) => e.purchaseLoadId === load.id)
        .sort((a, b) => b.id - a.id);
      const totalExp = exps.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const amtNum = Number(load.purchaseAmount);
      return {
        ...load,
        supplierName: sup?.name || 'Supplier',
        supplierPhone: sup?.phone || undefined,
        expenses: exps,
        purchaseRatePerKg: calculatePurchaseRate(amtNum, Number(load.totalWeightKg)),
        totalExpenses: totalExp,
        totalLandedCost: calculateLandedCost(amtNum, totalExp),
        stockBatch: batchByLoad.get(load.id) || null,
      };
    });
}

function buildEnrichedBatches(state: DemoSandboxEnvelope): StockBatch[] {
  const loadById = new Map(state.purchaseLoads.map((l) => [l.id, l]));
  const supById = new Map(state.suppliers.map((s) => [s.id, s]));

  return [...state.stockBatches]
    .sort((a, b) => a.receivingDate.localeCompare(b.receivingDate) || a.id - b.id)
    .map((b) => {
      const load = loadById.get(b.purchaseLoadId);
      const sup = load ? supById.get(load.supplierId) : undefined;
      return {
        ...b,
        loadNumber: load?.loadNumber,
        supplierName: sup?.name,
      };
    });
}

function buildEnrichedMovements(state: DemoSandboxEnvelope): StockMovement[] {
  const batchById = new Map(state.stockBatches.map((b) => [b.id, b]));
  return [...state.stockMovements]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .map((m) => ({
      ...m,
      batchNumber: batchById.get(m.stockBatchId)?.batchNumber || '',
    }));
}

function buildEnrichedSales(state: DemoSandboxEnvelope): Sale[] {
  const shopById = new Map(state.shops.map((s) => [s.id, s]));
  return [...state.sales]
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate) || b.id - a.id)
    .map((s) => ({
      ...s,
      shopName: s.shopId ? shopById.get(s.shopId)?.shopName || null : null,
    }));
}

function buildEnrichedDealerTransactions(state: DemoSandboxEnvelope): DealerTransaction[] {
  const supById = new Map(state.suppliers.map((s) => [s.id, s]));
  return [...state.dealerTransactions]
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.id - a.id)
    .map((t) => ({
      ...t,
      supplierName: supById.get(t.supplierId)?.name || 'Supplier',
    }));
}

function buildEnrichedWorkerPayments(state: DemoSandboxEnvelope): WorkerPayment[] {
  const workerById = new Map(state.workers.map((w) => [w.id, w]));
  return [...state.workerPayments]
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id - a.id)
    .map((p) => ({
      ...p,
      workerName: workerById.get(p.workerId)?.name || 'Staff',
    }));
}

function buildBootstrapFromState(state: DemoSandboxEnvelope): BootstrapData {
  const allDealerTxDescById = [...state.dealerTransactions]
    .sort((a, b) => b.id - a.id)
    .map((t) => ({
      ...t,
      supplierName: state.suppliers.find((s) => s.id === t.supplierId)?.name || 'Supplier',
    }));

  const enrichedSuppliers: Supplier[] = [...state.suppliers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((sup) => {
      const supTxs = allDealerTxDescById.filter((t) => t.supplierId === sup.id);
      const currentBalance =
        supTxs.length > 0 ? Number(supTxs[0].balanceAfter) : Number(sup.openingBalance);
      const supLoads = state.purchaseLoads.filter((l) => l.supplierId === sup.id);
      return {
        ...sup,
        currentBalance,
        totalPurchasesAmount: supLoads.reduce((s, l) => s + Number(l.purchaseAmount), 0),
        purchaseCount: supLoads.length,
      };
    });

  const enrichedShops: Shop[] = [...state.shops]
    .sort((a, b) => a.shopName.localeCompare(b.shopName))
    .map((sh) => {
      const shopSales = state.sales.filter((s) => s.shopId === sh.id);
      return {
        ...sh,
        totalPiecesDelivered: shopSales.reduce((s, x) => s + x.totalPieces, 0),
        totalSalesAmount: shopSales.reduce((s, x) => s + Number(x.totalAmount), 0),
        ordersCount: shopSales.length,
      };
    });

  const enrichedWorkers: Worker[] = [...state.workers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((w) => {
      const wPmts = state.workerPayments.filter((p) => p.workerId === w.id);
      return {
        ...w,
        totalPaid: wPmts.reduce((s, p) => s + Number(p.amount), 0),
        paymentCount: wPmts.length,
      };
    });

  const allExpensesDesc = [...state.businessExpenses].sort(
    (a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.id - a.id
  );

  return {
    suppliers: enrichedSuppliers,
    purchases: buildEnrichedPurchases(state),
    batches: buildEnrichedBatches(state),
    movements: buildEnrichedMovements(state).slice(0, 200),
    sales: buildEnrichedSales(state),
    shops: enrichedShops,
    dealerTransactions: allDealerTxDescById,
    workers: enrichedWorkers,
    workerPayments: buildEnrichedWorkerPayments(state),
    expenses: allExpensesDesc,
    vehicles: [...state.vehicles].sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber)),
    settings: { ...state.settings },
  };
}

export function createDemoLocalStore(options: { storage?: StorageLike; now?: () => Date } = {}) {
  const getStorage = () => resolveStorage(options.storage);
  const getNow = () => (options.now ? options.now() : new Date());

  return {
    isSessionActive(): boolean {
      const storage = getStorage();
      return storage.getItem(DEMO_SESSION_KEY) === 'active';
    },

    activateSession(activateOptions: { resetToFresh?: boolean } = {}): {
      user: AuthUser;
      token: string;
    } {
      const storage = getStorage();
      const now = getNow();
      storage.setItem(DEMO_SESSION_KEY, 'active');
      if (activateOptions.resetToFresh) {
        const fresh = buildFreshSandboxEnvelope(now);
        saveSandbox(storage, fresh);
      } else {
        readSandbox(storage, now);
      }
      return {
        user: { ...STATIC_DEMO_USER },
        token: 'local-demo-session',
      };
    },

    clearSession(): void {
      const storage = getStorage();
      storage.removeItem(DEMO_SESSION_KEY);
    },

    getSessionUser(): { authenticated: boolean; user: AuthUser | null } {
      if (!this.isSessionActive()) {
        return { authenticated: false, user: null };
      }
      return {
        authenticated: true,
        user: { ...STATIC_DEMO_USER },
      };
    },

    getBootstrap(): BootstrapData {
      const state = readSandbox(getStorage(), getNow());
      return buildBootstrapFromState(state);
    },

    resetWorkspace(): { success: boolean; mode: 'demo'; message: string } {
      const storage = getStorage();
      const fresh = buildFreshSandboxEnvelope(getNow());
      saveSandbox(storage, fresh);
      return {
        success: true,
        mode: 'demo',
        message: 'Demo account reset with fresh 6-month dynamic data from demo file. Real data is untouched.',
      };
    },

    getPaginated<T>(
      endpoint: string,
      params: Record<string, string | number | boolean | null | undefined>
    ): PaginatedResponse<T> {
      const state = readSandbox(getStorage(), getNow());
      const todayStr = getLocalPakistanDate(getNow());
      const queryObj: Record<string, unknown> = { ...params };
      const { limit, skip, search, sortKey, sortDir, all } = parseServerPaginationParams(queryObj);

      if (endpoint === '/api/sales') {
        const startDate = params.startDate ? String(params.startDate) : '';
        const endDate = params.endDate ? String(params.endDate) : '';
        const type = params.type ? String(params.type) : '';
        const shopIdRaw = params.shopId ? String(params.shopId) : '';
        const shopIdFilter = shopIdRaw && shopIdRaw !== 'ALL' ? parseInt(shopIdRaw, 10) : null;
        const datePreset = params.datePreset ? String(params.datePreset) : '';

        let filtered = buildEnrichedSales(state);
        if (datePreset === 'TODAY') {
          filtered = filtered.filter((s) => s.saleDate === todayStr);
        } else if (datePreset === 'MONTH') {
          filtered = filtered.filter((s) => s.saleDate.startsWith(todayStr.slice(0, 7)));
        }
        if (startDate) {
          filtered = filtered.filter((s) => s.saleDate >= startDate);
        }
        if (endDate) {
          filtered = filtered.filter((s) => s.saleDate <= endDate);
        }
        if (type && type !== 'ALL') {
          filtered = filtered.filter((s) => s.saleType === type);
        }
        if (shopIdFilter && Number.isFinite(shopIdFilter)) {
          filtered = filtered.filter((s) => s.shopId === shopIdFilter);
        }
        if (search) {
          filtered = filtered.filter(
            (s) =>
              s.invoiceNumber.toLowerCase().includes(search) ||
              (s.shopName && s.shopName.toLowerCase().includes(search)) ||
              (s.notes && s.notes.toLowerCase().includes(search)) ||
              (s.saleType === 'OWN_SHOP' && 'walk-in shop'.includes(search))
          );
        }

        if (all) {
          return { items: filtered as unknown as T[], total: filtered.length, limit: filtered.length, skip: 0, hasMore: false };
        }
        return sortAndPaginateRecords({
          records: filtered,
          limit,
          skip,
          sortKey: sortKey || 'saleDate',
          sortDir,
          getSortValue: (row, key) => {
            if (key === 'channel') {
              return row.saleType === 'OWN_SHOP' ? 'Walk-in Shop' : row.shopName || 'Other Shop';
            }
            return (row as unknown as Record<string, unknown>)[key];
          },
        }) as unknown as PaginatedResponse<T>;
      }

      if (endpoint === '/api/purchases') {
        const statusFilter = params.status ? String(params.status) : '';
        const supplierIdRaw = params.supplierId ? String(params.supplierId) : '';
        const supplierIdFilter =
          supplierIdRaw && supplierIdRaw !== 'ALL' ? parseInt(supplierIdRaw, 10) : null;
        const startDate = params.startDate ? String(params.startDate) : '';
        const endDate = params.endDate ? String(params.endDate) : '';

        let enriched = buildEnrichedPurchases(state);
        if (statusFilter && statusFilter !== 'ALL') {
          enriched = enriched.filter((l) => l.status === statusFilter);
        }
        if (supplierIdFilter && Number.isFinite(supplierIdFilter)) {
          enriched = enriched.filter((l) => l.supplierId === supplierIdFilter);
        }
        if (startDate) {
          enriched = enriched.filter((l) => l.purchaseDate >= startDate);
        }
        if (endDate) {
          enriched = enriched.filter((l) => l.purchaseDate <= endDate);
        }
        if (search) {
          enriched = enriched.filter(
            (l) =>
              l.loadNumber.toLowerCase().includes(search) ||
              l.supplierName.toLowerCase().includes(search) ||
              (l.vehicleNumber && l.vehicleNumber.toLowerCase().includes(search)) ||
              (l.driverName && l.driverName.toLowerCase().includes(search)) ||
              (l.notes && l.notes.toLowerCase().includes(search))
          );
        }

        if (all) {
          return { items: enriched as unknown as T[], total: enriched.length, limit: enriched.length, skip: 0, hasMore: false };
        }
        return sortAndPaginateRecords({
          records: enriched,
          limit,
          skip,
          sortKey: sortKey || 'purchaseDate',
          sortDir,
        }) as unknown as PaginatedResponse<T>;
      }

      if (endpoint === '/api/inventory/batches') {
        const effectiveSortDir = params.sortDir ? sortDir : 'asc';
        const statusFilter = params.status ? String(params.status) : '';
        const startDate = params.startDate ? String(params.startDate) : '';
        const endDate = params.endDate ? String(params.endDate) : '';

        let filtered = buildEnrichedBatches(state);
        if (statusFilter === 'ACTIVE') {
          filtered = filtered.filter((b) => !b.isClosed && Number(b.remainingPieces) > 0);
        } else if (statusFilter === 'DEPLETED') {
          filtered = filtered.filter((b) => b.isClosed || Number(b.remainingPieces) === 0);
        }
        if (startDate) {
          filtered = filtered.filter((b) => b.receivingDate >= startDate);
        }
        if (endDate) {
          filtered = filtered.filter((b) => b.receivingDate <= endDate);
        }
        if (search) {
          filtered = filtered.filter(
            (b) =>
              b.batchNumber.toLowerCase().includes(search) ||
              (b.loadNumber && b.loadNumber.toLowerCase().includes(search)) ||
              (b.supplierName && b.supplierName.toLowerCase().includes(search)) ||
              (b.notes && b.notes.toLowerCase().includes(search))
          );
        }

        if (all) {
          return { items: filtered as unknown as T[], total: filtered.length, limit: filtered.length, skip: 0, hasMore: false };
        }
        return sortAndPaginateRecords({
          records: filtered,
          limit,
          skip,
          sortKey: sortKey || 'receivingDate',
          sortDir: effectiveSortDir,
          getSortValue: (row, key) => {
            if (key === 'status') {
              return row.isClosed ? 0 : row.remainingPieces;
            }
            return (row as unknown as Record<string, unknown>)[key];
          },
        }) as unknown as PaginatedResponse<T>;
      }

      if (endpoint === '/api/inventory/movements') {
        const typeFilter = params.type ? String(params.type) : '';
        const batchIdRaw = params.stockBatchId ? String(params.stockBatchId) : '';
        const batchIdFilter = batchIdRaw ? parseInt(batchIdRaw, 10) : null;

        let filtered = buildEnrichedMovements(state);
        if (typeFilter && typeFilter !== 'ALL') {
          filtered = filtered.filter((m) => m.movementType === typeFilter);
        }
        if (batchIdFilter && Number.isFinite(batchIdFilter)) {
          filtered = filtered.filter((m) => m.stockBatchId === batchIdFilter);
        }
        if (search) {
          filtered = filtered.filter(
            (m) =>
              m.batchNumber.toLowerCase().includes(search) ||
              m.movementType.toLowerCase().includes(search) ||
              (m.notes && m.notes.toLowerCase().includes(search))
          );
        }

        if (all) {
          return { items: filtered as unknown as T[], total: filtered.length, limit: filtered.length, skip: 0, hasMore: false };
        }
        return sortAndPaginateRecords({
          records: filtered,
          limit,
          skip,
          sortKey: sortKey || 'createdAt',
          sortDir,
        }) as unknown as PaginatedResponse<T>;
      }

      if (endpoint === '/api/dealer-ledger') {
        const supplierIdRaw = params.supplierId ? String(params.supplierId) : '';
        const supplierIdFilter =
          supplierIdRaw && supplierIdRaw !== 'ALL' ? parseInt(supplierIdRaw, 10) : null;
        const typeFilter = params.type ? String(params.type) : '';
        const startDate = params.startDate ? String(params.startDate) : '';
        const endDate = params.endDate ? String(params.endDate) : '';

        let filtered = buildEnrichedDealerTransactions(state);
        if (supplierIdFilter && Number.isFinite(supplierIdFilter)) {
          filtered = filtered.filter((t) => t.supplierId === supplierIdFilter);
        }
        if (typeFilter && typeFilter !== 'ALL') {
          filtered = filtered.filter((t) => t.transactionType === typeFilter);
        }
        if (startDate) {
          filtered = filtered.filter((t) => t.transactionDate >= startDate);
        }
        if (endDate) {
          filtered = filtered.filter((t) => t.transactionDate <= endDate);
        }
        if (search) {
          filtered = filtered.filter(
            (t) =>
              (t.supplierName && t.supplierName.toLowerCase().includes(search)) ||
              (t.notes && t.notes.toLowerCase().includes(search)) ||
              (t.paymentMethod && t.paymentMethod.toLowerCase().includes(search)) ||
              (t.referenceType && t.referenceType.toLowerCase().includes(search))
          );
        }

        if (all) {
          return { items: filtered as unknown as T[], total: filtered.length, limit: filtered.length, skip: 0, hasMore: false };
        }
        return sortAndPaginateRecords({
          records: filtered,
          limit,
          skip,
          sortKey: sortKey || 'transactionDate',
          sortDir,
        }) as unknown as PaginatedResponse<T>;
      }

      if (endpoint === '/api/expenses') {
        const categoryFilter = params.category ? String(params.category) : '';
        const methodFilter = params.paymentMethod ? String(params.paymentMethod) : '';
        const startDate = params.startDate ? String(params.startDate) : '';
        const endDate = params.endDate ? String(params.endDate) : '';

        let filtered = [...state.businessExpenses].sort(
          (a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.id - a.id
        );
        if (categoryFilter && categoryFilter !== 'ALL') {
          filtered = filtered.filter((e) => e.category === categoryFilter);
        }
        if (methodFilter && methodFilter !== 'ALL') {
          filtered = filtered.filter((e) => e.paymentMethod === methodFilter);
        }
        if (startDate) {
          filtered = filtered.filter((e) => e.expenseDate >= startDate);
        }
        if (endDate) {
          filtered = filtered.filter((e) => e.expenseDate <= endDate);
        }
        if (search) {
          filtered = filtered.filter(
            (e) =>
              e.category.toLowerCase().includes(search) ||
              (e.description && e.description.toLowerCase().includes(search)) ||
              (e.paymentMethod && e.paymentMethod.toLowerCase().includes(search))
          );
        }

        if (all) {
          return { items: filtered as unknown as T[], total: filtered.length, limit: filtered.length, skip: 0, hasMore: false };
        }
        return sortAndPaginateRecords({
          records: filtered,
          limit,
          skip,
          sortKey: sortKey || 'expenseDate',
          sortDir,
        }) as unknown as PaginatedResponse<T>;
      }

      if (endpoint === '/api/worker-payments') {
        const workerIdRaw = params.workerId ? String(params.workerId) : '';
        const workerIdFilter = workerIdRaw && workerIdRaw !== 'ALL' ? parseInt(workerIdRaw, 10) : null;
        const startDate = params.startDate ? String(params.startDate) : '';
        const endDate = params.endDate ? String(params.endDate) : '';

        let filtered = buildEnrichedWorkerPayments(state);
        if (workerIdFilter && Number.isFinite(workerIdFilter)) {
          filtered = filtered.filter((p) => p.workerId === workerIdFilter);
        }
        if (startDate) {
          filtered = filtered.filter((p) => p.paymentDate >= startDate);
        }
        if (endDate) {
          filtered = filtered.filter((p) => p.paymentDate <= endDate);
        }
        if (search) {
          filtered = filtered.filter(
            (p) =>
              (p.workerName && p.workerName.toLowerCase().includes(search)) ||
              (p.description && p.description.toLowerCase().includes(search)) ||
              (p.paymentMethod && p.paymentMethod.toLowerCase().includes(search))
          );
        }

        if (all) {
          return { items: filtered as unknown as T[], total: filtered.length, limit: filtered.length, skip: 0, hasMore: false };
        }
        return sortAndPaginateRecords({
          records: filtered,
          limit,
          skip,
          sortKey: sortKey || 'paymentDate',
          sortDir,
        }) as unknown as PaginatedResponse<T>;
      }

      throw new Error(`Unsupported demo endpoint: ${endpoint}`);
    },

    updateSettings(data: Partial<AppSettings>): { success: boolean } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      state.settings = {
        ...state.settings,
        ...(data.businessName !== undefined ? { businessName: String(data.businessName) } : {}),
        ...(data.businessLocation !== undefined ? { businessLocation: String(data.businessLocation) } : {}),
        ...(data.examplePrice1 !== undefined ? { examplePrice1: String(data.examplePrice1) } : {}),
        ...(data.examplePrice2 !== undefined ? { examplePrice2: String(data.examplePrice2) } : {}),
        ...(data.lowStockThreshold !== undefined ? { lowStockThreshold: String(data.lowStockThreshold) } : {}),
      };
      saveSandbox(storage, state);
      return { success: true };
    },

    createSupplier(data: Partial<Supplier>): Supplier {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      if (!data.name || !data.name.trim()) {
        throw new Error('Supplier name is required');
      }
      const parsedBal = Number(data.openingBalance ?? 0);
      const opBal = Number.isFinite(parsedBal) ? parsedBal : 0;
      const id = nextSeqId(state);
      const nowIso = now.toISOString();
      const created: Supplier = {
        id,
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        openingBalance: opBal.toFixed(2),
        notes: data.notes?.trim() || null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      state.suppliers.push(created);

      if (opBal !== 0) {
        state.dealerTransactions.push({
          id: nextSeqId(state),
          supplierId: id,
          transactionDate: getLocalPakistanDate(now),
          transactionType: opBal > 0 ? 'PURCHASE_DEBIT' : 'PAYMENT_CREDIT',
          debitAmount: opBal > 0 ? opBal.toFixed(2) : '0.00',
          creditAmount: opBal < 0 ? Math.abs(opBal).toFixed(2) : '0.00',
          balanceAfter: opBal.toFixed(2),
          referenceType: 'OPENING_BALANCE',
          referenceId: null,
          paymentMethod: null,
          notes: 'Initial Opening Balance',
          createdAt: nowIso,
        });
      }

      saveSandbox(storage, state);
      return {
        ...created,
        currentBalance: opBal,
        totalPurchasesAmount: 0,
        purchaseCount: 0,
      };
    },

    deleteSupplier(id: number): { success: boolean } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const sup = state.suppliers.find((s) => s.id === id);
      if (!sup) {
        throw new Error('Supplier not found');
      }
      const loads = state.purchaseLoads.filter((l) => l.supplierId === id);
      for (const load of loads) {
        deletePurchaseLoadCascadeInSandbox(state, load.id);
      }
      state.dealerTransactions = state.dealerTransactions.filter((t) => t.supplierId !== id);
      state.suppliers = state.suppliers.filter((s) => s.id !== id);
      saveSandbox(storage, state);
      return { success: true };
    },

    recordSupplierPayment(data: {
      supplierId: number;
      amount: number;
      transactionDate?: string;
      paymentMethod?: string;
      notes?: string;
    }): DealerTransaction {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      const sup = state.suppliers.find((s) => s.id === data.supplierId);
      if (!sup) {
        throw new Error('Supplier not found');
      }
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error('Valid supplier and positive payment amount are required');
      }
      const supTxs = state.dealerTransactions
        .filter((t) => t.supplierId === sup.id)
        .sort((a, b) => b.id - a.id);
      const prevBal = supTxs.length > 0 ? Number(supTxs[0].balanceAfter) : Number(sup.openingBalance);
      const newBal = Number((prevBal - data.amount).toFixed(2));
      const created: StoredRawDealerTx = {
        id: nextSeqId(state),
        supplierId: sup.id,
        transactionDate: data.transactionDate || getLocalPakistanDate(now),
        transactionType: 'PAYMENT_CREDIT',
        debitAmount: '0.00',
        creditAmount: data.amount.toFixed(2),
        balanceAfter: newBal.toFixed(2),
        referenceType: 'PAYMENT',
        referenceId: null,
        paymentMethod: data.paymentMethod || 'CASH',
        notes: data.notes?.trim() || null,
        createdAt: now.toISOString(),
      };
      state.dealerTransactions.push(created);
      recomputeSupplierBalancesInSandbox(state, sup.id);
      const finalRow = state.dealerTransactions.find((t) => t.id === created.id) || created;
      saveSandbox(storage, state);
      return { ...finalRow, supplierName: sup.name };
    },

    deleteDealerTransaction(id: number): { success: boolean; cascadedLoad?: boolean } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const entry = state.dealerTransactions.find((t) => t.id === id);
      if (!entry) {
        throw new Error('Dealer transaction not found');
      }

      if (entry.referenceType === 'PURCHASE_LOAD' && entry.referenceId) {
        deletePurchaseLoadCascadeInSandbox(state, entry.referenceId);
        saveSandbox(storage, state);
        return { success: true, cascadedLoad: true };
      }

      if (entry.referenceType === 'OPENING_BALANCE') {
        state.suppliers = state.suppliers.map((s) =>
          s.id === entry.supplierId
            ? { ...s, openingBalance: '0.00', updatedAt: getNow().toISOString() }
            : s
        );
      }

      state.dealerTransactions = state.dealerTransactions.filter((t) => t.id !== id);
      recomputeSupplierBalancesInSandbox(state, entry.supplierId);
      saveSandbox(storage, state);
      return { success: true, cascadedLoad: false };
    },

    createPurchase(data: {
      supplierId: number;
      purchaseDate: string;
      totalWeightKg: number;
      purchaseAmount: number;
      vehicleNumber?: string;
      driverName?: string;
      notes?: string;
    }): PurchaseLoad {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      const sup = state.suppliers.find((s) => s.id === data.supplierId);
      if (!sup) {
        throw new Error('Supplier not found');
      }
      if (data.totalWeightKg <= 0 || data.purchaseAmount <= 0) {
        throw new Error('Valid supplier, total weight in KG, and total purchase amount are required');
      }

      const dateStr = data.purchaseDate || getLocalPakistanDate(now);
      const seq = state.purchaseLoads.length + 1;
      let loadNumber = `LOAD-${dateStr.replace(/-/g, '')}-${String(seq).padStart(3, '0')}`;
      if (state.purchaseLoads.some((l) => l.loadNumber === loadNumber)) {
        loadNumber = `LOAD-${dateStr.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;
      }

      const loadId = nextSeqId(state);
      const nowIso = now.toISOString();
      const newLoad: StoredRawPurchaseLoad = {
        id: loadId,
        loadNumber,
        supplierId: sup.id,
        purchaseDate: dateStr,
        totalWeightKg: data.totalWeightKg.toFixed(2),
        purchaseAmount: data.purchaseAmount.toFixed(2),
        vehicleNumber: data.vehicleNumber?.trim() || null,
        driverName: data.driverName?.trim() || null,
        status: 'PENDING_RECEIVING',
        notes: data.notes?.trim() || null,
        createdAt: nowIso,
      };
      state.purchaseLoads.push(newLoad);

      const supTxs = state.dealerTransactions
        .filter((t) => t.supplierId === sup.id)
        .sort((a, b) => b.id - a.id);
      const prevBal = supTxs.length > 0 ? Number(supTxs[0].balanceAfter) : Number(sup.openingBalance);
      const newBal = Number((prevBal + data.purchaseAmount).toFixed(2));
      const rate = calculatePurchaseRate(data.purchaseAmount, data.totalWeightKg);

      state.dealerTransactions.push({
        id: nextSeqId(state),
        supplierId: sup.id,
        transactionDate: dateStr,
        transactionType: 'PURCHASE_DEBIT',
        debitAmount: data.purchaseAmount.toFixed(2),
        creditAmount: '0.00',
        balanceAfter: newBal.toFixed(2),
        referenceType: 'PURCHASE_LOAD',
        referenceId: loadId,
        paymentMethod: null,
        notes: `Purchase Load ${loadNumber} (${data.totalWeightKg} KG @ PKR ${rate}/KG)`,
        createdAt: nowIso,
      });

      saveSandbox(storage, state);
      return {
        ...newLoad,
        supplierName: sup.name,
        supplierPhone: sup.phone || undefined,
        expenses: [],
        purchaseRatePerKg: rate,
        totalExpenses: 0,
        totalLandedCost: data.purchaseAmount,
        stockBatch: null,
      };
    },

    addLoadExpense(
      loadId: number,
      data: { category: string; amount: number; expenseDate?: string; description?: string }
    ): LoadExpense {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      const load = state.purchaseLoads.find((l) => l.id === loadId);
      if (!load) {
        throw new Error('Purchase load not found');
      }
      if (!data.category || !Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error('Category and positive amount are required');
      }

      const created: LoadExpense = {
        id: nextSeqId(state),
        purchaseLoadId: loadId,
        category: data.category,
        amount: data.amount.toFixed(2),
        expenseDate: data.expenseDate || getLocalPakistanDate(now),
        description: data.description?.trim() || null,
        createdAt: now.toISOString(),
      };
      state.loadExpenses.push(created);

      const batch = state.stockBatches.find((b) => b.purchaseLoadId === loadId);
      if (batch) {
        const totalExp = state.loadExpenses
          .filter((e) => e.purchaseLoadId === loadId)
          .reduce((sum, e) => sum + Number(e.amount), 0);
        const landed = calculateLandedCost(Number(load.purchaseAmount), totalExp);
        const costPerPiece = calculateCostPerPiece(landed, batch.originalSaleablePieces);
        state.stockBatches = state.stockBatches.map((b) =>
          b.id === batch.id
            ? {
                ...b,
                totalLoadExpenses: totalExp.toFixed(2),
                totalLandedCost: landed.toFixed(2),
                costPerPiece: costPerPiece.toFixed(2),
              }
            : b
        );
      }

      saveSandbox(storage, state);
      return created;
    },

    deleteLoadExpense(loadId: number, expenseId: number): { success: boolean } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const load = state.purchaseLoads.find((l) => l.id === loadId);
      if (!load) {
        throw new Error('Purchase load not found');
      }
      state.loadExpenses = state.loadExpenses.filter(
        (e) => !(e.id === expenseId && e.purchaseLoadId === loadId)
      );

      const batch = state.stockBatches.find((b) => b.purchaseLoadId === loadId);
      if (batch) {
        const totalExp = state.loadExpenses
          .filter((e) => e.purchaseLoadId === loadId)
          .reduce((sum, e) => sum + Number(e.amount), 0);
        const landed = calculateLandedCost(Number(load.purchaseAmount), totalExp);
        const costPerPiece = calculateCostPerPiece(landed, batch.originalSaleablePieces);
        state.stockBatches = state.stockBatches.map((b) =>
          b.id === batch.id
            ? {
                ...b,
                totalLoadExpenses: totalExp.toFixed(2),
                totalLandedCost: landed.toFixed(2),
                costPerPiece: costPerPiece.toFixed(2),
              }
            : b
        );
      }

      saveSandbox(storage, state);
      return { success: true };
    },

    deletePurchase(id: number): { success: boolean } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const res = deletePurchaseLoadCascadeInSandbox(state, id);
      if (!res.found) {
        throw new Error('Purchase load not found');
      }
      saveSandbox(storage, state);
      return { success: true };
    },

    receiveStock(
      loadId: number,
      data: {
        receivingDate: string;
        receivedPieces: number;
        deadPieces?: number;
        damagedPieces?: number;
        notes?: string;
      }
    ): StockBatch {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      const load = state.purchaseLoads.find((l) => l.id === loadId);
      if (!load) {
        throw new Error('Purchase load not found');
      }
      const existingBatch = state.stockBatches.find((b) => b.purchaseLoadId === loadId);
      if (existingBatch) {
        throw new Error(`Stock batch ${existingBatch.batchNumber} has already been received for this load.`);
      }
      if (!Number.isFinite(data.receivedPieces) || data.receivedPieces <= 0) {
        throw new Error('Actual received pieces must be greater than zero');
      }

      const dead = Number(data.deadPieces || 0);
      const damaged = Number(data.damagedPieces || 0);
      const saleablePieces = calculateSaleablePieces(data.receivedPieces, dead, damaged);
      const totalLoadExpenses = state.loadExpenses
        .filter((e) => e.purchaseLoadId === loadId)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const totalLandedCost = calculateLandedCost(Number(load.purchaseAmount), totalLoadExpenses);
      const costPerPiece = calculateCostPerPiece(totalLandedCost, saleablePieces);

      const batchId = nextSeqId(state);
      const nowIso = now.toISOString();
      const batchNumber = `BATCH-${load.loadNumber}`;
      const createdBatch: StoredRawBatch = {
        id: batchId,
        batchNumber,
        purchaseLoadId: loadId,
        receivingDate: data.receivingDate || getLocalPakistanDate(now),
        receivedPieces: data.receivedPieces,
        deadPieces: dead,
        damagedPieces: damaged,
        originalSaleablePieces: saleablePieces,
        soldPieces: 0,
        remainingPieces: saleablePieces,
        purchaseAmount: load.purchaseAmount,
        totalLoadExpenses: totalLoadExpenses.toFixed(2),
        totalLandedCost: totalLandedCost.toFixed(2),
        costPerPiece: costPerPiece.toFixed(2),
        isClosed: saleablePieces === 0,
        notes: data.notes?.trim() || null,
        createdAt: nowIso,
      };
      state.stockBatches.push(createdBatch);

      if (saleablePieces > 0) {
        state.stockMovements.push({
          id: nextSeqId(state),
          stockBatchId: batchId,
          movementType: 'STOCK_IN',
          quantity: saleablePieces,
          balanceAfter: saleablePieces,
          unitCost: costPerPiece.toFixed(2),
          referenceType: 'PURCHASE_LOAD',
          referenceId: loadId,
          notes: `Received ${data.receivedPieces} pcs (${dead} dead, ${damaged} damaged). Saleable: ${saleablePieces}`,
          createdAt: nowIso,
        });
      }

      state.purchaseLoads = state.purchaseLoads.map((l) =>
        l.id === loadId ? { ...l, status: 'RECEIVED' } : l
      );

      saveSandbox(storage, state);
      const sup = state.suppliers.find((s) => s.id === load.supplierId);
      return {
        ...createdBatch,
        loadNumber: load.loadNumber,
        supplierName: sup?.name,
      };
    },

    adjustStock(data: {
      stockBatchId: number;
      quantityChange: number;
      reason: string;
      adjustmentType?: string;
    }): StockMovement {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      const batch = state.stockBatches.find((b) => b.id === data.stockBatchId);
      if (!batch) {
        throw new Error('Stock batch not found');
      }
      if (!Number.isFinite(data.quantityChange) || data.quantityChange === 0) {
        throw new Error('Valid batch and non-zero adjustment quantity required');
      }
      const newRemaining = batch.remainingPieces + data.quantityChange;
      if (newRemaining < 0) {
        throw new Error(
          `Cannot reduce stock below zero. Current stock is ${batch.remainingPieces}`
        );
      }

      state.stockBatches = state.stockBatches.map((b) =>
        b.id === batch.id
          ? { ...b, remainingPieces: newRemaining, isClosed: newRemaining === 0 }
          : b
      );

      const movType = (data.adjustmentType ||
        (data.quantityChange < 0 ? 'DAMAGE' : 'ADJUSTMENT')) as StockMovement['movementType'];

      const mov: StoredRawMovement = {
        id: nextSeqId(state),
        stockBatchId: batch.id,
        movementType: movType,
        quantity: data.quantityChange,
        balanceAfter: newRemaining,
        unitCost: batch.costPerPiece,
        referenceType: 'MANUAL_ADJUSTMENT',
        referenceId: batch.id,
        notes: data.reason?.trim() || 'Manual stock count adjustment',
        createdAt: now.toISOString(),
      };
      state.stockMovements.push(mov);

      saveSandbox(storage, state);
      return { ...mov, batchNumber: batch.batchNumber };
    },

    deleteBatch(id: number): { success: boolean; deletedSalesCount?: number } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const res = deleteBatchCascadeInSandbox(state, id, true);
      if (!res.found) {
        throw new Error('Stock batch not found');
      }
      saveSandbox(storage, state);
      return { success: true, deletedSalesCount: res.deletedSalesCount };
    },

    deleteMovement(id: number): { success: boolean; action?: string } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const mov = state.stockMovements.find((m) => m.id === id);
      if (!mov) {
        throw new Error('Stock movement not found');
      }

      if (
        (mov.referenceType === 'SALE' || mov.referenceType === 'SHOP_DISTRIBUTION') &&
        mov.referenceId
      ) {
        deleteSaleCascadeInSandbox(state, mov.referenceId);
        saveSandbox(storage, state);
        return { success: true, action: 'deleted_sale' };
      }

      if (mov.referenceType === 'PURCHASE_LOAD') {
        deleteBatchCascadeInSandbox(state, mov.stockBatchId, true);
        saveSandbox(storage, state);
        return { success: true, action: 'deleted_batch' };
      }

      const batch = state.stockBatches.find((b) => b.id === mov.stockBatchId);
      if (batch) {
        const reversal = applyMovementDeletionToBatch(batch, mov.quantity);
        if (!reversal.ok) {
          throw new Error(reversal.error);
        }
        state.stockBatches = state.stockBatches.map((b) =>
          b.id === batch.id ? reversal.batch : b
        );
      }

      state.stockMovements = state.stockMovements.filter((m) => m.id !== id);
      saveSandbox(storage, state);
      return { success: true, action: 'deleted_adjustment' };
    },

    createOwnShopSale(data: {
      saleDate: string;
      quantityPieces: number;
      totalSaleAmount: number;
      notes?: string;
    }): { sale: Sale; summary: unknown } {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      if (data.quantityPieces <= 0 || data.totalSaleAmount <= 0) {
        throw new Error('Please enter a valid quantity of pieces and total sale amount in PKR');
      }

      const availableBatches = [...state.stockBatches]
        .filter((b) => !b.isClosed && b.remainingPieces > 0)
        .sort((a, b) => a.receivingDate.localeCompare(b.receivingDate) || a.id - b.id);

      const totalAvail = availableBatches.reduce((sum, b) => sum + b.remainingPieces, 0);
      if (data.quantityPieces > totalAvail) {
        throw new Error(
          `Insufficient stock! Requested: ${data.quantityPieces} pieces, Available: ${totalAvail} pieces. Negative inventory is not allowed.`
        );
      }

      const fifoResult = consumeBatchesFifo(
        availableBatches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          remainingPieces: b.remainingPieces,
          costPerPiece: Number(b.costPerPiece),
        })),
        data.quantityPieces
      );
      if (fifoResult.remainingShortfall > 0) {
        throw new Error('FIFO stock calculation shortfall error');
      }

      const metrics = calculateSaleMetrics(
        data.totalSaleAmount,
        data.quantityPieces,
        fifoResult.totalCost
      );
      const dateStr = data.saleDate || getLocalPakistanDate(now);
      let invoiceNumber = `INV-${dateStr.replace(/-/g, '')}-${String(state.sales.length + 1).padStart(4, '0')}`;
      if (state.sales.some((s) => s.invoiceNumber === invoiceNumber)) {
        invoiceNumber = `INV-${dateStr.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;
      }

      const saleId = nextSeqId(state);
      const nowIso = now.toISOString();
      const savedSale: StoredRawSale = {
        id: saleId,
        invoiceNumber,
        saleType: 'OWN_SHOP',
        saleDate: dateStr,
        shopId: null,
        totalPieces: data.quantityPieces,
        totalAmount: data.totalSaleAmount.toFixed(2),
        totalCost: fifoResult.totalCost.toFixed(2),
        totalProfit: metrics.totalProfit.toFixed(2),
        sellingPricePerPiece: metrics.sellingPricePerPiece.toFixed(2),
        costPerPiece: metrics.costPerPiece.toFixed(2),
        profitPerPiece: metrics.profitPerPiece.toFixed(2),
        notes: data.notes?.trim() || null,
        createdAt: nowIso,
      };
      state.sales.push(savedSale);

      for (const item of fifoResult.consumedBatches) {
        state.saleItems.push({
          id: nextSeqId(state),
          saleId,
          stockBatchId: item.batchId,
          quantity: item.quantity,
          unitCost: item.unitCost.toFixed(2),
          totalCost: item.totalCost.toFixed(2),
        });

        let newRemaining = 0;
        state.stockBatches = state.stockBatches.map((b) => {
          if (b.id !== item.batchId) return b;
          newRemaining = b.remainingPieces - item.quantity;
          return {
            ...b,
            remainingPieces: newRemaining,
            soldPieces: b.soldPieces + item.quantity,
            isClosed: newRemaining === 0,
          };
        });

        state.stockMovements.push({
          id: nextSeqId(state),
          stockBatchId: item.batchId,
          movementType: 'SALE_OUT',
          quantity: -item.quantity,
          balanceAfter: newRemaining,
          unitCost: item.unitCost.toFixed(2),
          referenceType: 'SALE',
          referenceId: saleId,
          notes: `Own shop sale ${invoiceNumber}: ${item.quantity} pcs @ PKR ${item.unitCost}/pc`,
          createdAt: nowIso,
        });
      }

      saveSandbox(storage, state);
      return {
        sale: { ...savedSale, shopName: null },
        summary: {
          invoiceNumber,
          pieces: data.quantityPieces,
          totalAmount: data.totalSaleAmount,
          totalCost: fifoResult.totalCost,
          totalProfit: metrics.totalProfit,
          sellingPricePerPiece: metrics.sellingPricePerPiece,
          costPerPiece: metrics.costPerPiece,
          profitPerPiece: metrics.profitPerPiece,
          batchesConsumed: fifoResult.consumedBatches,
        },
      };
    },

    createWholesaleSale(data: {
      shopId: number;
      saleDate: string;
      quantityPieces: number;
      totalSaleAmount: number;
      notes?: string;
    }): { sale: Sale; summary: unknown } {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      const targetShop = state.shops.find((s) => s.id === data.shopId);
      if (!targetShop) {
        throw new Error('Selected shop not found');
      }
      if (data.quantityPieces <= 0 || data.totalSaleAmount <= 0) {
        throw new Error('Valid wholesale shop, quantity in pieces, and total sale amount are required');
      }

      const availableBatches = [...state.stockBatches]
        .filter((b) => !b.isClosed && b.remainingPieces > 0)
        .sort((a, b) => a.receivingDate.localeCompare(b.receivingDate) || a.id - b.id);

      const totalAvail = availableBatches.reduce((sum, b) => sum + b.remainingPieces, 0);
      if (data.quantityPieces > totalAvail) {
        throw new Error(
          `Insufficient stock! Requested: ${data.quantityPieces} pieces, Available: ${totalAvail} pieces.`
        );
      }

      const fifoResult = consumeBatchesFifo(
        availableBatches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          remainingPieces: b.remainingPieces,
          costPerPiece: Number(b.costPerPiece),
        })),
        data.quantityPieces
      );
      const metrics = calculateSaleMetrics(
        data.totalSaleAmount,
        data.quantityPieces,
        fifoResult.totalCost
      );
      const dateStr = data.saleDate || getLocalPakistanDate(now);
      let invoiceNumber = `WHL-${dateStr.replace(/-/g, '')}-${String(state.sales.length + 1).padStart(4, '0')}`;
      if (state.sales.some((s) => s.invoiceNumber === invoiceNumber)) {
        invoiceNumber = `WHL-${dateStr.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;
      }

      const saleId = nextSeqId(state);
      const nowIso = now.toISOString();
      const savedSale: StoredRawSale = {
        id: saleId,
        invoiceNumber,
        saleType: 'WHOLESALE',
        saleDate: dateStr,
        shopId: targetShop.id,
        totalPieces: data.quantityPieces,
        totalAmount: data.totalSaleAmount.toFixed(2),
        totalCost: fifoResult.totalCost.toFixed(2),
        totalProfit: metrics.totalProfit.toFixed(2),
        sellingPricePerPiece: metrics.sellingPricePerPiece.toFixed(2),
        costPerPiece: metrics.costPerPiece.toFixed(2),
        profitPerPiece: metrics.profitPerPiece.toFixed(2),
        notes: data.notes?.trim() || null,
        createdAt: nowIso,
      };
      state.sales.push(savedSale);

      for (const item of fifoResult.consumedBatches) {
        state.saleItems.push({
          id: nextSeqId(state),
          saleId,
          stockBatchId: item.batchId,
          quantity: item.quantity,
          unitCost: item.unitCost.toFixed(2),
          totalCost: item.totalCost.toFixed(2),
        });

        let newRemaining = 0;
        state.stockBatches = state.stockBatches.map((b) => {
          if (b.id !== item.batchId) return b;
          newRemaining = b.remainingPieces - item.quantity;
          return {
            ...b,
            remainingPieces: newRemaining,
            soldPieces: b.soldPieces + item.quantity,
            isClosed: newRemaining === 0,
          };
        });

        state.stockMovements.push({
          id: nextSeqId(state),
          stockBatchId: item.batchId,
          movementType: 'WHOLESALE_OUT',
          quantity: -item.quantity,
          balanceAfter: newRemaining,
          unitCost: item.unitCost.toFixed(2),
          referenceType: 'SHOP_DISTRIBUTION',
          referenceId: saleId,
          notes: `Wholesale delivery ${invoiceNumber} to ${targetShop.shopName}: ${item.quantity} pcs`,
          createdAt: nowIso,
        });
      }

      saveSandbox(storage, state);
      return {
        sale: { ...savedSale, shopName: targetShop.shopName },
        summary: metrics,
      };
    },

    deleteSale(id: number): { success: boolean; restoredPieces?: number } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const res = deleteSaleCascadeInSandbox(state, id);
      if (!res.found) {
        throw new Error('Sale not found');
      }
      saveSandbox(storage, state);
      return { success: true, restoredPieces: res.restoredPieces };
    },

    createShop(data: Partial<Shop>): Shop {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      if (!data.shopName?.trim()) {
        throw new Error('Shop name is required');
      }
      const created: Shop = {
        id: nextSeqId(state),
        shopName: data.shopName.trim(),
        ownerName: data.ownerName?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
        totalPiecesDelivered: 0,
        totalSalesAmount: 0,
        ordersCount: 0,
        createdAt: now.toISOString(),
      };
      state.shops.push(created);
      saveSandbox(storage, state);
      return created;
    },

    deleteShop(id: number): { success: boolean } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const shop = state.shops.find((s) => s.id === id);
      if (!shop) {
        throw new Error('Shop not found');
      }
      const linkedSales = state.sales.filter((s) => s.shopId === id);
      for (const s of linkedSales) {
        deleteSaleCascadeInSandbox(state, s.id);
      }
      state.shops = state.shops.filter((s) => s.id !== id);
      saveSandbox(storage, state);
      return { success: true };
    },

    createWorker(data: Partial<Worker>): Worker {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      if (!data.name?.trim()) {
        throw new Error('Worker name is required');
      }
      const created: Worker = {
        id: nextSeqId(state),
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        notes: data.notes?.trim() || null,
        isActive: data.isActive !== false,
        totalPaid: 0,
        paymentCount: 0,
        createdAt: now.toISOString(),
      };
      state.workers.push(created);
      saveSandbox(storage, state);
      return created;
    },

    deleteWorker(id: number): { success: boolean } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const worker = state.workers.find((w) => w.id === id);
      if (!worker) {
        throw new Error('Worker not found');
      }
      state.workerPayments = state.workerPayments.filter((p) => p.workerId !== id);
      state.workers = state.workers.filter((w) => w.id !== id);
      saveSandbox(storage, state);
      return { success: true };
    },

    recordWorkerPayment(
      workerId: number,
      data: { amount: number; paymentDate?: string; paymentMethod?: string; description?: string }
    ): WorkerPayment {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      const worker = state.workers.find((w) => w.id === workerId);
      if (!worker) {
        throw new Error('Worker not found');
      }
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error('Positive payment amount required');
      }
      const created: StoredRawWorkerPayment = {
        id: nextSeqId(state),
        workerId,
        amount: data.amount.toFixed(2),
        paymentDate: data.paymentDate || getLocalPakistanDate(now),
        paymentMethod: data.paymentMethod || 'CASH',
        description: data.description?.trim() || null,
        createdAt: now.toISOString(),
      };
      state.workerPayments.push(created);
      saveSandbox(storage, state);
      return { ...created, workerName: worker.name };
    },

    deleteWorkerPayment(id: number): { success: boolean } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      const exists = state.workerPayments.some((p) => p.id === id);
      if (!exists) {
        throw new Error('Wage payment not found');
      }
      state.workerPayments = state.workerPayments.filter((p) => p.id !== id);
      saveSandbox(storage, state);
      return { success: true };
    },

    createExpense(data: {
      category: string;
      amount: number;
      expenseDate?: string;
      paymentMethod?: string;
      description?: string;
    }): BusinessExpense {
      const storage = getStorage();
      const now = getNow();
      const state = readSandbox(storage, now);
      if (!data.category || !Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error('Valid category and positive amount are required');
      }
      const created: BusinessExpense = {
        id: nextSeqId(state),
        category: data.category,
        amount: data.amount.toFixed(2),
        expenseDate: data.expenseDate || getLocalPakistanDate(now),
        paymentMethod: data.paymentMethod || 'CASH',
        description: data.description?.trim() || null,
        createdAt: now.toISOString(),
      };
      state.businessExpenses.push(created);
      saveSandbox(storage, state);
      return created;
    },

    deleteExpense(id: number): { success: boolean } {
      const storage = getStorage();
      const state = readSandbox(storage, getNow());
      state.businessExpenses = state.businessExpenses.filter((e) => e.id !== id);
      saveSandbox(storage, state);
      return { success: true };
    },
  };
}

export const demoLocalStore = createDemoLocalStore();

import { create } from 'zustand';
import {
  Supplier,
  PurchaseLoad,
  StockBatch,
  StockMovement,
  Sale,
  Shop,
  DealerTransaction,
  Worker,
  WorkerPayment,
  BusinessExpense,
  Vehicle,
  AppSettings,
} from '../types/index.ts';
import { api } from '../services/api.ts';
import {
  calculatePurchaseRate,
  calculateSaleablePieces,
  calculateLandedCost,
  calculateCostPerPiece,
  calculateSaleMetrics,
  consumeBatchesFifo,
} from '../utils/poultryMath.ts';
import { ToastMessage } from '../components/common/Toast.tsx';
import { createStoreMutationGuard } from '../utils/submitThrottle.ts';

const DEFAULT_SETTINGS: AppSettings = {
  businessName: 'Al-Madina Poultry Traders',
  businessLocation: 'Lahore Road, Punjab, Pakistan',
  examplePrice1: '1200',
  examplePrice2: '1500',
  lowStockThreshold: '300',
};

interface CoreDataState {
  suppliers: Supplier[];
  purchases: PurchaseLoad[];
  batches: StockBatch[];
  movements: StockMovement[];
  sales: Sale[];
  shops: Shop[];
  dealerTransactions: DealerTransaction[];
  workers: Worker[];
  workerPayments: WorkerPayment[];
  expenses: BusinessExpense[];
  vehicles: Vehicle[];
  settings: AppSettings;
}

interface AppStore extends CoreDataState {
  initialized: boolean;
  loading: boolean;
  syncingCount: number;
  lastSyncedAt: number | null;
  globalError: string | null;
  toasts: ToastMessage[];
  columnPrefs: Record<string, string[]>;

  // Toast & Error helpers
  addToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  setGlobalError: (msg: string | null) => void;
  clearGlobalError: () => void;
  setColumnPrefs: (tableId: string, cols: string[]) => void;

  // Hydration & Sync
  bootstrap: (options?: { force?: boolean; silent?: boolean }) => Promise<void>;
  refreshInBackground: () => Promise<void>;
  seedDemoData: (force?: boolean) => Promise<void>;

  // Optimistic Mutations with Background DB Sync + Rollback
  createPurchase: (data: {
    supplierId: number;
    purchaseDate: string;
    totalWeightKg: number;
    purchaseAmount: number;
    vehicleNumber?: string;
    driverName?: string;
    notes?: string;
  }) => Promise<PurchaseLoad>;

  addLoadExpense: (
    loadId: number,
    data: { category: string; amount: number; expenseDate?: string; description?: string }
  ) => Promise<void>;

  deleteLoadExpense: (loadId: number, expenseId: number) => Promise<void>;

  receiveStock: (
    loadId: number,
    data: {
      receivingDate: string;
      receivedPieces: number;
      deadPieces?: number;
      damagedPieces?: number;
      notes?: string;
    }
  ) => Promise<StockBatch>;

  adjustStock: (data: {
    stockBatchId: number;
    quantityChange: number;
    reason: string;
    adjustmentType?: string;
  }) => Promise<void>;

  createOwnShopSale: (data: {
    saleDate: string;
    quantityPieces: number;
    totalSaleAmount: number;
    notes?: string;
  }) => Promise<{ sale: Sale; summary: any }>;

  createWholesaleSale: (data: {
    shopId: number;
    saleDate: string;
    quantityPieces: number;
    totalSaleAmount: number;
    notes?: string;
  }) => Promise<{ sale: Sale; summary: any }>;

  createSupplier: (data: {
    name: string;
    phone?: string;
    address?: string;
    openingBalance?: string;
    notes?: string;
  }) => Promise<Supplier>;

  recordSupplierPayment: (data: {
    supplierId: number;
    amount: number;
    transactionDate?: string;
    paymentMethod?: string;
    notes?: string;
  }) => Promise<void>;

  createShop: (data: {
    shopName: string;
    ownerName?: string;
    phone?: string;
    address?: string;
    notes?: string;
  }) => Promise<Shop>;

  createWorker: (data: {
    name: string;
    phone?: string;
    notes?: string;
    isActive?: boolean;
  }) => Promise<Worker>;

  recordWorkerPayment: (
    workerId: number,
    data: { amount: number; paymentDate?: string; paymentMethod?: string; description?: string }
  ) => Promise<void>;

  createExpense: (data: {
    category: string;
    amount: number;
    expenseDate?: string;
    paymentMethod?: string;
    description?: string;
  }) => Promise<void>;

  deleteExpense: (id: number) => Promise<void>;

  updateSettings: (data: Partial<AppSettings>) => Promise<void>;
}

const loadStoredColumnPrefs = (): Record<string, string[]> => {
  try {
    const raw = localStorage.getItem('poultry_column_prefs_v1');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

function takeSnapshot(state: AppStore): CoreDataState {
  return {
    suppliers: state.suppliers,
    purchases: state.purchases,
    batches: state.batches,
    movements: state.movements,
    sales: state.sales,
    shops: state.shops,
    dealerTransactions: state.dealerTransactions,
    workers: state.workers,
    workerPayments: state.workerPayments,
    expenses: state.expenses,
    vehicles: state.vehicles,
    settings: state.settings,
  };
}

let activeBootstrapPromise: Promise<void> | null = null;
const mutationGuard = createStoreMutationGuard({ duplicateCooldownMs: 1500 });

export const useAppStore = create<AppStore>((set, get) => ({
  suppliers: [],
  purchases: [],
  batches: [],
  movements: [],
  sales: [],
  shops: [],
  dealerTransactions: [],
  workers: [],
  workerPayments: [],
  expenses: [],
  vehicles: [],
  settings: DEFAULT_SETTINGS,

  initialized: false,
  loading: true,
  syncingCount: 0,
  lastSyncedAt: null,
  globalError: null,
  toasts: [],
  columnPrefs: loadStoredColumnPrefs(),

  addToast: (text, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4500);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setGlobalError: (msg) => set({ globalError: msg }),
  clearGlobalError: () => set({ globalError: null }),

  setColumnPrefs: (tableId, cols) => {
    const next = { ...get().columnPrefs, [tableId]: cols };
    try {
      localStorage.setItem('poultry_column_prefs_v1', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
    set({ columnPrefs: next });
  },

  bootstrap: async (options) => {
    const { initialized, lastSyncedAt } = get();
    const force = options?.force ?? false;
    const silent = options?.silent ?? false;

    // Cache hit within 20 seconds unless forced
    if (!force && initialized && lastSyncedAt && Date.now() - lastSyncedAt < 20000) {
      return;
    }

    if (activeBootstrapPromise && !force) {
      return activeBootstrapPromise;
    }

    if (!silent && !initialized) {
      set({ loading: true });
    }

    activeBootstrapPromise = api
      .getBootstrap()
      .then((data) => {
        set({
          suppliers: data.suppliers,
          purchases: data.purchases,
          batches: data.batches,
          movements: data.movements,
          sales: data.sales,
          shops: data.shops,
          dealerTransactions: data.dealerTransactions,
          workers: data.workers,
          workerPayments: data.workerPayments,
          expenses: data.expenses,
          vehicles: data.vehicles,
          settings: data.settings,
          initialized: true,
          loading: false,
          lastSyncedAt: Date.now(),
          globalError: null,
        });
      })
      .catch((err: any) => {
        const msg = err?.message || 'Could not sync with server database.';
        set({
          loading: false,
          globalError: msg,
        });
        get().addToast(msg, 'error');
      })
      .finally(() => {
        activeBootstrapPromise = null;
      });

    return activeBootstrapPromise;
  },

  refreshInBackground: async () => {
    try {
      const data = await api.getBootstrap();
      set({
        suppliers: data.suppliers,
        purchases: data.purchases,
        batches: data.batches,
        movements: data.movements,
        sales: data.sales,
        shops: data.shops,
        dealerTransactions: data.dealerTransactions,
        workers: data.workers,
        workerPayments: data.workerPayments,
        expenses: data.expenses,
        vehicles: data.vehicles,
        settings: data.settings,
        initialized: true,
        lastSyncedAt: Date.now(),
      });
    } catch (err: any) {
      // Surface background refresh issue only if critical
      console.error('Background sync failed:', err);
    }
  },

  seedDemoData: (force = false) =>
    mutationGuard.run('seedDemoData', { force }, async () => {
      set((s) => ({ syncingCount: s.syncingCount + 1, globalError: null }));
      try {
        const res = await api.seedData(force);
        await get().bootstrap({ force: true, silent: true });
        get().addToast(res.message || 'Demo data synced', 'success');
      } catch (err: any) {
        const msg = err?.message || 'Failed to load demo data';
        set({ globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  createPurchase: (data) =>
    mutationGuard.run('createPurchase', data, async () => {
      const snapshot = takeSnapshot(get());
      const tempId = -Date.now();
      const supplier = snapshot.suppliers.find((s) => s.id === data.supplierId);
      const rate = calculatePurchaseRate(data.purchaseAmount, data.totalWeightKg);
      const loadNum = `LOAD-${data.purchaseDate.replace(/-/g, '')}-NEW`;
      const nowIso = new Date().toISOString();

      const optimisticLoad: PurchaseLoad = {
        id: tempId,
        loadNumber: loadNum,
        supplierId: data.supplierId,
        supplierName: supplier?.name || 'Supplier',
        supplierPhone: supplier?.phone || undefined,
        purchaseDate: data.purchaseDate,
        totalWeightKg: data.totalWeightKg.toFixed(2),
        purchaseAmount: data.purchaseAmount.toFixed(2),
        purchaseRatePerKg: rate,
        vehicleNumber: data.vehicleNumber || null,
        driverName: data.driverName || null,
        status: 'PENDING_RECEIVING',
        notes: data.notes || null,
        createdAt: nowIso,
        expenses: [],
        totalExpenses: 0,
        totalLandedCost: data.purchaseAmount,
        stockBatch: null,
      };

      const prevSupBal = Number(supplier?.currentBalance ?? supplier?.openingBalance ?? 0);
      const newSupBal = Number((prevSupBal + data.purchaseAmount).toFixed(2));

      const optimisticTx: DealerTransaction = {
        id: tempId - 1,
        supplierId: data.supplierId,
        supplierName: supplier?.name || 'Supplier',
        transactionDate: data.purchaseDate,
        transactionType: 'PURCHASE_DEBIT',
        debitAmount: data.purchaseAmount.toFixed(2),
        creditAmount: '0.00',
        balanceAfter: newSupBal.toFixed(2),
        referenceType: 'PURCHASE_LOAD',
        referenceId: tempId,
        paymentMethod: null,
        notes: `Truck ${loadNum} (${data.totalWeightKg} KG)`,
        createdAt: nowIso,
      };

      // Instant UI update
      set((s) => ({
        purchases: [optimisticLoad, ...s.purchases],
        dealerTransactions: [optimisticTx, ...s.dealerTransactions],
        suppliers: s.suppliers.map((sup) =>
          sup.id === data.supplierId
            ? {
                ...sup,
                currentBalance: newSupBal,
                totalPurchasesAmount: (sup.totalPurchasesAmount || 0) + data.purchaseAmount,
                purchaseCount: (sup.purchaseCount || 0) + 1,
              }
            : sup
        ),
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Truck purchase saved!', 'success');

      try {
        const created = await api.createPurchase(data);
        const mergedLoad = { ...optimisticLoad, ...created };
        set((s) => ({
          purchases: s.purchases.map((p) => (p.id === tempId ? mergedLoad : p)),
          dealerTransactions: s.dealerTransactions.map((t) =>
            t.referenceId === tempId ? { ...t, referenceId: created.id } : t
          ),
        }));
        void get().refreshInBackground();
        return mergedLoad;
      } catch (err: any) {
        const msg = err?.message || 'Failed to save purchase load. Reverted changes.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  addLoadExpense: (loadId, data) =>
    mutationGuard.run('addLoadExpense', { loadId, ...data }, async () => {
      const snapshot = takeSnapshot(get());
      const tempId = -Date.now();
      const expDate = data.expenseDate || new Date().toISOString().split('T')[0];

      const newExp = {
        id: tempId,
        purchaseLoadId: loadId,
        category: data.category,
        amount: data.amount.toFixed(2),
        expenseDate: expDate,
        description: data.description || null,
        createdAt: new Date().toISOString(),
      };

      // Optimistically update purchase load expenses, landed cost, and matching stock batch if received
      set((s) => ({
        purchases: s.purchases.map((load) => {
          if (load.id !== loadId) return load;
          const expenses = [newExp, ...(load.expenses || [])];
          const totalExp = Number(((load.totalExpenses || 0) + data.amount).toFixed(2));
          const landed = calculateLandedCost(Number(load.purchaseAmount), totalExp);
          const batch = load.stockBatch
            ? {
                ...load.stockBatch,
                totalLoadExpenses: totalExp.toFixed(2),
                totalLandedCost: landed.toFixed(2),
                costPerPiece: calculateCostPerPiece(
                  landed,
                  load.stockBatch.originalSaleablePieces
                ).toFixed(2),
              }
            : null;
          return {
            ...load,
            expenses,
            totalExpenses: totalExp,
            totalLandedCost: landed,
            stockBatch: batch,
          };
        }),
        batches: s.batches.map((b) => {
          if (b.purchaseLoadId !== loadId) return b;
          const totalExp = Number(b.totalLoadExpenses) + data.amount;
          const landed = calculateLandedCost(Number(b.purchaseAmount), totalExp);
          return {
            ...b,
            totalLoadExpenses: totalExp.toFixed(2),
            totalLandedCost: landed.toFixed(2),
            costPerPiece: calculateCostPerPiece(landed, b.originalSaleablePieces).toFixed(2),
          };
        }),
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Truck expense added', 'success');

      try {
        await api.addLoadExpense(loadId, data);
        void get().refreshInBackground();
      } catch (err: any) {
        const msg = err?.message || 'Failed to add truck expense. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  deleteLoadExpense: (loadId, expenseId) =>
    mutationGuard.run('deleteLoadExpense', { loadId, expenseId }, async () => {
      const snapshot = takeSnapshot(get());
      const targetLoad = snapshot.purchases.find((l) => l.id === loadId);
      const targetExp = targetLoad?.expenses?.find((e) => e.id === expenseId);
      const expAmt = Number(targetExp?.amount || 0);

      set((s) => ({
        purchases: s.purchases.map((load) => {
          if (load.id !== loadId) return load;
          const expenses = (load.expenses || []).filter((e) => e.id !== expenseId);
          const totalExp = Math.max(0, Number(((load.totalExpenses || 0) - expAmt).toFixed(2)));
          const landed = calculateLandedCost(Number(load.purchaseAmount), totalExp);
          return {
            ...load,
            expenses,
            totalExpenses: totalExp,
            totalLandedCost: landed,
            stockBatch: load.stockBatch
              ? {
                  ...load.stockBatch,
                  totalLoadExpenses: totalExp.toFixed(2),
                  totalLandedCost: landed.toFixed(2),
                  costPerPiece: calculateCostPerPiece(
                    landed,
                    load.stockBatch.originalSaleablePieces
                  ).toFixed(2),
                }
              : null,
          };
        }),
        batches: s.batches.map((b) => {
          if (b.purchaseLoadId !== loadId) return b;
          const totalExp = Math.max(0, Number(b.totalLoadExpenses) - expAmt);
          const landed = calculateLandedCost(Number(b.purchaseAmount), totalExp);
          return {
            ...b,
            totalLoadExpenses: totalExp.toFixed(2),
            totalLandedCost: landed.toFixed(2),
            costPerPiece: calculateCostPerPiece(landed, b.originalSaleablePieces).toFixed(2),
          };
        }),
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Truck expense removed', 'success');

      try {
        await api.deleteLoadExpense(loadId, expenseId);
        void get().refreshInBackground();
      } catch (err: any) {
        const msg = err?.message || 'Failed to remove truck expense. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  receiveStock: (loadId, data) =>
    mutationGuard.run('receiveStock', { loadId, ...data }, async () => {
      const snapshot = takeSnapshot(get());
      const load = snapshot.purchases.find((l) => l.id === loadId);
      if (!load) throw new Error('Truck load not found');

      const dead = data.deadPieces || 0;
      const damaged = data.damagedPieces || 0;
      const saleable = calculateSaleablePieces(data.receivedPieces, dead, damaged);
      if (saleable <= 0) {
        throw new Error('Healthy saleable birds must be greater than zero');
      }

      const totalExp = Number(load.totalExpenses || 0);
      const landedCost = calculateLandedCost(Number(load.purchaseAmount), totalExp);
      const costPerPiece = calculateCostPerPiece(landedCost, saleable);
      const tempId = -Date.now();
      const batchNumber = `BATCH-${load.loadNumber}`;
      const nowIso = new Date().toISOString();

      const optimisticBatch: StockBatch = {
        id: tempId,
        batchNumber,
        purchaseLoadId: loadId,
        loadNumber: load.loadNumber,
        supplierName: load.supplierName,
        receivingDate: data.receivingDate,
        receivedPieces: data.receivedPieces,
        deadPieces: dead,
        damagedPieces: damaged,
        originalSaleablePieces: saleable,
        soldPieces: 0,
        remainingPieces: saleable,
        purchaseAmount: load.purchaseAmount,
        totalLoadExpenses: totalExp.toFixed(2),
        totalLandedCost: landedCost.toFixed(2),
        costPerPiece: costPerPiece.toFixed(2),
        isClosed: false,
        notes: data.notes || null,
        createdAt: nowIso,
      };

      const optimisticMove: StockMovement = {
        id: tempId - 1,
        stockBatchId: tempId,
        batchNumber,
        movementType: 'STOCK_IN',
        quantity: saleable,
        balanceAfter: saleable,
        unitCost: costPerPiece.toFixed(2),
        referenceType: 'PURCHASE_LOAD',
        referenceId: loadId,
        notes: `Received ${data.receivedPieces} birds (${dead} dead, ${damaged} damaged)`,
        createdAt: nowIso,
      };

      set((s) => ({
        batches: [...s.batches, optimisticBatch],
        movements: [optimisticMove, ...s.movements],
        purchases: s.purchases.map((p) =>
          p.id === loadId ? { ...p, status: 'RECEIVED', stockBatch: optimisticBatch } : p
        ),
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast(`Added ${saleable} healthy birds to stock!`, 'success');

      try {
        const savedBatch = await api.receiveStock(loadId, data);
        void get().refreshInBackground();
        return { ...optimisticBatch, ...savedBatch };
      } catch (err: any) {
        const msg = err?.message || 'Could not receive stock. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  adjustStock: (data) =>
    mutationGuard.run('adjustStock', data, async () => {
      const snapshot = takeSnapshot(get());
      const batch = snapshot.batches.find((b) => b.id === data.stockBatchId);
      if (!batch) throw new Error('Stock batch not found');

      const newRemaining = batch.remainingPieces + data.quantityChange;
      if (newRemaining < 0) {
        throw new Error(`Cannot reduce below zero (only ${batch.remainingPieces} left)`);
      }

      const optimisticMove: StockMovement = {
        id: -Date.now(),
        stockBatchId: batch.id,
        batchNumber: batch.batchNumber,
        movementType: data.quantityChange < 0 ? 'DAMAGE' : 'ADJUSTMENT',
        quantity: data.quantityChange,
        balanceAfter: newRemaining,
        unitCost: batch.costPerPiece,
        referenceType: 'MANUAL_ADJUSTMENT',
        referenceId: batch.id,
        notes: data.reason,
        createdAt: new Date().toISOString(),
      };

      set((s) => ({
        batches: s.batches.map((b) =>
          b.id === batch.id
            ? { ...b, remainingPieces: newRemaining, isClosed: newRemaining === 0 }
            : b
        ),
        movements: [optimisticMove, ...s.movements],
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Stock count updated!', 'success');

      try {
        await api.adjustStock(data);
        void get().refreshInBackground();
      } catch (err: any) {
        const msg = err?.message || 'Failed to update stock count. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  createOwnShopSale: (data) =>
    mutationGuard.run('createOwnShopSale', data, async () => {
      const snapshot = takeSnapshot(get());
      const activeBatches = snapshot.batches
        .filter((b) => !b.isClosed && b.remainingPieces > 0)
        .map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          remainingPieces: b.remainingPieces,
          costPerPiece: Number(b.costPerPiece),
        }));

      const totalAvail = activeBatches.reduce((sum, b) => sum + b.remainingPieces, 0);
      if (data.quantityPieces > totalAvail) {
        throw new Error(
          `Not enough birds in stock! You asked for ${data.quantityPieces}, only ${totalAvail} available.`
        );
      }

      const fifoResult = consumeBatchesFifo(activeBatches, data.quantityPieces);
      const metrics = calculateSaleMetrics(
        data.totalSaleAmount,
        data.quantityPieces,
        fifoResult.totalCost
      );
      const tempId = -Date.now();
      const invoiceNumber = `INV-${data.saleDate.replace(/-/g, '')}-NEW`;
      const nowIso = new Date().toISOString();

      const optimisticSale: Sale = {
        id: tempId,
        invoiceNumber,
        saleType: 'OWN_SHOP',
        saleDate: data.saleDate,
        shopId: null,
        shopName: null,
        totalPieces: data.quantityPieces,
        totalAmount: data.totalSaleAmount.toFixed(2),
        totalCost: fifoResult.totalCost.toFixed(2),
        totalProfit: metrics.totalProfit.toFixed(2),
        sellingPricePerPiece: metrics.sellingPricePerPiece.toFixed(2),
        costPerPiece: metrics.costPerPiece.toFixed(2),
        profitPerPiece: metrics.profitPerPiece.toFixed(2),
        notes: data.notes || null,
        createdAt: nowIso,
      };

      const consumedMap = new Map(fifoResult.consumedBatches.map((c) => [c.batchId, c]));
      const newMovements: StockMovement[] = fifoResult.consumedBatches.map((c, idx) => {
        const b = snapshot.batches.find((x) => x.id === c.batchId);
        const rem = (b?.remainingPieces || 0) - c.quantity;
        return {
          id: tempId - idx - 1,
          stockBatchId: c.batchId,
          batchNumber: c.batchNumber,
          movementType: 'SALE_OUT',
          quantity: -c.quantity,
          balanceAfter: rem,
          unitCost: c.unitCost.toFixed(2),
          referenceType: 'SALE',
          referenceId: tempId,
          notes: `Shop sale ${invoiceNumber}: ${c.quantity} birds`,
          createdAt: nowIso,
        };
      });

      set((s) => ({
        sales: [optimisticSale, ...s.sales],
        batches: s.batches.map((b) => {
          const c = consumedMap.get(b.id);
          if (!c) return b;
          const newRem = b.remainingPieces - c.quantity;
          return {
            ...b,
            remainingPieces: newRem,
            soldPieces: b.soldPieces + c.quantity,
            isClosed: newRem === 0,
          };
        }),
        movements: [...newMovements, ...s.movements],
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Sale saved!', 'success');

      try {
        const res = await api.createOwnShopSale(data);
        if (res?.sale) {
          const mergedSale = { ...optimisticSale, ...res.sale };
          set((s) => ({
            sales: s.sales.map((item) => (item.id === tempId ? mergedSale : item)),
          }));
        }
        void get().refreshInBackground();
        return res;
      } catch (err: any) {
        const msg = err?.message || 'Could not save sale. Stock restored.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  createWholesaleSale: (data) =>
    mutationGuard.run('createWholesaleSale', data, async () => {
      const snapshot = takeSnapshot(get());
      const shop = snapshot.shops.find((sh) => sh.id === data.shopId);
      const activeBatches = snapshot.batches
        .filter((b) => !b.isClosed && b.remainingPieces > 0)
        .map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          remainingPieces: b.remainingPieces,
          costPerPiece: Number(b.costPerPiece),
        }));

      const totalAvail = activeBatches.reduce((sum, b) => sum + b.remainingPieces, 0);
      if (data.quantityPieces > totalAvail) {
        throw new Error(
          `Not enough birds in stock! Requested: ${data.quantityPieces}, Available: ${totalAvail}`
        );
      }

      const fifoResult = consumeBatchesFifo(activeBatches, data.quantityPieces);
      const metrics = calculateSaleMetrics(
        data.totalSaleAmount,
        data.quantityPieces,
        fifoResult.totalCost
      );
      const tempId = -Date.now();
      const invoiceNumber = `WHL-${data.saleDate.replace(/-/g, '')}-NEW`;
      const nowIso = new Date().toISOString();

      const optimisticSale: Sale = {
        id: tempId,
        invoiceNumber,
        saleType: 'WHOLESALE',
        saleDate: data.saleDate,
        shopId: data.shopId,
        shopName: shop?.shopName || 'Wholesale Shop',
        totalPieces: data.quantityPieces,
        totalAmount: data.totalSaleAmount.toFixed(2),
        totalCost: fifoResult.totalCost.toFixed(2),
        totalProfit: metrics.totalProfit.toFixed(2),
        sellingPricePerPiece: metrics.sellingPricePerPiece.toFixed(2),
        costPerPiece: metrics.costPerPiece.toFixed(2),
        profitPerPiece: metrics.profitPerPiece.toFixed(2),
        notes: data.notes || null,
        createdAt: nowIso,
      };

      const consumedMap = new Map(fifoResult.consumedBatches.map((c) => [c.batchId, c]));
      const newMovements: StockMovement[] = fifoResult.consumedBatches.map((c, idx) => {
        const b = snapshot.batches.find((x) => x.id === c.batchId);
        const rem = (b?.remainingPieces || 0) - c.quantity;
        return {
          id: tempId - idx - 1,
          stockBatchId: c.batchId,
          batchNumber: c.batchNumber,
          movementType: 'WHOLESALE_OUT',
          quantity: -c.quantity,
          balanceAfter: rem,
          unitCost: c.unitCost.toFixed(2),
          referenceType: 'SHOP_DISTRIBUTION',
          referenceId: tempId,
          notes: `Wholesale delivery ${invoiceNumber} to ${shop?.shopName || 'Shop'}`,
          createdAt: nowIso,
        };
      });

      set((s) => ({
        sales: [optimisticSale, ...s.sales],
        batches: s.batches.map((b) => {
          const c = consumedMap.get(b.id);
          if (!c) return b;
          const newRem = b.remainingPieces - c.quantity;
          return {
            ...b,
            remainingPieces: newRem,
            soldPieces: b.soldPieces + c.quantity,
            isClosed: newRem === 0,
          };
        }),
        shops: s.shops.map((sh) =>
          sh.id === data.shopId
            ? {
                ...sh,
                totalPiecesDelivered: (sh.totalPiecesDelivered || 0) + data.quantityPieces,
                totalSalesAmount: (sh.totalSalesAmount || 0) + data.totalSaleAmount,
                ordersCount: (sh.ordersCount || 0) + 1,
              }
            : sh
        ),
        movements: [...newMovements, ...s.movements],
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Shop delivery saved & stock updated!', 'success');

      try {
        const res = await api.createWholesaleSale(data);
        if (res?.sale) {
          const mergedSale = { ...optimisticSale, ...res.sale };
          set((s) => ({
            sales: s.sales.map((item) => (item.id === tempId ? mergedSale : item)),
          }));
        }
        void get().refreshInBackground();
        return res;
      } catch (err: any) {
        const msg = err?.message || 'Could not save delivery. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  createSupplier: (data) =>
    mutationGuard.run('createSupplier', data, async () => {
      const snapshot = takeSnapshot(get());
      const tempId = -Date.now();
      const parsedOp = parseFloat(data.openingBalance || '0');
      const opening = Number.isFinite(parsedOp) ? parsedOp : 0;
      const nowIso = new Date().toISOString();

      const optimisticSup: Supplier = {
        id: tempId,
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        openingBalance: opening.toFixed(2),
        notes: data.notes || null,
        currentBalance: opening,
        totalPurchasesAmount: 0,
        purchaseCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const newTxs = [...snapshot.dealerTransactions];
      if (opening !== 0) {
        newTxs.unshift({
          id: tempId - 1,
          supplierId: tempId,
          supplierName: data.name,
          transactionDate: nowIso.split('T')[0],
          transactionType: opening > 0 ? 'PURCHASE_DEBIT' : 'PAYMENT_CREDIT',
          debitAmount: opening > 0 ? opening.toFixed(2) : '0.00',
          creditAmount: opening < 0 ? Math.abs(opening).toFixed(2) : '0.00',
          balanceAfter: opening.toFixed(2),
          referenceType: 'OPENING_BALANCE',
          referenceId: null,
          paymentMethod: null,
          notes: 'Previous balance carried forward',
          createdAt: nowIso,
        });
      }

      set((s) => ({
        suppliers: [...s.suppliers, optimisticSup].sort((a, b) => a.name.localeCompare(b.name)),
        dealerTransactions: newTxs,
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast(`Supplier "${data.name}" added!`, 'success');

      try {
        const created = await api.createSupplier(data);
        const mergedSup = { ...optimisticSup, ...created };
        set((s) => ({
          suppliers: s.suppliers
            .map((sup) => (sup.id === tempId ? mergedSup : sup))
            .sort((a, b) => a.name.localeCompare(b.name)),
          dealerTransactions: s.dealerTransactions.map((t) =>
            t.supplierId === tempId ? { ...t, supplierId: created.id } : t
          ),
        }));
        void get().refreshInBackground();
        return mergedSup;
      } catch (err: any) {
        const msg = err?.message || 'Failed to add supplier. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  recordSupplierPayment: (data) =>
    mutationGuard.run('recordSupplierPayment', data, async () => {
      const snapshot = takeSnapshot(get());
      const supplier = snapshot.suppliers.find((s) => s.id === data.supplierId);
      const prevBal = Number(supplier?.currentBalance ?? supplier?.openingBalance ?? 0);
      const newBal = Number((prevBal - data.amount).toFixed(2));
      const txDate = data.transactionDate || new Date().toISOString().split('T')[0];

      const optimisticTx: DealerTransaction = {
        id: -Date.now(),
        supplierId: data.supplierId,
        supplierName: supplier?.name || 'Supplier',
        transactionDate: txDate,
        transactionType: 'PAYMENT_CREDIT',
        debitAmount: '0.00',
        creditAmount: data.amount.toFixed(2),
        balanceAfter: newBal.toFixed(2),
        referenceType: 'PAYMENT',
        referenceId: null,
        paymentMethod: data.paymentMethod || 'CASH',
        notes: data.notes || 'Supplier payment',
        createdAt: new Date().toISOString(),
      };

      set((s) => ({
        dealerTransactions: [optimisticTx, ...s.dealerTransactions],
        suppliers: s.suppliers.map((sup) =>
          sup.id === data.supplierId ? { ...sup, currentBalance: newBal } : sup
        ),
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Supplier payment recorded!', 'success');

      try {
        await api.recordSupplierPayment(data);
        void get().refreshInBackground();
      } catch (err: any) {
        const msg = err?.message || 'Failed to save payment. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  createShop: (data) =>
    mutationGuard.run('createShop', data, async () => {
      const snapshot = takeSnapshot(get());
      const tempId = -Date.now();
      const optimisticShop: Shop = {
        id: tempId,
        shopName: data.shopName,
        ownerName: data.ownerName || null,
        phone: data.phone || null,
        address: data.address || null,
        notes: data.notes || null,
        totalPiecesDelivered: 0,
        totalSalesAmount: 0,
        ordersCount: 0,
        createdAt: new Date().toISOString(),
      };

      set((s) => ({
        shops: [...s.shops, optimisticShop].sort((a, b) => a.shopName.localeCompare(b.shopName)),
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast(`Shop "${data.shopName}" added!`, 'success');

      try {
        const created = await api.createShop(data);
        const mergedShop = { ...optimisticShop, ...created };
        set((s) => ({
          shops: s.shops
            .map((sh) => (sh.id === tempId ? mergedShop : sh))
            .sort((a, b) => a.shopName.localeCompare(b.shopName)),
        }));
        void get().refreshInBackground();
        return mergedShop;
      } catch (err: any) {
        const msg = err?.message || 'Failed to add shop. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  createWorker: (data) =>
    mutationGuard.run('createWorker', data, async () => {
      const snapshot = takeSnapshot(get());
      const tempId = -Date.now();
      const optimisticWorker: Worker = {
        id: tempId,
        name: data.name,
        phone: data.phone || null,
        notes: data.notes || null,
        isActive: data.isActive !== false,
        totalPaid: 0,
        paymentCount: 0,
        createdAt: new Date().toISOString(),
      };

      set((s) => ({
        workers: [...s.workers, optimisticWorker].sort((a, b) => a.name.localeCompare(b.name)),
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast(`Worker "${data.name}" added!`, 'success');

      try {
        const created = await api.createWorker(data);
        const mergedWorker = { ...optimisticWorker, ...created };
        set((s) => ({
          workers: s.workers
            .map((w) => (w.id === tempId ? mergedWorker : w))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
        void get().refreshInBackground();
        return mergedWorker;
      } catch (err: any) {
        const msg = err?.message || 'Failed to add worker. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  recordWorkerPayment: (workerId, data) =>
    mutationGuard.run('recordWorkerPayment', { workerId, ...data }, async () => {
      const snapshot = takeSnapshot(get());
      const worker = snapshot.workers.find((w) => w.id === workerId);
      const pDate = data.paymentDate || new Date().toISOString().split('T')[0];

      const optimisticPmt: WorkerPayment = {
        id: -Date.now(),
        workerId,
        workerName: worker?.name || 'Worker',
        amount: data.amount.toFixed(2),
        paymentDate: pDate,
        paymentMethod: data.paymentMethod || 'CASH',
        description: data.description || 'Wage payment',
        createdAt: new Date().toISOString(),
      };

      set((s) => ({
        workerPayments: [optimisticPmt, ...s.workerPayments],
        workers: s.workers.map((w) =>
          w.id === workerId
            ? {
                ...w,
                totalPaid: (w.totalPaid || 0) + data.amount,
                paymentCount: (w.paymentCount || 0) + 1,
              }
            : w
        ),
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Worker payment saved!', 'success');

      try {
        await api.recordWorkerPayment(workerId, data);
        void get().refreshInBackground();
      } catch (err: any) {
        const msg = err?.message || 'Failed to save worker payment. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  createExpense: (data) =>
    mutationGuard.run('createExpense', data, async () => {
      const snapshot = takeSnapshot(get());
      const expDate = data.expenseDate || new Date().toISOString().split('T')[0];

      const optimisticExp: BusinessExpense = {
        id: -Date.now(),
        category: data.category,
        amount: data.amount.toFixed(2),
        expenseDate: expDate,
        paymentMethod: data.paymentMethod || 'CASH',
        description: data.description || null,
        createdAt: new Date().toISOString(),
      };

      set((s) => ({
        expenses: [optimisticExp, ...s.expenses],
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Expense saved!', 'success');

      try {
        await api.createExpense(data);
        void get().refreshInBackground();
      } catch (err: any) {
        const msg = err?.message || 'Failed to save expense. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  deleteExpense: (id) =>
    mutationGuard.run('deleteExpense', { id }, async () => {
      const snapshot = takeSnapshot(get());

      set((s) => ({
        expenses: s.expenses.filter((e) => e.id !== id),
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Expense removed', 'success');

      try {
        await api.deleteExpense(id);
        void get().refreshInBackground();
      } catch (err: any) {
        const msg = err?.message || 'Failed to delete expense. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),

  updateSettings: (data) =>
    mutationGuard.run('updateSettings', data, async () => {
      const snapshot = takeSnapshot(get());
      set((s) => ({
        settings: { ...s.settings, ...data },
        syncingCount: s.syncingCount + 1,
        globalError: null,
      }));

      get().addToast('Settings saved!', 'success');

      try {
        await api.updateSettings(data);
        void get().refreshInBackground();
      } catch (err: any) {
        const msg = err?.message || 'Failed to save settings. Reverted.';
        set({ ...snapshot, globalError: msg });
        get().addToast(msg, 'error');
        throw err;
      } finally {
        set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
      }
    }),
}));

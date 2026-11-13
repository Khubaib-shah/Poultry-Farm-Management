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

export interface OptimisticMutationOptions<T = void> {
  onOptimistic?: (optimisticValue: T) => void;
  onSynced?: (syncedValue: T) => void;
  onRollback?: (error: unknown) => void;
}

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
  resolvedIdMap: Record<number, number>;

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
  resetStore: () => void;

  // Optimistic Mutations with Instant UI/Modal Callback + Background DB Sync + Rollback
  createPurchase: (
    data: {
      supplierId: number;
      purchaseDate: string;
      totalWeightKg: number;
      purchaseAmount: number;
      vehicleNumber?: string;
      driverName?: string;
      notes?: string;
    },
    options?: OptimisticMutationOptions<PurchaseLoad>
  ) => Promise<PurchaseLoad>;

  addLoadExpense: (
    loadId: number,
    data: { category: string; amount: number; expenseDate?: string; description?: string },
    options?: OptimisticMutationOptions<void>
  ) => Promise<void>;

  deleteLoadExpense: (
    loadId: number,
    expenseId: number,
    options?: OptimisticMutationOptions<void>
  ) => Promise<void>;

  receiveStock: (
    loadId: number,
    data: {
      receivingDate: string;
      receivedPieces: number;
      deadPieces?: number;
      damagedPieces?: number;
      notes?: string;
    },
    options?: OptimisticMutationOptions<StockBatch>
  ) => Promise<StockBatch>;

  adjustStock: (
    data: {
      stockBatchId: number;
      quantityChange: number;
      reason: string;
      adjustmentType?: string;
    },
    options?: OptimisticMutationOptions<void>
  ) => Promise<void>;

  createOwnShopSale: (
    data: {
      saleDate: string;
      quantityPieces: number;
      totalSaleAmount: number;
      notes?: string;
    },
    options?: OptimisticMutationOptions<{ sale: Sale; summary: any }>
  ) => Promise<{ sale: Sale; summary: any }>;

  createWholesaleSale: (
    data: {
      shopId: number;
      saleDate: string;
      quantityPieces: number;
      totalSaleAmount: number;
      notes?: string;
    },
    options?: OptimisticMutationOptions<{ sale: Sale; summary: any }>
  ) => Promise<{ sale: Sale; summary: any }>;

  createSupplier: (
    data: {
      name: string;
      phone?: string;
      address?: string;
      openingBalance?: string;
      notes?: string;
    },
    options?: OptimisticMutationOptions<Supplier>
  ) => Promise<Supplier>;

  recordSupplierPayment: (
    data: {
      supplierId: number;
      amount: number;
      transactionDate?: string;
      paymentMethod?: string;
      notes?: string;
    },
    options?: OptimisticMutationOptions<void>
  ) => Promise<void>;

  createShop: (
    data: {
      shopName: string;
      ownerName?: string;
      phone?: string;
      address?: string;
      notes?: string;
    },
    options?: OptimisticMutationOptions<Shop>
  ) => Promise<Shop>;

  createWorker: (
    data: {
      name: string;
      phone?: string;
      notes?: string;
      isActive?: boolean;
    },
    options?: OptimisticMutationOptions<Worker>
  ) => Promise<Worker>;

  recordWorkerPayment: (
    workerId: number,
    data: { amount: number; paymentDate?: string; paymentMethod?: string; description?: string },
    options?: OptimisticMutationOptions<void>
  ) => Promise<void>;

  createExpense: (
    data: {
      category: string;
      amount: number;
      expenseDate?: string;
      paymentMethod?: string;
      description?: string;
    },
    options?: OptimisticMutationOptions<BusinessExpense>
  ) => Promise<BusinessExpense>;

  deleteExpense: (
    id: number,
    options?: OptimisticMutationOptions<void>
  ) => Promise<void>;

  updateSettings: (
    data: Partial<AppSettings>,
    options?: OptimisticMutationOptions<void>
  ) => Promise<void>;
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

let tempIdCounter = 0;
function createTempId(): number {
  tempIdCounter = (tempIdCounter + 1) % 1000;
  return -((Date.now() % 1_000_000) * 1000 + tempIdCounter + 1);
}

let mutationEpoch = 0;
const pendingIdResolvers = new Map<number, Promise<number>>();

function trackTempIdResolution(tempId: number, promise: Promise<number>) {
  pendingIdResolvers.set(tempId, promise);
  promise
    .catch(() => {})
    .finally(() => {
      pendingIdResolvers.delete(tempId);
    });
}

async function resolveRealId(
  id: number,
  getResolvedMap: () => Record<number, number>
): Promise<number> {
  if (id > 0) return id;
  const mapped = getResolvedMap()[id];
  if (mapped && mapped > 0) return mapped;
  const pending = pendingIdResolvers.get(id);
  if (pending) return pending;
  throw new Error('Item is still saving or failed to save. Please try again.');
}

export const useAppStore = create<AppStore>((set, get) => {
  const pushToast = (text: string, type: 'success' | 'error' | 'info' = 'success'): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4500);
    return id;
  };

  return {
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
    resolvedIdMap: {},

    addToast: (text, type = 'success') => {
      pushToast(text, type);
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

    resetStore: () => {
      activeBootstrapPromise = null;
      pendingIdResolvers.clear();
      set({
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
        loading: false,
        syncingCount: 0,
        lastSyncedAt: null,
        globalError: null,
        resolvedIdMap: {},
      });
    },

    bootstrap: async (options) => {
      const { initialized, lastSyncedAt } = get();
      const force = options?.force ?? false;
      const silent = options?.silent ?? false;

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
          pushToast(msg, 'error');
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
        console.error('Background sync failed:', err);
      }
    },

    seedDemoData: (force = false) =>
      mutationGuard.run('seedDemoData', { force }, async () => {
        set((s) => ({ syncingCount: s.syncingCount + 1, globalError: null }));
        try {
          const res = await api.seedData(force);
          await get().bootstrap({ force: true, silent: true });
          pushToast(res.message || 'Demo data synced', 'success');
        } catch (err: any) {
          const msg = err?.message || 'Failed to load demo data';
          set({ globalError: msg });
          pushToast(msg, 'error');
          throw err;
        } finally {
          set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
        }
      }),

    createPurchase: (data, options) =>
      mutationGuard.run('createPurchase', data, () => {
        const snapshot = takeSnapshot(get());
        const tempId = createTempId();
        const txTempId = createTempId();
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
          id: txTempId,
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

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

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

        const toastId = pushToast('Truck purchase saved!', 'success');
        options?.onOptimistic?.(optimisticLoad);

        const syncPromise = (async () => {
          try {
            const realSupplierId = await resolveRealId(
              data.supplierId,
              () => get().resolvedIdMap
            );
            const created = await api.createPurchase({
              ...data,
              supplierId: realSupplierId,
            });
            const mergedLoad = { ...optimisticLoad, ...created };
            set((s) => ({
              purchases: s.purchases.map((p) => (p.id === tempId ? mergedLoad : p)),
              dealerTransactions: s.dealerTransactions.map((t) =>
                t.referenceId === tempId ? { ...t, referenceId: created.id } : t
              ),
              resolvedIdMap: { ...s.resolvedIdMap, [tempId]: created.id },
            }));
            options?.onSynced?.(mergedLoad);
            void get().refreshInBackground();
            return mergedLoad;
          } catch (err: any) {
            const msg = err?.message || 'Failed to save purchase load. Reverted changes.';
            get().dismissToast(toastId);
            if (mutationEpoch === myEpoch) {
              set({ ...snapshot, globalError: msg });
            } else {
              set((s) => ({
                purchases: s.purchases.filter((p) => p.id !== tempId),
                dealerTransactions: s.dealerTransactions.filter((t) => t.id !== txTempId),
                globalError: msg,
              }));
              void get().refreshInBackground();
            }
            options?.onRollback?.(err);
            pushToast(msg, 'error');
            throw err;
          } finally {
            set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
          }
        })();

        trackTempIdResolution(
          tempId,
          syncPromise.then((res) => res.id)
        );
        return syncPromise;
      }),

    addLoadExpense: (loadId, data, options) =>
      mutationGuard.run('addLoadExpense', { loadId, ...data }, async () => {
        const snapshot = takeSnapshot(get());
        const tempId = createTempId();
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

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

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

        const toastId = pushToast('Truck expense added', 'success');
        options?.onOptimistic?.();

        const syncPromise = (async () => {
          try {
            const realLoadId = await resolveRealId(loadId, () => get().resolvedIdMap);
            const created = await api.addLoadExpense(realLoadId, data);
            set((s) => ({
              purchases: s.purchases.map((load) => {
                if (load.id !== realLoadId && load.id !== loadId) return load;
                return {
                  ...load,
                  expenses: (load.expenses || []).map((e) => (e.id === tempId ? created : e)),
                };
              }),
              resolvedIdMap: { ...s.resolvedIdMap, [tempId]: created.id },
            }));
            options?.onSynced?.();
            void get().refreshInBackground();
            return created.id;
          } catch (err: any) {
            const msg = err?.message || 'Failed to add truck expense. Reverted.';
            get().dismissToast(toastId);
            if (mutationEpoch === myEpoch) {
              set({ ...snapshot, globalError: msg });
            } else {
              void get().refreshInBackground();
              set({ globalError: msg });
            }
            options?.onRollback?.(err);
            pushToast(msg, 'error');
            throw err;
          } finally {
            set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
          }
        })();

        trackTempIdResolution(tempId, syncPromise);
        await syncPromise;
      }),

    deleteLoadExpense: (loadId, expenseId, options) =>
      mutationGuard.run('deleteLoadExpense', { loadId, expenseId }, async () => {
        const snapshot = takeSnapshot(get());
        const targetLoad = snapshot.purchases.find((l) => l.id === loadId);
        const targetExp = targetLoad?.expenses?.find((e) => e.id === expenseId);
        const expAmt = Number(targetExp?.amount || 0);

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

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

        const toastId = pushToast('Truck expense removed', 'success');
        options?.onOptimistic?.();

        try {
          const realLoadId = await resolveRealId(loadId, () => get().resolvedIdMap);
          const realExpenseId = await resolveRealId(expenseId, () => get().resolvedIdMap);
          await api.deleteLoadExpense(realLoadId, realExpenseId);
          options?.onSynced?.();
          void get().refreshInBackground();
        } catch (err: any) {
          const msg = err?.message || 'Failed to remove truck expense. Reverted.';
          get().dismissToast(toastId);
          if (mutationEpoch === myEpoch) {
            set({ ...snapshot, globalError: msg });
          } else {
            void get().refreshInBackground();
            set({ globalError: msg });
          }
          options?.onRollback?.(err);
          pushToast(msg, 'error');
          throw err;
        } finally {
          set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
        }
      }),

    receiveStock: (loadId, data, options) =>
      mutationGuard.run('receiveStock', { loadId, ...data }, () => {
        const snapshot = takeSnapshot(get());
        const load = snapshot.purchases.find(
          (l) => l.id === loadId || l.id === get().resolvedIdMap[loadId]
        );
        if (!load) {
          const msg = 'Truck load not found';
          pushToast(msg, 'error');
          return Promise.reject(new Error(msg));
        }

        const dead = data.deadPieces || 0;
        const damaged = data.damagedPieces || 0;
        const saleable = calculateSaleablePieces(data.receivedPieces, dead, damaged);
        if (saleable <= 0) {
          const msg = 'Healthy saleable birds must be greater than zero';
          pushToast(msg, 'error');
          return Promise.reject(new Error(msg));
        }

        const totalExp = Number(load.totalExpenses || 0);
        const landedCost = calculateLandedCost(Number(load.purchaseAmount), totalExp);
        const costPerPiece = calculateCostPerPiece(landedCost, saleable);
        const tempId = createTempId();
        const moveTempId = createTempId();
        const batchNumber = `BATCH-${load.loadNumber}`;
        const nowIso = new Date().toISOString();

        const optimisticBatch: StockBatch = {
          id: tempId,
          batchNumber,
          purchaseLoadId: load.id,
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
          id: moveTempId,
          stockBatchId: tempId,
          batchNumber,
          movementType: 'STOCK_IN',
          quantity: saleable,
          balanceAfter: saleable,
          unitCost: costPerPiece.toFixed(2),
          referenceType: 'PURCHASE_LOAD',
          referenceId: load.id,
          notes: `Received ${data.receivedPieces} birds (${dead} dead, ${damaged} damaged)`,
          createdAt: nowIso,
        };

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

        set((s) => ({
          batches: [...s.batches, optimisticBatch],
          movements: [optimisticMove, ...s.movements],
          purchases: s.purchases.map((p) =>
            p.id === load.id ? { ...p, status: 'RECEIVED', stockBatch: optimisticBatch } : p
          ),
          syncingCount: s.syncingCount + 1,
          globalError: null,
        }));

        const toastId = pushToast(`Added ${saleable} healthy birds to stock!`, 'success');
        options?.onOptimistic?.(optimisticBatch);

        const syncPromise = (async () => {
          try {
            const realLoadId = await resolveRealId(load.id, () => get().resolvedIdMap);
            const savedBatch = await api.receiveStock(realLoadId, data);
            const mergedBatch = { ...optimisticBatch, ...savedBatch, purchaseLoadId: realLoadId };
            set((s) => ({
              batches: s.batches.map((b) => (b.id === tempId ? mergedBatch : b)),
              movements: s.movements.map((m) =>
                m.id === moveTempId ? { ...m, stockBatchId: savedBatch.id } : m
              ),
              purchases: s.purchases.map((p) =>
                p.id === realLoadId ? { ...p, status: 'RECEIVED', stockBatch: mergedBatch } : p
              ),
              resolvedIdMap: { ...s.resolvedIdMap, [tempId]: savedBatch.id },
            }));
            options?.onSynced?.(mergedBatch);
            void get().refreshInBackground();
            return mergedBatch;
          } catch (err: any) {
            const msg = err?.message || 'Could not receive stock. Reverted.';
            get().dismissToast(toastId);
            if (mutationEpoch === myEpoch) {
              set({ ...snapshot, globalError: msg });
            } else {
              set((s) => ({
                batches: s.batches.filter((b) => b.id !== tempId),
                movements: s.movements.filter((m) => m.id !== moveTempId),
                purchases: s.purchases.map((p) =>
                  p.id === load.id ? { ...p, status: 'PENDING_RECEIVING', stockBatch: null } : p
                ),
                globalError: msg,
              }));
              void get().refreshInBackground();
            }
            options?.onRollback?.(err);
            pushToast(msg, 'error');
            throw err;
          } finally {
            set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
          }
        })();

        trackTempIdResolution(
          tempId,
          syncPromise.then((res) => res.id)
        );
        return syncPromise;
      }),

    adjustStock: (data, options) =>
      mutationGuard.run('adjustStock', data, async () => {
        const snapshot = takeSnapshot(get());
        const batch = snapshot.batches.find(
          (b) => b.id === data.stockBatchId || b.id === get().resolvedIdMap[data.stockBatchId]
        );
        if (!batch) {
          const msg = 'Stock batch not found';
          pushToast(msg, 'error');
          throw new Error(msg);
        }

        const newRemaining = batch.remainingPieces + data.quantityChange;
        if (newRemaining < 0) {
          const msg = `Cannot reduce below zero (only ${batch.remainingPieces} left)`;
          pushToast(msg, 'error');
          throw new Error(msg);
        }

        const moveTempId = createTempId();
        const optimisticMove: StockMovement = {
          id: moveTempId,
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

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

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

        const toastId = pushToast('Stock count updated!', 'success');
        options?.onOptimistic?.();

        try {
          const realBatchId = await resolveRealId(batch.id, () => get().resolvedIdMap);
          await api.adjustStock({ ...data, stockBatchId: realBatchId });
          options?.onSynced?.();
          void get().refreshInBackground();
        } catch (err: any) {
          const msg = err?.message || 'Failed to update stock count. Reverted.';
          get().dismissToast(toastId);
          if (mutationEpoch === myEpoch) {
            set({ ...snapshot, globalError: msg });
          } else {
            void get().refreshInBackground();
            set({ globalError: msg });
          }
          options?.onRollback?.(err);
          pushToast(msg, 'error');
          throw err;
        } finally {
          set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
        }
      }),

    createOwnShopSale: (data, options) =>
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
          const msg = `Not enough birds in stock! You asked for ${data.quantityPieces}, only ${totalAvail} available.`;
          pushToast(msg, 'error');
          throw new Error(msg);
        }

        const fifoResult = consumeBatchesFifo(activeBatches, data.quantityPieces);
        const metrics = calculateSaleMetrics(
          data.totalSaleAmount,
          data.quantityPieces,
          fifoResult.totalCost
        );
        const tempId = createTempId();
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
        const newMovementIds: number[] = [];
        const newMovements: StockMovement[] = fifoResult.consumedBatches.map((c) => {
          const b = snapshot.batches.find((x) => x.id === c.batchId);
          const rem = (b?.remainingPieces || 0) - c.quantity;
          const mId = createTempId();
          newMovementIds.push(mId);
          return {
            id: mId,
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

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

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

        const toastId = pushToast('Sale saved!', 'success');
        options?.onOptimistic?.({ sale: optimisticSale, summary: null });

        try {
          const res = await api.createOwnShopSale(data);
          if (res?.sale) {
            const mergedSale = { ...optimisticSale, ...res.sale };
            set((s) => ({
              sales: s.sales.map((item) => (item.id === tempId ? mergedSale : item)),
              resolvedIdMap: { ...s.resolvedIdMap, [tempId]: res.sale.id },
            }));
          }
          options?.onSynced?.(res);
          void get().refreshInBackground();
          return res;
        } catch (err: any) {
          const msg = err?.message || 'Could not save sale. Stock restored.';
          get().dismissToast(toastId);
          if (mutationEpoch === myEpoch) {
            set({ ...snapshot, globalError: msg });
          } else {
            const moveSet = new Set(newMovementIds);
            set((s) => ({
              sales: s.sales.filter((item) => item.id !== tempId),
              movements: s.movements.filter((m) => !moveSet.has(m.id)),
              globalError: msg,
            }));
            void get().refreshInBackground();
          }
          options?.onRollback?.(err);
          pushToast(msg, 'error');
          throw err;
        } finally {
          set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
        }
      }),

    createWholesaleSale: (data, options) =>
      mutationGuard.run('createWholesaleSale', data, async () => {
        const snapshot = takeSnapshot(get());
        const shop = snapshot.shops.find(
          (sh) => sh.id === data.shopId || sh.id === get().resolvedIdMap[data.shopId]
        );
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
          const msg = `Not enough birds in stock! Requested: ${data.quantityPieces}, Available: ${totalAvail}`;
          pushToast(msg, 'error');
          throw new Error(msg);
        }

        const fifoResult = consumeBatchesFifo(activeBatches, data.quantityPieces);
        const metrics = calculateSaleMetrics(
          data.totalSaleAmount,
          data.quantityPieces,
          fifoResult.totalCost
        );
        const tempId = createTempId();
        const invoiceNumber = `WHL-${data.saleDate.replace(/-/g, '')}-NEW`;
        const nowIso = new Date().toISOString();

        const optimisticSale: Sale = {
          id: tempId,
          invoiceNumber,
          saleType: 'WHOLESALE',
          saleDate: data.saleDate,
          shopId: shop?.id ?? data.shopId,
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
        const newMovementIds: number[] = [];
        const newMovements: StockMovement[] = fifoResult.consumedBatches.map((c) => {
          const b = snapshot.batches.find((x) => x.id === c.batchId);
          const rem = (b?.remainingPieces || 0) - c.quantity;
          const mId = createTempId();
          newMovementIds.push(mId);
          return {
            id: mId,
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

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;
        const targetShopId = shop?.id ?? data.shopId;

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
            sh.id === targetShopId
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

        const toastId = pushToast('Shop delivery saved & stock updated!', 'success');
        options?.onOptimistic?.({ sale: optimisticSale, summary: null });

        try {
          const realShopId = await resolveRealId(targetShopId, () => get().resolvedIdMap);
          const res = await api.createWholesaleSale({ ...data, shopId: realShopId });
          if (res?.sale) {
            const mergedSale = { ...optimisticSale, ...res.sale };
            set((s) => ({
              sales: s.sales.map((item) => (item.id === tempId ? mergedSale : item)),
              resolvedIdMap: { ...s.resolvedIdMap, [tempId]: res.sale.id },
            }));
          }
          options?.onSynced?.(res);
          void get().refreshInBackground();
          return res;
        } catch (err: any) {
          const msg = err?.message || 'Could not save delivery. Reverted.';
          get().dismissToast(toastId);
          if (mutationEpoch === myEpoch) {
            set({ ...snapshot, globalError: msg });
          } else {
            const moveSet = new Set(newMovementIds);
            set((s) => ({
              sales: s.sales.filter((item) => item.id !== tempId),
              movements: s.movements.filter((m) => !moveSet.has(m.id)),
              globalError: msg,
            }));
            void get().refreshInBackground();
          }
          options?.onRollback?.(err);
          pushToast(msg, 'error');
          throw err;
        } finally {
          set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
        }
      }),

    createSupplier: (data, options) =>
      mutationGuard.run('createSupplier', data, () => {
        const snapshot = takeSnapshot(get());
        const tempId = createTempId();
        const txTempId = createTempId();
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
            id: txTempId,
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

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

        set((s) => ({
          suppliers: [...s.suppliers, optimisticSup].sort((a, b) => a.name.localeCompare(b.name)),
          dealerTransactions: newTxs,
          syncingCount: s.syncingCount + 1,
          globalError: null,
        }));

        const toastId = pushToast(`Supplier "${data.name}" added!`, 'success');
        options?.onOptimistic?.(optimisticSup);

        const syncPromise = (async () => {
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
              resolvedIdMap: { ...s.resolvedIdMap, [tempId]: created.id },
            }));
            options?.onSynced?.(mergedSup);
            void get().refreshInBackground();
            return mergedSup;
          } catch (err: any) {
            const msg = err?.message || 'Failed to add supplier. Reverted.';
            get().dismissToast(toastId);
            if (mutationEpoch === myEpoch) {
              set({ ...snapshot, globalError: msg });
            } else {
              set((s) => ({
                suppliers: s.suppliers.filter((sup) => sup.id !== tempId),
                dealerTransactions: s.dealerTransactions.filter((t) => t.id !== txTempId),
                globalError: msg,
              }));
              void get().refreshInBackground();
            }
            options?.onRollback?.(err);
            pushToast(msg, 'error');
            throw err;
          } finally {
            set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
          }
        })();

        trackTempIdResolution(
          tempId,
          syncPromise.then((res) => res.id)
        );
        return syncPromise;
      }),

    recordSupplierPayment: (data, options) =>
      mutationGuard.run('recordSupplierPayment', data, async () => {
        const snapshot = takeSnapshot(get());
        const supplier = snapshot.suppliers.find(
          (s) => s.id === data.supplierId || s.id === get().resolvedIdMap[data.supplierId]
        );
        const targetSupplierId = supplier?.id ?? data.supplierId;
        const prevBal = Number(supplier?.currentBalance ?? supplier?.openingBalance ?? 0);
        const newBal = Number((prevBal - data.amount).toFixed(2));
        const txDate = data.transactionDate || new Date().toISOString().split('T')[0];
        const tempId = createTempId();

        const optimisticTx: DealerTransaction = {
          id: tempId,
          supplierId: targetSupplierId,
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

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

        set((s) => ({
          dealerTransactions: [optimisticTx, ...s.dealerTransactions],
          suppliers: s.suppliers.map((sup) =>
            sup.id === targetSupplierId ? { ...sup, currentBalance: newBal } : sup
          ),
          syncingCount: s.syncingCount + 1,
          globalError: null,
        }));

        const toastId = pushToast('Supplier payment recorded!', 'success');
        options?.onOptimistic?.();

        try {
          const realSupplierId = await resolveRealId(
            targetSupplierId,
            () => get().resolvedIdMap
          );
          const created = await api.recordSupplierPayment({
            ...data,
            supplierId: realSupplierId,
          });
          set((s) => ({
            dealerTransactions: s.dealerTransactions.map((t) =>
              t.id === tempId ? { ...optimisticTx, ...created } : t
            ),
            resolvedIdMap: { ...s.resolvedIdMap, [tempId]: created.id },
          }));
          options?.onSynced?.();
          void get().refreshInBackground();
        } catch (err: any) {
          const msg = err?.message || 'Failed to save payment. Reverted.';
          get().dismissToast(toastId);
          if (mutationEpoch === myEpoch) {
            set({ ...snapshot, globalError: msg });
          } else {
            set((s) => ({
              dealerTransactions: s.dealerTransactions.filter((t) => t.id !== tempId),
              globalError: msg,
            }));
            void get().refreshInBackground();
          }
          options?.onRollback?.(err);
          pushToast(msg, 'error');
          throw err;
        } finally {
          set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
        }
      }),

    createShop: (data, options) =>
      mutationGuard.run('createShop', data, () => {
        const snapshot = takeSnapshot(get());
        const tempId = createTempId();
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

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

        set((s) => ({
          shops: [...s.shops, optimisticShop].sort((a, b) => a.shopName.localeCompare(b.shopName)),
          syncingCount: s.syncingCount + 1,
          globalError: null,
        }));

        const toastId = pushToast(`Shop "${data.shopName}" added!`, 'success');
        options?.onOptimistic?.(optimisticShop);

        const syncPromise = (async () => {
          try {
            const created = await api.createShop(data);
            const mergedShop = { ...optimisticShop, ...created };
            set((s) => ({
              shops: s.shops
                .map((sh) => (sh.id === tempId ? mergedShop : sh))
                .sort((a, b) => a.shopName.localeCompare(b.shopName)),
              sales: s.sales.map((sale) =>
                sale.shopId === tempId ? { ...sale, shopId: created.id } : sale
              ),
              resolvedIdMap: { ...s.resolvedIdMap, [tempId]: created.id },
            }));
            options?.onSynced?.(mergedShop);
            void get().refreshInBackground();
            return mergedShop;
          } catch (err: any) {
            const msg = err?.message || 'Failed to add shop. Reverted.';
            get().dismissToast(toastId);
            if (mutationEpoch === myEpoch) {
              set({ ...snapshot, globalError: msg });
            } else {
              set((s) => ({
                shops: s.shops.filter((sh) => sh.id !== tempId),
                globalError: msg,
              }));
              void get().refreshInBackground();
            }
            options?.onRollback?.(err);
            pushToast(msg, 'error');
            throw err;
          } finally {
            set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
          }
        })();

        trackTempIdResolution(
          tempId,
          syncPromise.then((res) => res.id)
        );
        return syncPromise;
      }),

    createWorker: (data, options) =>
      mutationGuard.run('createWorker', data, () => {
        const snapshot = takeSnapshot(get());
        const tempId = createTempId();
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

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

        set((s) => ({
          workers: [...s.workers, optimisticWorker].sort((a, b) => a.name.localeCompare(b.name)),
          syncingCount: s.syncingCount + 1,
          globalError: null,
        }));

        const toastId = pushToast(`Worker "${data.name}" added!`, 'success');
        options?.onOptimistic?.(optimisticWorker);

        const syncPromise = (async () => {
          try {
            const created = await api.createWorker(data);
            const mergedWorker = { ...optimisticWorker, ...created };
            set((s) => ({
              workers: s.workers
                .map((w) => (w.id === tempId ? mergedWorker : w))
                .sort((a, b) => a.name.localeCompare(b.name)),
              workerPayments: s.workerPayments.map((p) =>
                p.workerId === tempId ? { ...p, workerId: created.id } : p
              ),
              resolvedIdMap: { ...s.resolvedIdMap, [tempId]: created.id },
            }));
            options?.onSynced?.(mergedWorker);
            void get().refreshInBackground();
            return mergedWorker;
          } catch (err: any) {
            const msg = err?.message || 'Failed to add worker. Reverted.';
            get().dismissToast(toastId);
            if (mutationEpoch === myEpoch) {
              set({ ...snapshot, globalError: msg });
            } else {
              set((s) => ({
                workers: s.workers.filter((w) => w.id !== tempId),
                globalError: msg,
              }));
              void get().refreshInBackground();
            }
            options?.onRollback?.(err);
            pushToast(msg, 'error');
            throw err;
          } finally {
            set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
          }
        })();

        trackTempIdResolution(
          tempId,
          syncPromise.then((res) => res.id)
        );
        return syncPromise;
      }),

    recordWorkerPayment: (workerId, data, options) =>
      mutationGuard.run('recordWorkerPayment', { workerId, ...data }, async () => {
        const snapshot = takeSnapshot(get());
        const worker = snapshot.workers.find(
          (w) => w.id === workerId || w.id === get().resolvedIdMap[workerId]
        );
        const targetWorkerId = worker?.id ?? workerId;
        const pDate = data.paymentDate || new Date().toISOString().split('T')[0];
        const tempId = createTempId();

        const optimisticPmt: WorkerPayment = {
          id: tempId,
          workerId: targetWorkerId,
          workerName: worker?.name || 'Worker',
          amount: data.amount.toFixed(2),
          paymentDate: pDate,
          paymentMethod: data.paymentMethod || 'CASH',
          description: data.description || 'Wage payment',
          createdAt: new Date().toISOString(),
        };

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

        set((s) => ({
          workerPayments: [optimisticPmt, ...s.workerPayments],
          workers: s.workers.map((w) =>
            w.id === targetWorkerId
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

        const toastId = pushToast('Worker payment saved!', 'success');
        options?.onOptimistic?.();

        try {
          const realWorkerId = await resolveRealId(
            targetWorkerId,
            () => get().resolvedIdMap
          );
          const created = await api.recordWorkerPayment(realWorkerId, data);
          set((s) => ({
            workerPayments: s.workerPayments.map((p) =>
              p.id === tempId ? { ...optimisticPmt, ...created } : p
            ),
            resolvedIdMap: { ...s.resolvedIdMap, [tempId]: created.id },
          }));
          options?.onSynced?.();
          void get().refreshInBackground();
        } catch (err: any) {
          const msg = err?.message || 'Failed to save worker payment. Reverted.';
          get().dismissToast(toastId);
          if (mutationEpoch === myEpoch) {
            set({ ...snapshot, globalError: msg });
          } else {
            set((s) => ({
              workerPayments: s.workerPayments.filter((p) => p.id !== tempId),
              globalError: msg,
            }));
            void get().refreshInBackground();
          }
          options?.onRollback?.(err);
          pushToast(msg, 'error');
          throw err;
        } finally {
          set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
        }
      }),

    createExpense: (data, options) =>
      mutationGuard.run('createExpense', data, () => {
        const snapshot = takeSnapshot(get());
        const expDate = data.expenseDate || new Date().toISOString().split('T')[0];
        const tempId = createTempId();

        const optimisticExp: BusinessExpense = {
          id: tempId,
          category: data.category,
          amount: data.amount.toFixed(2),
          expenseDate: expDate,
          paymentMethod: data.paymentMethod || 'CASH',
          description: data.description || null,
          createdAt: new Date().toISOString(),
        };

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

        set((s) => ({
          expenses: [optimisticExp, ...s.expenses],
          syncingCount: s.syncingCount + 1,
          globalError: null,
        }));

        const toastId = pushToast('Expense saved!', 'success');
        options?.onOptimistic?.(optimisticExp);

        const syncPromise = (async () => {
          try {
            const created = await api.createExpense(data);
            const mergedExp = { ...optimisticExp, ...created };
            set((s) => ({
              expenses: s.expenses.map((e) => (e.id === tempId ? mergedExp : e)),
              resolvedIdMap: { ...s.resolvedIdMap, [tempId]: created.id },
            }));
            options?.onSynced?.(mergedExp);
            void get().refreshInBackground();
            return mergedExp;
          } catch (err: any) {
            const msg = err?.message || 'Failed to save expense. Reverted.';
            get().dismissToast(toastId);
            if (mutationEpoch === myEpoch) {
              set({ ...snapshot, globalError: msg });
            } else {
              set((s) => ({
                expenses: s.expenses.filter((e) => e.id !== tempId),
                globalError: msg,
              }));
              void get().refreshInBackground();
            }
            options?.onRollback?.(err);
            pushToast(msg, 'error');
            throw err;
          } finally {
            set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
          }
        })();

        trackTempIdResolution(
          tempId,
          syncPromise.then((res) => res.id)
        );
        return syncPromise;
      }),

    deleteExpense: (id, options) =>
      mutationGuard.run('deleteExpense', { id }, async () => {
        const snapshot = takeSnapshot(get());
        const realOrMappedId = id > 0 ? id : get().resolvedIdMap[id] ?? id;

        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

        set((s) => ({
          expenses: s.expenses.filter((e) => e.id !== id && e.id !== realOrMappedId),
          syncingCount: s.syncingCount + 1,
          globalError: null,
        }));

        const toastId = pushToast('Expense removed', 'success');
        options?.onOptimistic?.();

        try {
          const realId = await resolveRealId(realOrMappedId, () => get().resolvedIdMap);
          await api.deleteExpense(realId);
          options?.onSynced?.();
          void get().refreshInBackground();
        } catch (err: any) {
          const msg = err?.message || 'Failed to delete expense. Reverted.';
          get().dismissToast(toastId);
          if (mutationEpoch === myEpoch) {
            set({ ...snapshot, globalError: msg });
          } else {
            void get().refreshInBackground();
            set({ globalError: msg });
          }
          options?.onRollback?.(err);
          pushToast(msg, 'error');
          throw err;
        } finally {
          set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
        }
      }),

    updateSettings: (data, options) =>
      mutationGuard.run('updateSettings', data, async () => {
        const snapshot = takeSnapshot(get());
        mutationEpoch += 1;
        const myEpoch = mutationEpoch;

        set((s) => ({
          settings: { ...s.settings, ...data },
          syncingCount: s.syncingCount + 1,
          globalError: null,
        }));

        const toastId = pushToast('Settings saved!', 'success');
        options?.onOptimistic?.();

        try {
          await api.updateSettings(data);
          options?.onSynced?.();
          void get().refreshInBackground();
        } catch (err: any) {
          const msg = err?.message || 'Failed to save settings. Reverted.';
          get().dismissToast(toastId);
          if (mutationEpoch === myEpoch) {
            set({ ...snapshot, globalError: msg });
          } else {
            void get().refreshInBackground();
            set({ globalError: msg });
          }
          options?.onRollback?.(err);
          pushToast(msg, 'error');
          throw err;
        } finally {
          set((s) => ({ syncingCount: Math.max(0, s.syncingCount - 1) }));
        }
      }),
  };
});

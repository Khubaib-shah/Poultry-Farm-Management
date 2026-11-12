import {
  Supplier,
  Vehicle,
  PurchaseLoad,
  LoadExpense,
  StockBatch,
  StockMovement,
  DealerTransaction,
  Shop,
  Sale,
  Worker,
  WorkerPayment,
  BusinessExpense,
  DashboardData,
  ReportData,
  AppSettings,
  BootstrapData,
} from '../types/index.ts';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) errMsg = data.error;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // Unified Bootstrap
  getBootstrap: () => fetch('/api/bootstrap').then((r) => handleResponse<BootstrapData>(r)),

  // Settings
  getSettings: () => fetch('/api/settings').then((r) => handleResponse<AppSettings>(r)),
  updateSettings: (data: Partial<AppSettings>) =>
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<{ success: boolean }>(r)),

  // Dashboard
  getDashboard: (params?: { period?: string; startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.period) sp.set('period', params.period);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    return fetch(`/api/dashboard?${sp.toString()}`).then((r) => handleResponse<DashboardData>(r));
  },

  // Reports
  getReports: (startDate: string, endDate: string) =>
    fetch(`/api/reports?startDate=${startDate}&endDate=${endDate}`).then((r) =>
      handleResponse<ReportData>(r)
    ),

  // Suppliers
  getSuppliers: () => fetch('/api/suppliers').then((r) => handleResponse<Supplier[]>(r)),
  getSupplier: (id: number) =>
    fetch(`/api/suppliers/${id}`).then((r) =>
      handleResponse<{
        supplier: Supplier;
        currentBalance: number;
        totalDebit: number;
        totalCredit: number;
        ledger: DealerTransaction[];
        purchaseLoads: PurchaseLoad[];
      }>(r)
    ),
  createSupplier: (data: Partial<Supplier>) =>
    fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Supplier>(r)),
  updateSupplier: (id: number, data: Partial<Supplier>) =>
    fetch(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Supplier>(r)),

  // Dealer Ledger
  getDealerTransactions: (supplierId?: number) => {
    const url = supplierId ? `/api/dealer-ledger?supplierId=${supplierId}` : '/api/dealer-ledger';
    return fetch(url).then((r) => handleResponse<DealerTransaction[]>(r));
  },
  recordSupplierPayment: (data: {
    supplierId: number;
    amount: number;
    transactionDate?: string;
    paymentMethod?: string;
    notes?: string;
  }) =>
    fetch('/api/dealer-ledger/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<DealerTransaction>(r)),

  // Purchases & Loads
  getPurchases: () => fetch('/api/purchases').then((r) => handleResponse<PurchaseLoad[]>(r)),
  getPurchase: (id: number) => fetch(`/api/purchases/${id}`).then((r) => handleResponse<PurchaseLoad>(r)),
  createPurchase: (data: {
    supplierId: number;
    purchaseDate: string;
    totalWeightKg: number;
    purchaseAmount: number;
    vehicleNumber?: string;
    driverName?: string;
    notes?: string;
  }) =>
    fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<PurchaseLoad>(r)),
  addLoadExpense: (
    loadId: number,
    data: { category: string; amount: number; expenseDate?: string; description?: string }
  ) =>
    fetch(`/api/purchases/${loadId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<LoadExpense>(r)),
  deleteLoadExpense: (loadId: number, expenseId: number) =>
    fetch(`/api/purchases/${loadId}/expenses/${expenseId}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean }>(r)
    ),
  receiveStock: (
    loadId: number,
    data: {
      receivingDate: string;
      receivedPieces: number;
      deadPieces?: number;
      damagedPieces?: number;
      notes?: string;
    }
  ) =>
    fetch(`/api/purchases/${loadId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<StockBatch>(r)),

  // Inventory
  getBatches: () => fetch('/api/inventory/batches').then((r) => handleResponse<StockBatch[]>(r)),
  getMovements: (limit = 100) =>
    fetch(`/api/inventory/movements?limit=${limit}`).then((r) =>
      handleResponse<StockMovement[]>(r)
    ),
  adjustStock: (data: {
    stockBatchId: number;
    quantityChange: number;
    reason: string;
    adjustmentType?: string;
  }) =>
    fetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<StockMovement>(r)),

  // Sales
  getSales: (params?: { startDate?: string; endDate?: string; type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    if (params?.type) sp.set('type', params.type);
    return fetch(`/api/sales?${sp.toString()}`).then((r) => handleResponse<Sale[]>(r));
  },
  getSale: (id: number) => fetch(`/api/sales/${id}`).then((r) => handleResponse<Sale>(r)),
  createOwnShopSale: (data: {
    saleDate: string;
    quantityPieces: number;
    totalSaleAmount: number;
    notes?: string;
  }) =>
    fetch('/api/sales/own-shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) =>
      handleResponse<{
        sale: Sale;
        summary: any;
      }>(r)
    ),
  createWholesaleSale: (data: {
    shopId: number;
    saleDate: string;
    quantityPieces: number;
    totalSaleAmount: number;
    notes?: string;
  }) =>
    fetch('/api/sales/wholesale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<{ sale: Sale; summary: any }>(r)),

  // Wholesale Shops
  getShops: () => fetch('/api/shops').then((r) => handleResponse<Shop[]>(r)),
  createShop: (data: Partial<Shop>) =>
    fetch('/api/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Shop>(r)),

  // Workers
  getWorkers: () => fetch('/api/workers').then((r) => handleResponse<Worker[]>(r)),
  createWorker: (data: Partial<Worker>) =>
    fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Worker>(r)),
  updateWorker: (id: number, data: Partial<Worker>) =>
    fetch(`/api/workers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Worker>(r)),
  getAllWorkerPayments: () =>
    fetch('/api/worker-payments').then((r) => handleResponse<WorkerPayment[]>(r)),
  getWorkerPayments: (workerId: number) =>
    fetch(`/api/workers/${workerId}/payments`).then((r) => handleResponse<WorkerPayment[]>(r)),
  recordWorkerPayment: (
    workerId: number,
    data: { amount: number; paymentDate?: string; paymentMethod?: string; description?: string }
  ) =>
    fetch(`/api/workers/${workerId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<WorkerPayment>(r)),

  // General Expenses
  getExpenses: () => fetch('/api/expenses').then((r) => handleResponse<BusinessExpense[]>(r)),
  createExpense: (data: {
    category: string;
    amount: number;
    expenseDate?: string;
    paymentMethod?: string;
    description?: string;
  }) =>
    fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<BusinessExpense>(r)),
  deleteExpense: (id: number) =>
    fetch(`/api/expenses/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean }>(r)
    ),

  // Vehicles
  getVehicles: () => fetch('/api/vehicles').then((r) => handleResponse<Vehicle[]>(r)),
  createVehicle: (data: Partial<Vehicle>) =>
    fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Vehicle>(r)),

  // Seed sample data
  seedData: (force = false) =>
    fetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    }).then((r) => handleResponse<{ message: string; seeded?: boolean }>(r)),
};

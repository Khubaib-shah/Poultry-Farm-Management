import {
  Supplier,
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
  updateSettings: (data: Partial<AppSettings>) =>
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<{ success: boolean }>(r)),

  // Suppliers
  createSupplier: (data: Partial<Supplier>) =>
    fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Supplier>(r)),

  // Dealer Ledger
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
        summary: unknown;
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
    }).then((r) => handleResponse<{ sale: Sale; summary: unknown }>(r)),

  // Wholesale Shops
  createShop: (data: Partial<Shop>) =>
    fetch('/api/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Shop>(r)),

  // Workers
  createWorker: (data: Partial<Worker>) =>
    fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Worker>(r)),
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

  // Seed sample data
  seedData: (force = false) =>
    fetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    }).then((r) => handleResponse<{ message: string; seeded?: boolean }>(r)),
};

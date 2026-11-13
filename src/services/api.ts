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
  AuthUser,
} from '../types/index.ts';

const AUTH_TOKEN_KEY = 'checkin_auth_token';

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function getStoredAuthToken(): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null) {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredAuthToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers,
  });

  if (response.status === 401 && url !== '/api/auth/login' && url !== '/api/auth/me') {
    setStoredAuthToken(null);
    unauthorizedHandler?.();
  }

  return response;
}

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
  // Authentication
  auth: {
    me: () =>
      apiFetch('/api/auth/me').then((r) =>
        handleResponse<{ authenticated: boolean; user: AuthUser | null }>(r)
      ),
    login: async (credentials: { email: string; password: string }) => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await handleResponse<{ user: AuthUser; token: string }>(res);
      if (data.token) {
        setStoredAuthToken(data.token);
      }
      return data;
    },
    logout: async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } finally {
        setStoredAuthToken(null);
      }
    },
  },

  // Unified Bootstrap
  getBootstrap: () => apiFetch('/api/bootstrap').then((r) => handleResponse<BootstrapData>(r)),

  // Settings
  updateSettings: (data: Partial<AppSettings>) =>
    apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<{ success: boolean }>(r)),

  // Suppliers
  createSupplier: (data: Partial<Supplier>) =>
    apiFetch('/api/suppliers', {
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
    apiFetch('/api/dealer-ledger/payment', {
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
    apiFetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<PurchaseLoad>(r)),
  addLoadExpense: (
    loadId: number,
    data: { category: string; amount: number; expenseDate?: string; description?: string }
  ) =>
    apiFetch(`/api/purchases/${loadId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<LoadExpense>(r)),
  deleteLoadExpense: (loadId: number, expenseId: number) =>
    apiFetch(`/api/purchases/${loadId}/expenses/${expenseId}`, { method: 'DELETE' }).then((r) =>
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
    apiFetch(`/api/purchases/${loadId}/receive`, {
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
    apiFetch('/api/inventory/adjust', {
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
    apiFetch('/api/sales/own-shop', {
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
    apiFetch('/api/sales/wholesale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<{ sale: Sale; summary: unknown }>(r)),

  // Wholesale Shops
  createShop: (data: Partial<Shop>) =>
    apiFetch('/api/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Shop>(r)),

  // Workers
  createWorker: (data: Partial<Worker>) =>
    apiFetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Worker>(r)),
  recordWorkerPayment: (
    workerId: number,
    data: { amount: number; paymentDate?: string; paymentMethod?: string; description?: string }
  ) =>
    apiFetch(`/api/workers/${workerId}/payments`, {
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
    apiFetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<BusinessExpense>(r)),
  deleteExpense: (id: number) =>
    apiFetch(`/api/expenses/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean }>(r)
    ),

  // Seed sample data
  seedData: (force = false) =>
    apiFetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    }).then((r) => handleResponse<{ message: string; seeded?: boolean }>(r)),
};

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
import {
  PaginatedResponse,
  buildPaginationQueryString,
} from '../utils/paginationCache.ts';
import {
  demoLocalStore,
  matchStaticDemoCredentials,
} from '../utils/demoLocalStore.ts';

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

  if (
    response.status === 401 &&
    url !== '/api/auth/login' &&
    url !== '/api/auth/demo' &&
    url !== '/api/auth/me'
  ) {
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

function runLocal<T>(fn: () => T): Promise<T> {
  return Promise.resolve().then(fn);
}

export const api = {
  // Authentication
  auth: {
    me: () => {
      if (demoLocalStore.isSessionActive()) {
        return runLocal(() => demoLocalStore.getSessionUser());
      }
      return apiFetch('/api/auth/me').then((r) =>
        handleResponse<{ authenticated: boolean; user: AuthUser | null }>(r)
      );
    },
    login: async (credentials: { email: string; password: string }) => {
      if (matchStaticDemoCredentials(credentials.email, credentials.password)) {
        setStoredAuthToken(null);
        return runLocal(() => demoLocalStore.activateSession({ resetToFresh: true }));
      }
      demoLocalStore.clearSession();
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
    demoLogin: async () => {
      setStoredAuthToken(null);
      return runLocal(() => demoLocalStore.activateSession({ resetToFresh: true }));
    },
    logout: async () => {
      if (demoLocalStore.isSessionActive()) {
        demoLocalStore.clearSession();
        setStoredAuthToken(null);
        return;
      }
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } finally {
        setStoredAuthToken(null);
      }
    },
  },

  // Unified Bootstrap
  getBootstrap: () => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.getBootstrap());
    }
    return apiFetch('/api/bootstrap').then((r) => handleResponse<BootstrapData>(r));
  },

  // Server-paginated list fetcher (limit/skip + filters + sort)
  getPaginated: <T>(
    endpoint: string,
    params: Record<string, string | number | boolean | null | undefined>
  ): Promise<PaginatedResponse<T>> => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.getPaginated<T>(endpoint, params));
    }
    const qs = buildPaginationQueryString(params);
    const url = qs ? `${endpoint}?${qs}` : endpoint;
    return apiFetch(url).then((r) => handleResponse<PaginatedResponse<T>>(r));
  },

  // Settings
  updateSettings: (data: Partial<AppSettings>) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.updateSettings(data));
    }
    return apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<{ success: boolean }>(r));
  },

  // Suppliers
  createSupplier: (data: Partial<Supplier>) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.createSupplier(data));
    }
    return apiFetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Supplier>(r));
  },
  deleteSupplier: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteSupplier(id));
    }
    return apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean }>(r)
    );
  },

  // Dealer Ledger
  recordSupplierPayment: (data: {
    supplierId: number;
    amount: number;
    transactionDate?: string;
    paymentMethod?: string;
    notes?: string;
  }) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.recordSupplierPayment(data));
    }
    return apiFetch('/api/dealer-ledger/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<DealerTransaction>(r));
  },
  deleteDealerTransaction: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteDealerTransaction(id));
    }
    return apiFetch(`/api/dealer-ledger/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean; cascadedLoad?: boolean }>(r)
    );
  },

  // Purchases & Loads
  createPurchase: (data: {
    supplierId: number;
    purchaseDate: string;
    totalWeightKg: number;
    purchaseAmount: number;
    vehicleNumber?: string;
    driverName?: string;
    notes?: string;
  }) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.createPurchase(data));
    }
    return apiFetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<PurchaseLoad>(r));
  },
  addLoadExpense: (
    loadId: number,
    data: { category: string; amount: number; expenseDate?: string; description?: string }
  ) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.addLoadExpense(loadId, data));
    }
    return apiFetch(`/api/purchases/${loadId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<LoadExpense>(r));
  },
  deleteLoadExpense: (loadId: number, expenseId: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteLoadExpense(loadId, expenseId));
    }
    return apiFetch(`/api/purchases/${loadId}/expenses/${expenseId}`, { method: 'DELETE' }).then(
      (r) => handleResponse<{ success: boolean }>(r)
    );
  },
  deletePurchase: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deletePurchase(id));
    }
    return apiFetch(`/api/purchases/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean }>(r)
    );
  },
  receiveStock: (
    loadId: number,
    data: {
      receivingDate: string;
      receivedPieces: number;
      deadPieces?: number;
      damagedPieces?: number;
      notes?: string;
    }
  ) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.receiveStock(loadId, data));
    }
    return apiFetch(`/api/purchases/${loadId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<StockBatch>(r));
  },

  // Inventory
  adjustStock: (data: {
    stockBatchId: number;
    quantityChange: number;
    reason: string;
    adjustmentType?: string;
  }) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.adjustStock(data));
    }
    return apiFetch('/api/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<StockMovement>(r));
  },
  deleteBatch: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteBatch(id));
    }
    return apiFetch(`/api/inventory/batches/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean; deletedSalesCount?: number }>(r)
    );
  },
  deleteMovement: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteMovement(id));
    }
    return apiFetch(`/api/inventory/movements/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean; action?: string }>(r)
    );
  },

  // Sales
  createOwnShopSale: (data: {
    saleDate: string;
    quantityPieces: number;
    totalSaleAmount: number;
    notes?: string;
  }) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.createOwnShopSale(data));
    }
    return apiFetch('/api/sales/own-shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) =>
      handleResponse<{
        sale: Sale;
        summary: unknown;
      }>(r)
    );
  },
  createWholesaleSale: (data: {
    shopId: number;
    saleDate: string;
    quantityPieces: number;
    totalSaleAmount: number;
    notes?: string;
  }) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.createWholesaleSale(data));
    }
    return apiFetch('/api/sales/wholesale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<{ sale: Sale; summary: unknown }>(r));
  },
  deleteSale: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteSale(id));
    }
    return apiFetch(`/api/sales/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean; restoredPieces?: number }>(r)
    );
  },

  // Wholesale Shops
  createShop: (data: Partial<Shop>) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.createShop(data));
    }
    return apiFetch('/api/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Shop>(r));
  },
  deleteShop: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteShop(id));
    }
    return apiFetch(`/api/shops/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean }>(r)
    );
  },

  // Workers
  createWorker: (data: Partial<Worker>) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.createWorker(data));
    }
    return apiFetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<Worker>(r));
  },
  deleteWorker: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteWorker(id));
    }
    return apiFetch(`/api/workers/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean }>(r)
    );
  },
  recordWorkerPayment: (
    workerId: number,
    data: { amount: number; paymentDate?: string; paymentMethod?: string; description?: string }
  ) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.recordWorkerPayment(workerId, data));
    }
    return apiFetch(`/api/workers/${workerId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<WorkerPayment>(r));
  },
  deleteWorkerPayment: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteWorkerPayment(id));
    }
    return apiFetch(`/api/worker-payments/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean }>(r)
    );
  },

  // General Expenses
  createExpense: (data: {
    category: string;
    amount: number;
    expenseDate?: string;
    paymentMethod?: string;
    description?: string;
  }) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.createExpense(data));
    }
    return apiFetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handleResponse<BusinessExpense>(r));
  },
  deleteExpense: (id: number) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.deleteExpense(id));
    }
    return apiFetch(`/api/expenses/${id}`, { method: 'DELETE' }).then((r) =>
      handleResponse<{ success: boolean }>(r)
    );
  },

  // Seed sample data
  seedData: (force = false) => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => {
        const res = demoLocalStore.resetWorkspace();
        return { message: res.message, seeded: true };
      });
    }
    return apiFetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    }).then((r) => handleResponse<{ message: string; seeded?: boolean }>(r));
  },

  // Mode-aware workspace reset (real clears all real records via DB; demo resets local static-JSON sandbox)
  resetWorkspace: () => {
    if (demoLocalStore.isSessionActive()) {
      return runLocal(() => demoLocalStore.resetWorkspace());
    }
    return apiFetch('/api/reset', {
      method: 'POST',
    }).then((r) =>
      handleResponse<{ success: boolean; mode: 'real' | 'demo'; message: string }>(r)
    );
  },
};

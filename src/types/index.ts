export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  openingBalance: string;
  notes: string | null;
  currentBalance?: number;
  totalPurchasesAmount?: number;
  purchaseCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: number;
  vehicleNumber: string;
  driverName: string | null;
  driverPhone: string | null;
  notes: string | null;
  createdAt: string;
}

export interface LoadExpense {
  id: number;
  purchaseLoadId: number;
  category: string;
  amount: string;
  expenseDate: string;
  description: string | null;
  createdAt: string;
}

export interface StockBatch {
  id: number;
  batchNumber: string;
  purchaseLoadId: number;
  loadNumber?: string;
  supplierName?: string;
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

export interface PurchaseLoad {
  id: number;
  loadNumber: string;
  supplierId: number;
  supplierName: string;
  supplierPhone?: string;
  purchaseDate: string;
  totalWeightKg: string;
  purchaseAmount: string;
  purchaseRatePerKg?: number;
  vehicleNumber: string | null;
  driverName: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  expenses?: LoadExpense[];
  totalExpenses?: number;
  totalLandedCost?: number;
  stockBatch?: StockBatch | null;
  costPerSaleablePiece?: number;
}

export interface StockMovement {
  id: number;
  stockBatchId: number;
  batchNumber: string;
  movementType: 'STOCK_IN' | 'SALE_OUT' | 'WHOLESALE_OUT' | 'DAMAGE' | 'ADJUSTMENT';
  quantity: number;
  balanceAfter: number;
  unitCost: string;
  referenceType: string | null;
  referenceId: number | null;
  notes: string | null;
  createdAt: string;
}

export interface DealerTransaction {
  id: number;
  supplierId: number;
  supplierName?: string;
  transactionDate: string;
  transactionType: 'PURCHASE_DEBIT' | 'OTHER_DEBIT' | 'PAYMENT_CREDIT' | 'ADJUSTMENT_CREDIT';
  debitAmount: string;
  creditAmount: string;
  balanceAfter: string;
  referenceType: string | null;
  referenceId: number | null;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Shop {
  id: number;
  shopName: string;
  ownerName: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  totalPiecesDelivered?: number;
  totalSalesAmount?: number;
  ordersCount?: number;
  createdAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  stockBatchId: number;
  batchNumber?: string;
  quantity: number;
  unitCost: string;
  totalCost: string;
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  saleType: 'OWN_SHOP' | 'WHOLESALE';
  saleDate: string;
  shopId: number | null;
  shopName: string | null;
  totalPieces: number;
  totalAmount: string;
  totalCost: string;
  totalProfit: string;
  sellingPricePerPiece: string;
  costPerPiece: string;
  profitPerPiece: string;
  notes: string | null;
  createdAt: string;
  items?: SaleItem[];
}

export interface Worker {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  totalPaid?: number;
  paymentCount?: number;
  createdAt: string;
}

export interface WorkerPayment {
  id: number;
  workerId: number;
  workerName?: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  description: string | null;
  createdAt: string;
}

export interface BusinessExpense {
  id: number;
  category: string;
  amount: string;
  expenseDate: string;
  paymentMethod: string;
  description: string | null;
  createdAt: string;
}

export interface DashboardData {
  period: string;
  startDate: string;
  endDate: string;
  kpis: {
    revenue: number;
    ownShopRevenue: number;
    wholesaleRevenue: number;
    cogs: number;
    grossProfit: number;
    netProfit: number;
    generalExpenses: number;
    workerPayments: number;
    totalAvailableStock: number;
    totalPurchaseAmount: number;
    totalPurchaseWeight: number;
    totalLoadExpenses: number;
    dealerOutstandingBalance: number;
    totalPiecesSold: number;
  };
  charts: {
    daily: Array<{
      date: string;
      revenue: number;
      expenses: number;
      cogs: number;
      grossProfit: number;
      netProfit: number;
      piecesSold: number;
    }>;
  };
  recent: {
    sales: Sale[];
    purchases: PurchaseLoad[];
    expenses: BusinessExpense[];
    lowStockBatches: StockBatch[];
  };
}

export interface LoadExpenseDetail extends LoadExpense {
  loadNumber?: string;
  supplierName?: string;
}

export interface ReportData {
  startDate: string;
  endDate: string;
  summary: {
    totalRevenue: number;
    ownShopRevenue: number;
    wholesaleRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPercent: number;
    generalExpenses: number;
    workerPayments: number;
    netProfit: number;
    netMarginPercent: number;
    totalPiecesSold: number;
    totalPurchasesAmount: number;
    totalPurchasesWeight: number;
    totalLoadExpenses: number;
  };
  expensesByCategory: Record<string, number>;
  sales: Sale[];
  generalExpenses: BusinessExpense[];
  workerPayments: WorkerPayment[];
  purchases: PurchaseLoad[];
  loadExpenses?: LoadExpenseDetail[];
  dealerPayments?: DealerTransaction[];
  stockValuation?: {
    totalPieces: number;
    totalValue: number;
    activeBatchesCount: number;
  };
}

export interface BootstrapData {
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

export interface AppSettings {
  businessName: string;
  businessLocation: string;
  examplePrice1: string;
  examplePrice2: string;
  lowStockThreshold: string;
}

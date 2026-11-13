import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  name: text('name'),
  role: text('role').default('admin').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Suppliers
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  openingBalance: numeric('opening_balance', { precision: 14, scale: 2 }).default('0.00').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Vehicles
export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  vehicleNumber: text('vehicle_number').notNull(),
  driverName: text('driver_name'),
  driverPhone: text('driver_phone'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Purchase Loads
export const purchaseLoads = pgTable('purchase_loads', {
  id: serial('id').primaryKey(),
  loadNumber: text('load_number').notNull().unique(),
  supplierId: integer('supplier_id')
    .references(() => suppliers.id)
    .notNull(),
  purchaseDate: date('purchase_date').notNull(), // YYYY-MM-DD
  totalWeightKg: numeric('total_weight_kg', { precision: 10, scale: 2 }).notNull(),
  purchaseAmount: numeric('purchase_amount', { precision: 14, scale: 2 }).notNull(),
  vehicleNumber: text('vehicle_number'),
  driverName: text('driver_name'),
  status: text('status').default('RECEIVED').notNull(), // PENDING_RECEIVING, RECEIVED, CLOSED
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Load Expenses
export const loadExpenses = pgTable('load_expenses', {
  id: serial('id').primaryKey(),
  purchaseLoadId: integer('purchase_load_id')
    .references(() => purchaseLoads.id, { onDelete: 'cascade' })
    .notNull(),
  category: text('category').notNull(), // Fuel, Transportation, Loading, Unloading, Driver Expense, Other
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  expenseDate: date('expense_date').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. Stock Batches
export const stockBatches = pgTable('stock_batches', {
  id: serial('id').primaryKey(),
  batchNumber: text('batch_number').notNull().unique(),
  purchaseLoadId: integer('purchase_load_id')
    .references(() => purchaseLoads.id)
    .notNull()
    .unique(),
  receivingDate: date('receiving_date').notNull(),
  receivedPieces: integer('received_pieces').notNull(),
  deadPieces: integer('dead_pieces').default(0).notNull(),
  damagedPieces: integer('damaged_pieces').default(0).notNull(),
  originalSaleablePieces: integer('original_saleable_pieces').notNull(),
  soldPieces: integer('sold_pieces').default(0).notNull(),
  remainingPieces: integer('remaining_pieces').notNull(),
  purchaseAmount: numeric('purchase_amount', { precision: 14, scale: 2 }).notNull(),
  totalLoadExpenses: numeric('total_load_expenses', { precision: 14, scale: 2 }).default('0.00').notNull(),
  totalLandedCost: numeric('total_landed_cost', { precision: 14, scale: 2 }).notNull(),
  costPerPiece: numeric('cost_per_piece', { precision: 10, scale: 2 }).notNull(),
  isClosed: boolean('is_closed').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. Stock Movements
export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  stockBatchId: integer('stock_batch_id')
    .references(() => stockBatches.id)
    .notNull(),
  movementType: text('movement_type').notNull(), // STOCK_IN, SALE_OUT, WHOLESALE_OUT, DAMAGE, ADJUSTMENT
  quantity: integer('quantity').notNull(), // positive for in, negative for out
  balanceAfter: integer('balance_after').notNull(),
  unitCost: numeric('unit_cost', { precision: 10, scale: 2 }).notNull(),
  referenceType: text('reference_type'), // PURCHASE_LOAD, SALE, SHOP_DISTRIBUTION, MANUAL_ADJUSTMENT
  referenceId: integer('reference_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 8. Dealer Ledger / Transactions
export const dealerTransactions = pgTable('dealer_transactions', {
  id: serial('id').primaryKey(),
  supplierId: integer('supplier_id')
    .references(() => suppliers.id)
    .notNull(),
  transactionDate: date('transaction_date').notNull(),
  transactionType: text('transaction_type').notNull(), // PURCHASE_DEBIT, OTHER_DEBIT, PAYMENT_CREDIT, ADJUSTMENT_CREDIT
  debitAmount: numeric('debit_amount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  creditAmount: numeric('credit_amount', { precision: 14, scale: 2 }).default('0.00').notNull(),
  balanceAfter: numeric('balance_after', { precision: 14, scale: 2 }).notNull(),
  referenceType: text('reference_type'), // PURCHASE_LOAD, PAYMENT, OPENING_BALANCE, ADJUSTMENT
  referenceId: integer('reference_id'),
  paymentMethod: text('payment_method'), // CASH, BANK_TRANSFER, CHEQUE, OTHER
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. Wholesale Shops
export const shops = pgTable('shops', {
  id: serial('id').primaryKey(),
  shopName: text('shop_name').notNull(),
  ownerName: text('owner_name'),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 10. Sales
export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  saleType: text('sale_type').notNull(), // OWN_SHOP, WHOLESALE
  saleDate: date('sale_date').notNull(),
  shopId: integer('shop_id').references(() => shops.id),
  totalPieces: integer('total_pieces').notNull(),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
  totalCost: numeric('total_cost', { precision: 14, scale: 2 }).notNull(),
  totalProfit: numeric('total_profit', { precision: 14, scale: 2 }).notNull(),
  sellingPricePerPiece: numeric('selling_price_per_piece', { precision: 10, scale: 2 }).notNull(),
  costPerPiece: numeric('cost_per_piece', { precision: 10, scale: 2 }).notNull(),
  profitPerPiece: numeric('profit_per_piece', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 11. Sale Items (FIFO consumption mapping)
export const saleItems = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  saleId: integer('sale_id')
    .references(() => sales.id, { onDelete: 'cascade' })
    .notNull(),
  stockBatchId: integer('stock_batch_id')
    .references(() => stockBatches.id)
    .notNull(),
  quantity: integer('quantity').notNull(),
  unitCost: numeric('unit_cost', { precision: 10, scale: 2 }).notNull(),
  totalCost: numeric('total_cost', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 12. Workers
export const workers = pgTable('workers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 13. Worker Payments
export const workerPayments = pgTable('worker_payments', {
  id: serial('id').primaryKey(),
  workerId: integer('worker_id')
    .references(() => workers.id)
    .notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate: date('payment_date').notNull(),
  paymentMethod: text('payment_method').default('CASH'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 14. Business Expenses (General)
export const businessExpenses = pgTable('business_expenses', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(), // Electricity, Rent, Maintenance, Food, Tea, Cleaning, Other
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  expenseDate: date('expense_date').notNull(),
  paymentMethod: text('payment_method').default('CASH'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 15. Settings
export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Relations ---

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseLoads: many(purchaseLoads),
  dealerTransactions: many(dealerTransactions),
}));

export const purchaseLoadsRelations = relations(purchaseLoads, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseLoads.supplierId],
    references: [suppliers.id],
  }),
  stockBatch: one(stockBatches),
  loadExpenses: many(loadExpenses),
}));

export const loadExpensesRelations = relations(loadExpenses, ({ one }) => ({
  purchaseLoad: one(purchaseLoads, {
    fields: [loadExpenses.purchaseLoadId],
    references: [purchaseLoads.id],
  }),
}));

export const stockBatchesRelations = relations(stockBatches, ({ one, many }) => ({
  purchaseLoad: one(purchaseLoads, {
    fields: [stockBatches.purchaseLoadId],
    references: [purchaseLoads.id],
  }),
  stockMovements: many(stockMovements),
  saleItems: many(saleItems),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  stockBatch: one(stockBatches, {
    fields: [stockMovements.stockBatchId],
    references: [stockBatches.id],
  }),
}));

export const dealerTransactionsRelations = relations(dealerTransactions, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [dealerTransactions.supplierId],
    references: [suppliers.id],
  }),
}));

export const shopsRelations = relations(shops, ({ many }) => ({
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  shop: one(shops, {
    fields: [sales.shopId],
    references: [shops.id],
  }),
  saleItems: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  stockBatch: one(stockBatches, {
    fields: [saleItems.stockBatchId],
    references: [stockBatches.id],
  }),
}));

export const workersRelations = relations(workers, ({ many }) => ({
  payments: many(workerPayments),
}));

export const workerPaymentsRelations = relations(workerPayments, ({ one }) => ({
  worker: one(workers, {
    fields: [workerPayments.workerId],
    references: [workers.id],
  }),
}));

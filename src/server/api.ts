import express, { Request, Response } from 'express';
import { db } from '../db/index.ts';
import {
  suppliers,
  vehicles,
  purchaseLoads,
  loadExpenses,
  stockBatches,
  stockMovements,
  dealerTransactions,
  shops,
  sales,
  saleItems,
  workers,
  workerPayments,
  businessExpenses,
  settings,
} from '../db/schema.ts';
import { eq, desc, asc, and, gte, lte, sql } from 'drizzle-orm';
import {
  calculatePurchaseRate,
  calculateSaleablePieces,
  calculateLandedCost,
  calculateCostPerPiece,
  calculateSaleMetrics,
  consumeBatchesFifo,
  calculatePnl,
} from '../utils/poultryMath.ts';

export const apiRouter = express.Router();

apiRouter.use(express.json());

// Helper to format Date to YYYY-MM-DD in Pakistan Standard Time (UTC+5)
export function getPakistanDate(d: Date = new Date()): string {
  // PKT is UTC + 5
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const pktDate = new Date(utc + 5 * 3600000);
  return pktDate.toISOString().split('T')[0];
}

// -------------------------------------------------------------
// 1. HEALTH & SETTINGS
// -------------------------------------------------------------
apiRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(suppliers);
    res.json({ status: 'ok', database: 'connected', suppliersCount: result[0]?.count ?? 0 });
  } catch (error: any) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

apiRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const allSettings = await db.select().from(settings);
    const config: Record<string, string> = {
      businessName: 'Al-Madina Poultry Traders',
      businessLocation: 'Lahore Road, Punjab, Pakistan',
      examplePrice1: '1200',
      examplePrice2: '1500',
      lowStockThreshold: '300',
    };
    allSettings.forEach((s) => {
      config[s.key] = s.value;
    });
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/settings', async (req: Request, res: Response) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await db
        .insert(settings)
        .values({
          key,
          value: String(value),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: String(value), updatedAt: new Date() },
        });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 2. SUPPLIERS & DEALER LEDGER
// -------------------------------------------------------------
apiRouter.get('/suppliers', async (_req: Request, res: Response) => {
  try {
    const allSuppliers = await db.select().from(suppliers).orderBy(asc(suppliers.name));

    // Calculate current balance for each supplier from dealer_transactions
    const suppliersWithBalance = await Promise.all(
      allSuppliers.map(async (sup) => {
        const txs = await db
          .select()
          .from(dealerTransactions)
          .where(eq(dealerTransactions.supplierId, sup.id))
          .orderBy(desc(dealerTransactions.id))
          .limit(1);

        const currentBalance = txs.length > 0 ? Number(txs[0].balanceAfter) : Number(sup.openingBalance);

        // Count purchases
        const purchases = await db
          .select({
            totalAmount: sql<string>`coalesce(sum(purchase_amount), '0')`,
            count: sql<number>`count(*)`,
          })
          .from(purchaseLoads)
          .where(eq(purchaseLoads.supplierId, sup.id));

        return {
          ...sup,
          currentBalance,
          totalPurchasesAmount: Number(purchases[0]?.totalAmount || 0),
          purchaseCount: Number(purchases[0]?.count || 0),
        };
      })
    );

    res.json(suppliersWithBalance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/suppliers', async (req: Request, res: Response) => {
  try {
    const { name, phone, address, openingBalance, notes } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const opBal = Number(openingBalance || 0);

    const [created] = await db
      .insert(suppliers)
      .values({
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        openingBalance: opBal.toFixed(2),
        notes: notes?.trim() || null,
      })
      .returning();

    // If opening balance > 0, record initial opening transaction
    if (opBal !== 0) {
      await db.insert(dealerTransactions).values({
        supplierId: created.id,
        transactionDate: getPakistanDate(),
        transactionType: opBal > 0 ? 'PURCHASE_DEBIT' : 'PAYMENT_CREDIT',
        debitAmount: opBal > 0 ? opBal.toFixed(2) : '0.00',
        creditAmount: opBal < 0 ? Math.abs(opBal).toFixed(2) : '0.00',
        balanceAfter: opBal.toFixed(2),
        referenceType: 'OPENING_BALANCE',
        notes: 'Initial Opening Balance',
      });
    }

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const supplierId = parseInt(req.params.id, 10);
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Ledger transactions
    const ledger = await db
      .select()
      .from(dealerTransactions)
      .where(eq(dealerTransactions.supplierId, supplierId))
      .orderBy(desc(dealerTransactions.transactionDate), desc(dealerTransactions.id));

    // Purchase history
    const loads = await db
      .select()
      .from(purchaseLoads)
      .where(eq(purchaseLoads.supplierId, supplierId))
      .orderBy(desc(purchaseLoads.purchaseDate), desc(purchaseLoads.id));

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;
    ledger.forEach((t) => {
      totalDebit += Number(t.debitAmount);
      totalCredit += Number(t.creditAmount);
    });

    const currentBalance = ledger.length > 0 ? Number(ledger[0].balanceAfter) : Number(supplier.openingBalance);

    res.json({
      supplier,
      currentBalance,
      totalDebit,
      totalCredit,
      ledger,
      purchaseLoads: loads,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.put('/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const supplierId = parseInt(req.params.id, 10);
    const { name, phone, address, notes } = req.body;

    const [updated] = await db
      .update(suppliers)
      .set({
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, supplierId))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 3. DEALER TRANSACTIONS & PAYMENTS
// -------------------------------------------------------------
apiRouter.get('/dealer-ledger', async (req: Request, res: Response) => {
  try {
    const supplierId = req.query.supplierId ? parseInt(String(req.query.supplierId), 10) : null;

    let query = db
      .select({
        id: dealerTransactions.id,
        supplierId: dealerTransactions.supplierId,
        supplierName: suppliers.name,
        transactionDate: dealerTransactions.transactionDate,
        transactionType: dealerTransactions.transactionType,
        debitAmount: dealerTransactions.debitAmount,
        creditAmount: dealerTransactions.creditAmount,
        balanceAfter: dealerTransactions.balanceAfter,
        referenceType: dealerTransactions.referenceType,
        referenceId: dealerTransactions.referenceId,
        paymentMethod: dealerTransactions.paymentMethod,
        notes: dealerTransactions.notes,
        createdAt: dealerTransactions.createdAt,
      })
      .from(dealerTransactions)
      .innerJoin(suppliers, eq(dealerTransactions.supplierId, suppliers.id))
      .orderBy(desc(dealerTransactions.transactionDate), desc(dealerTransactions.id));

    const records = supplierId
      ? await query.where(eq(dealerTransactions.supplierId, supplierId))
      : await query;

    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/dealer-ledger/payment', async (req: Request, res: Response) => {
  try {
    const { supplierId, amount, transactionDate, paymentMethod, notes } = req.body;
    const supId = parseInt(supplierId, 10);
    const paymentAmount = Number(amount);

    if (!supId || isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid supplier and positive payment amount are required' });
    }

    // Get latest balance
    const lastTx = await db
      .select()
      .from(dealerTransactions)
      .where(eq(dealerTransactions.supplierId, supId))
      .orderBy(desc(dealerTransactions.id))
      .limit(1);

    const prevBalance = lastTx.length > 0 ? Number(lastTx[0].balanceAfter) : 0;
    const newBalance = Number((prevBalance - paymentAmount).toFixed(2));

    const [tx] = await db
      .insert(dealerTransactions)
      .values({
        supplierId: supId,
        transactionDate: transactionDate || getPakistanDate(),
        transactionType: 'PAYMENT_CREDIT',
        debitAmount: '0.00',
        creditAmount: paymentAmount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        referenceType: 'PAYMENT',
        paymentMethod: paymentMethod || 'CASH',
        notes: notes?.trim() || null,
      })
      .returning();

    res.status(201).json(tx);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 4. VEHICLES
// -------------------------------------------------------------
apiRouter.get('/vehicles', async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(vehicles).orderBy(asc(vehicles.vehicleNumber));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/vehicles', async (req: Request, res: Response) => {
  try {
    const { vehicleNumber, driverName, driverPhone, notes } = req.body;
    if (!vehicleNumber?.trim()) {
      return res.status(400).json({ error: 'Vehicle number is required' });
    }
    const [created] = await db
      .insert(vehicles)
      .values({
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        driverName: driverName?.trim() || null,
        driverPhone: driverPhone?.trim() || null,
        notes: notes?.trim() || null,
      })
      .returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 5. PURCHASES & LOADS
// -------------------------------------------------------------
apiRouter.get('/purchases', async (_req: Request, res: Response) => {
  try {
    const loads = await db
      .select({
        id: purchaseLoads.id,
        loadNumber: purchaseLoads.loadNumber,
        supplierId: purchaseLoads.supplierId,
        supplierName: suppliers.name,
        purchaseDate: purchaseLoads.purchaseDate,
        totalWeightKg: purchaseLoads.totalWeightKg,
        purchaseAmount: purchaseLoads.purchaseAmount,
        vehicleNumber: purchaseLoads.vehicleNumber,
        driverName: purchaseLoads.driverName,
        status: purchaseLoads.status,
        notes: purchaseLoads.notes,
        createdAt: purchaseLoads.createdAt,
      })
      .from(purchaseLoads)
      .innerJoin(suppliers, eq(purchaseLoads.supplierId, suppliers.id))
      .orderBy(desc(purchaseLoads.purchaseDate), desc(purchaseLoads.id));

    // Populate expenses and stock batch summary for each load
    const result = await Promise.all(
      loads.map(async (load) => {
        const expenses = await db
          .select({
            totalExpenses: sql<string>`coalesce(sum(amount), '0')`,
          })
          .from(loadExpenses)
          .where(eq(loadExpenses.purchaseLoadId, load.id));

        const batch = await db
          .select()
          .from(stockBatches)
          .where(eq(stockBatches.purchaseLoadId, load.id))
          .limit(1);

        const totalExp = Number(expenses[0]?.totalExpenses || 0);
        const landedCost = calculateLandedCost(Number(load.purchaseAmount), totalExp);
        const purchaseRatePerKg = calculatePurchaseRate(
          Number(load.purchaseAmount),
          Number(load.totalWeightKg)
        );

        return {
          ...load,
          purchaseRatePerKg,
          totalExpenses: totalExp,
          totalLandedCost: landedCost,
          stockBatch: batch[0] || null,
        };
      })
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/purchases', async (req: Request, res: Response) => {
  try {
    const {
      supplierId,
      purchaseDate,
      totalWeightKg,
      purchaseAmount,
      vehicleNumber,
      driverName,
      notes,
    } = req.body;

    const supId = parseInt(supplierId, 10);
    const weightKg = Number(totalWeightKg);
    const amount = Number(purchaseAmount);

    if (!supId || isNaN(weightKg) || weightKg <= 0 || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Valid supplier, total weight in KG, and total purchase amount are required',
      });
    }

    // Auto-generate load number: LOAD-YYYYMMDD-XXXX
    const dateStr = purchaseDate || getPakistanDate();
    const countToday = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseLoads);
    const loadNumber = `LOAD-${dateStr.replace(/-/g, '')}-${String(Number(countToday[0]?.count || 0) + 1).padStart(3, '0')}`;

    // Insert purchase load
    const [newLoad] = await db
      .insert(purchaseLoads)
      .values({
        loadNumber,
        supplierId: supId,
        purchaseDate: dateStr,
        totalWeightKg: weightKg.toFixed(2),
        purchaseAmount: amount.toFixed(2),
        vehicleNumber: vehicleNumber?.trim() || null,
        driverName: driverName?.trim() || null,
        status: 'PENDING_RECEIVING',
        notes: notes?.trim() || null,
      })
      .returning();

    // Also update dealer ledger: new purchase is a DEBIT (amount owed to supplier)
    const lastTx = await db
      .select()
      .from(dealerTransactions)
      .where(eq(dealerTransactions.supplierId, supId))
      .orderBy(desc(dealerTransactions.id))
      .limit(1);

    const prevBalance = lastTx.length > 0 ? Number(lastTx[0].balanceAfter) : 0;
    const newBalance = Number((prevBalance + amount).toFixed(2));

    await db.insert(dealerTransactions).values({
      supplierId: supId,
      transactionDate: dateStr,
      transactionType: 'PURCHASE_DEBIT',
      debitAmount: amount.toFixed(2),
      creditAmount: '0.00',
      balanceAfter: newBalance.toFixed(2),
      referenceType: 'PURCHASE_LOAD',
      referenceId: newLoad.id,
      notes: `Purchase Load ${loadNumber} (${weightKg} KG @ PKR ${calculatePurchaseRate(amount, weightKg)}/KG)`,
    });

    res.status(201).json(newLoad);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/purchases/:id', async (req: Request, res: Response) => {
  try {
    const loadId = parseInt(req.params.id, 10);
    const [load] = await db
      .select({
        id: purchaseLoads.id,
        loadNumber: purchaseLoads.loadNumber,
        supplierId: purchaseLoads.supplierId,
        supplierName: suppliers.name,
        supplierPhone: suppliers.phone,
        purchaseDate: purchaseLoads.purchaseDate,
        totalWeightKg: purchaseLoads.totalWeightKg,
        purchaseAmount: purchaseLoads.purchaseAmount,
        vehicleNumber: purchaseLoads.vehicleNumber,
        driverName: purchaseLoads.driverName,
        status: purchaseLoads.status,
        notes: purchaseLoads.notes,
        createdAt: purchaseLoads.createdAt,
      })
      .from(purchaseLoads)
      .innerJoin(suppliers, eq(purchaseLoads.supplierId, suppliers.id))
      .where(eq(purchaseLoads.id, loadId));

    if (!load) {
      return res.status(404).json({ error: 'Purchase load not found' });
    }

    const expenses = await db
      .select()
      .from(loadExpenses)
      .where(eq(loadExpenses.purchaseLoadId, loadId))
      .orderBy(asc(loadExpenses.id));

    const [batch] = await db
      .select()
      .from(stockBatches)
      .where(eq(stockBatches.purchaseLoadId, loadId));

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalLandedCost = calculateLandedCost(Number(load.purchaseAmount), totalExpenses);
    const purchaseRatePerKg = calculatePurchaseRate(
      Number(load.purchaseAmount),
      Number(load.totalWeightKg)
    );

    res.json({
      ...load,
      purchaseRatePerKg,
      expenses,
      totalExpenses,
      totalLandedCost,
      stockBatch: batch || null,
      costPerSaleablePiece: batch ? Number(batch.costPerPiece) : (batch ? 0 : calculateCostPerPiece(totalLandedCost, 1)),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Load Expenses
apiRouter.post('/purchases/:id/expenses', async (req: Request, res: Response) => {
  try {
    const loadId = parseInt(req.params.id, 10);
    const { category, amount, expenseDate, description } = req.body;
    const expAmount = Number(amount);

    if (!category || isNaN(expAmount) || expAmount <= 0) {
      return res.status(400).json({ error: 'Category and positive amount are required' });
    }

    const [load] = await db.select().from(purchaseLoads).where(eq(purchaseLoads.id, loadId));
    if (!load) {
      return res.status(404).json({ error: 'Purchase load not found' });
    }

    const [expense] = await db
      .insert(loadExpenses)
      .values({
        purchaseLoadId: loadId,
        category,
        amount: expAmount.toFixed(2),
        expenseDate: expenseDate || getPakistanDate(),
        description: description?.trim() || null,
      })
      .returning();

    // If stock batch already exists, recalculate landed cost and costPerPiece!
    const [batch] = await db
      .select()
      .from(stockBatches)
      .where(eq(stockBatches.purchaseLoadId, loadId));

    if (batch) {
      const allExpenses = await db
        .select({ total: sql<string>`coalesce(sum(amount), '0')` })
        .from(loadExpenses)
        .where(eq(loadExpenses.purchaseLoadId, loadId));

      const totalExp = Number(allExpenses[0]?.total || 0);
      const landedCost = calculateLandedCost(Number(load.purchaseAmount), totalExp);
      const costPerPiece = calculateCostPerPiece(landedCost, batch.originalSaleablePieces);

      await db
        .update(stockBatches)
        .set({
          totalLoadExpenses: totalExp.toFixed(2),
          totalLandedCost: landedCost.toFixed(2),
          costPerPiece: costPerPiece.toFixed(2),
        })
        .where(eq(stockBatches.id, batch.id));
    }

    res.status(201).json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/purchases/:id/expenses/:expenseId', async (req: Request, res: Response) => {
  try {
    const loadId = parseInt(req.params.id, 10);
    const expId = parseInt(req.params.expenseId, 10);

    await db
      .delete(loadExpenses)
      .where(and(eq(loadExpenses.id, expId), eq(loadExpenses.purchaseLoadId, loadId)));

    // Recalculate batch if exists
    const [batch] = await db
      .select()
      .from(stockBatches)
      .where(eq(stockBatches.purchaseLoadId, loadId));

    if (batch) {
      const [load] = await db.select().from(purchaseLoads).where(eq(purchaseLoads.id, loadId));
      const allExpenses = await db
        .select({ total: sql<string>`coalesce(sum(amount), '0')` })
        .from(loadExpenses)
        .where(eq(loadExpenses.purchaseLoadId, loadId));

      const totalExp = Number(allExpenses[0]?.total || 0);
      const landedCost = calculateLandedCost(Number(load.purchaseAmount), totalExp);
      const costPerPiece = calculateCostPerPiece(landedCost, batch.originalSaleablePieces);

      await db
        .update(stockBatches)
        .set({
          totalLoadExpenses: totalExp.toFixed(2),
          totalLandedCost: landedCost.toFixed(2),
          costPerPiece: costPerPiece.toFixed(2),
        })
        .where(eq(stockBatches.id, batch.id));
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 6. STOCK RECEIVING
// -------------------------------------------------------------
apiRouter.post('/purchases/:id/receive', async (req: Request, res: Response) => {
  try {
    const loadId = parseInt(req.params.id, 10);
    const { receivingDate, receivedPieces, deadPieces, damagedPieces, notes } = req.body;

    const pieces = parseInt(receivedPieces, 10);
    const dead = parseInt(deadPieces || 0, 10);
    const damaged = parseInt(damagedPieces || 0, 10);

    if (isNaN(pieces) || pieces <= 0) {
      return res.status(400).json({ error: 'Actual received pieces must be greater than zero' });
    }

    const [load] = await db.select().from(purchaseLoads).where(eq(purchaseLoads.id, loadId));
    if (!load) {
      return res.status(404).json({ error: 'Purchase load not found' });
    }

    // Check for duplicate receiving
    const [existingBatch] = await db
      .select()
      .from(stockBatches)
      .where(eq(stockBatches.purchaseLoadId, loadId));

    if (existingBatch) {
      return res.status(400).json({
        error: `Stock batch ${existingBatch.batchNumber} has already been received for this load.`,
      });
    }

    const saleablePieces = calculateSaleablePieces(pieces, dead, damaged);

    // Sum load expenses
    const expensesRes = await db
      .select({ total: sql<string>`coalesce(sum(amount), '0')` })
      .from(loadExpenses)
      .where(eq(loadExpenses.purchaseLoadId, loadId));

    const totalLoadExpenses = Number(expensesRes[0]?.total || 0);
    const totalLandedCost = calculateLandedCost(Number(load.purchaseAmount), totalLoadExpenses);
    const costPerPiece = calculateCostPerPiece(totalLandedCost, saleablePieces);

    const batchNumber = `BATCH-${load.loadNumber}`;

    // Create stock batch
    const [createdBatch] = await db
      .insert(stockBatches)
      .values({
        batchNumber,
        purchaseLoadId: loadId,
        receivingDate: receivingDate || getPakistanDate(),
        receivedPieces: pieces,
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
        notes: notes?.trim() || null,
      })
      .returning();

    // Record stock movement (STOCK_IN)
    if (saleablePieces > 0) {
      await db.insert(stockMovements).values({
        stockBatchId: createdBatch.id,
        movementType: 'STOCK_IN',
        quantity: saleablePieces,
        balanceAfter: saleablePieces,
        unitCost: costPerPiece.toFixed(2),
        referenceType: 'PURCHASE_LOAD',
        referenceId: loadId,
        notes: `Received ${pieces} pcs (${dead} dead, ${damaged} damaged). Saleable: ${saleablePieces}`,
      });
    }

    // Update purchase load status
    await db
      .update(purchaseLoads)
      .set({ status: 'RECEIVED' })
      .where(eq(purchaseLoads.id, loadId));

    res.status(201).json(createdBatch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 7. INVENTORY MANAGEMENT
// -------------------------------------------------------------
apiRouter.get('/inventory/batches', async (_req: Request, res: Response) => {
  try {
    const batches = await db
      .select({
        id: stockBatches.id,
        batchNumber: stockBatches.batchNumber,
        purchaseLoadId: stockBatches.purchaseLoadId,
        loadNumber: purchaseLoads.loadNumber,
        supplierName: suppliers.name,
        receivingDate: stockBatches.receivingDate,
        receivedPieces: stockBatches.receivedPieces,
        deadPieces: stockBatches.deadPieces,
        damagedPieces: stockBatches.damagedPieces,
        originalSaleablePieces: stockBatches.originalSaleablePieces,
        soldPieces: stockBatches.soldPieces,
        remainingPieces: stockBatches.remainingPieces,
        purchaseAmount: stockBatches.purchaseAmount,
        totalLoadExpenses: stockBatches.totalLoadExpenses,
        totalLandedCost: stockBatches.totalLandedCost,
        costPerPiece: stockBatches.costPerPiece,
        isClosed: stockBatches.isClosed,
        notes: stockBatches.notes,
        createdAt: stockBatches.createdAt,
      })
      .from(stockBatches)
      .innerJoin(purchaseLoads, eq(stockBatches.purchaseLoadId, purchaseLoads.id))
      .innerJoin(suppliers, eq(purchaseLoads.supplierId, suppliers.id))
      .orderBy(asc(stockBatches.receivingDate), asc(stockBatches.id));

    res.json(batches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/inventory/movements', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    const movements = await db
      .select({
        id: stockMovements.id,
        stockBatchId: stockMovements.stockBatchId,
        batchNumber: stockBatches.batchNumber,
        movementType: stockMovements.movementType,
        quantity: stockMovements.quantity,
        balanceAfter: stockMovements.balanceAfter,
        unitCost: stockMovements.unitCost,
        referenceType: stockMovements.referenceType,
        referenceId: stockMovements.referenceId,
        notes: stockMovements.notes,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(stockBatches, eq(stockMovements.stockBatchId, stockBatches.id))
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(limit);

    res.json(movements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual Stock Adjustment
apiRouter.post('/inventory/adjust', async (req: Request, res: Response) => {
  try {
    const { stockBatchId, quantityChange, reason, adjustmentType } = req.body;
    const batchId = parseInt(stockBatchId, 10);
    const change = parseInt(quantityChange, 10); // negative for write-off, positive for count correction

    if (!batchId || isNaN(change) || change === 0) {
      return res.status(400).json({ error: 'Valid batch and non-zero adjustment quantity required' });
    }

    const [batch] = await db.select().from(stockBatches).where(eq(stockBatches.id, batchId));
    if (!batch) {
      return res.status(404).json({ error: 'Stock batch not found' });
    }

    const newRemaining = batch.remainingPieces + change;
    if (newRemaining < 0) {
      return res.status(400).json({
        error: `Cannot reduce stock below zero. Current stock is ${batch.remainingPieces}`,
      });
    }

    await db
      .update(stockBatches)
      .set({
        remainingPieces: newRemaining,
        isClosed: newRemaining === 0,
      })
      .where(eq(stockBatches.id, batchId));

    const movType = adjustmentType || (change < 0 ? 'DAMAGE' : 'ADJUSTMENT');

    const [mov] = await db
      .insert(stockMovements)
      .values({
        stockBatchId: batchId,
        movementType: movType,
        quantity: change,
        balanceAfter: newRemaining,
        unitCost: batch.costPerPiece,
        referenceType: 'MANUAL_ADJUSTMENT',
        notes: reason?.trim() || 'Manual stock count adjustment',
      })
      .returning();

    res.status(201).json(mov);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 8. SALES & FIFO COSTING
// -------------------------------------------------------------
apiRouter.get('/sales', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const type = req.query.type as string;

    let query = db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        saleType: sales.saleType,
        saleDate: sales.saleDate,
        shopId: sales.shopId,
        shopName: shops.shopName,
        totalPieces: sales.totalPieces,
        totalAmount: sales.totalAmount,
        totalCost: sales.totalCost,
        totalProfit: sales.totalProfit,
        sellingPricePerPiece: sales.sellingPricePerPiece,
        costPerPiece: sales.costPerPiece,
        profitPerPiece: sales.profitPerPiece,
        notes: sales.notes,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .leftJoin(shops, eq(sales.shopId, shops.id))
      .orderBy(desc(sales.saleDate), desc(sales.id));

    const records = await query;

    // Filter in-memory or by query
    let filtered = records;
    if (startDate) {
      filtered = filtered.filter((s) => s.saleDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((s) => s.saleDate <= endDate);
    }
    if (type) {
      filtered = filtered.filter((s) => s.saleType === type);
    }

    res.json(filtered);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/sales/:id', async (req: Request, res: Response) => {
  try {
    const saleId = parseInt(req.params.id, 10);
    const [sale] = await db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        saleType: sales.saleType,
        saleDate: sales.saleDate,
        shopId: sales.shopId,
        shopName: shops.shopName,
        totalPieces: sales.totalPieces,
        totalAmount: sales.totalAmount,
        totalCost: sales.totalCost,
        totalProfit: sales.totalProfit,
        sellingPricePerPiece: sales.sellingPricePerPiece,
        costPerPiece: sales.costPerPiece,
        profitPerPiece: sales.profitPerPiece,
        notes: sales.notes,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .leftJoin(shops, eq(sales.shopId, shops.id))
      .where(eq(sales.id, saleId));

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const items = await db
      .select({
        id: saleItems.id,
        saleId: saleItems.saleId,
        stockBatchId: saleItems.stockBatchId,
        batchNumber: stockBatches.batchNumber,
        quantity: saleItems.quantity,
        unitCost: saleItems.unitCost,
        totalCost: saleItems.totalCost,
      })
      .from(saleItems)
      .innerJoin(stockBatches, eq(saleItems.stockBatchId, stockBatches.id))
      .where(eq(saleItems.saleId, saleId));

    res.json({ ...sale, items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Own Shop Sale (Ultra Simple Form)
apiRouter.post('/sales/own-shop', async (req: Request, res: Response) => {
  try {
    const { saleDate, quantityPieces, totalSaleAmount, notes } = req.body;
    const pieces = parseInt(quantityPieces, 10);
    const amount = Number(totalSaleAmount);

    if (isNaN(pieces) || pieces <= 0 || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Please enter a valid quantity of pieces and total sale amount in PKR',
      });
    }

    // 1. Fetch available stock batches ordered by receivingDate ASC (FIFO order)
    const availableBatches = await db
      .select({
        id: stockBatches.id,
        batchNumber: stockBatches.batchNumber,
        remainingPieces: stockBatches.remainingPieces,
        costPerPiece: stockBatches.costPerPiece,
      })
      .from(stockBatches)
      .where(and(eq(stockBatches.isClosed, false), gte(stockBatches.remainingPieces, 1)))
      .orderBy(asc(stockBatches.receivingDate), asc(stockBatches.id));

    const totalStockAvailable = availableBatches.reduce((sum, b) => sum + b.remainingPieces, 0);

    if (pieces > totalStockAvailable) {
      return res.status(400).json({
        error: `Insufficient stock! Requested: ${pieces} pieces, Available: ${totalStockAvailable} pieces. Negative inventory is not allowed.`,
      });
    }

    // 2. Perform FIFO consumption calculation
    const fifoCandidates = availableBatches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      remainingPieces: b.remainingPieces,
      costPerPiece: Number(b.costPerPiece),
    }));

    const fifoResult = consumeBatchesFifo(fifoCandidates, pieces);
    if (fifoResult.remainingShortfall > 0) {
      return res.status(400).json({ error: 'FIFO stock calculation shortfall error' });
    }

    // 3. Compute sale financial metrics
    const metrics = calculateSaleMetrics(amount, pieces, fifoResult.totalCost);

    // Generate invoice number: INV-YYYYMMDD-XXXX
    const dateStr = saleDate || getPakistanDate();
    const countToday = await db.select({ count: sql<number>`count(*)` }).from(sales);
    const invoiceNumber = `INV-${dateStr.replace(/-/g, '')}-${String(Number(countToday[0]?.count || 0) + 1).padStart(4, '0')}`;

    // 4. Save sale record
    const [savedSale] = await db
      .insert(sales)
      .values({
        invoiceNumber,
        saleType: 'OWN_SHOP',
        saleDate: dateStr,
        totalPieces: pieces,
        totalAmount: amount.toFixed(2),
        totalCost: fifoResult.totalCost.toFixed(2),
        totalProfit: metrics.totalProfit.toFixed(2),
        sellingPricePerPiece: metrics.sellingPricePerPiece.toFixed(2),
        costPerPiece: metrics.costPerPiece.toFixed(2),
        profitPerPiece: metrics.profitPerPiece.toFixed(2),
        notes: notes?.trim() || null,
      })
      .returning();

    // 5. Update each consumed stock batch, insert saleItems and stockMovements
    for (const item of fifoResult.consumedBatches) {
      await db.insert(saleItems).values({
        saleId: savedSale.id,
        stockBatchId: item.batchId,
        quantity: item.quantity,
        unitCost: item.unitCost.toFixed(2),
        totalCost: item.totalCost.toFixed(2),
      });

      // Update batch
      const [currentBatch] = await db
        .select()
        .from(stockBatches)
        .where(eq(stockBatches.id, item.batchId));

      const newRemaining = currentBatch.remainingPieces - item.quantity;
      const newSold = currentBatch.soldPieces + item.quantity;

      await db
        .update(stockBatches)
        .set({
          remainingPieces: newRemaining,
          soldPieces: newSold,
          isClosed: newRemaining === 0,
        })
        .where(eq(stockBatches.id, item.batchId));

      // Record stock movement
      await db.insert(stockMovements).values({
        stockBatchId: item.batchId,
        movementType: 'SALE_OUT',
        quantity: -item.quantity,
        balanceAfter: newRemaining,
        unitCost: item.unitCost.toFixed(2),
        referenceType: 'SALE',
        referenceId: savedSale.id,
        notes: `Own shop sale ${invoiceNumber}: ${item.quantity} pcs @ PKR ${item.unitCost}/pc`,
      });
    }

    res.status(201).json({
      sale: savedSale,
      summary: {
        invoiceNumber,
        pieces,
        totalAmount: amount,
        totalCost: fifoResult.totalCost,
        totalProfit: metrics.totalProfit,
        sellingPricePerPiece: metrics.sellingPricePerPiece,
        costPerPiece: metrics.costPerPiece,
        profitPerPiece: metrics.profitPerPiece,
        batchesConsumed: fifoResult.consumedBatches,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Wholesale Distribution Sale
apiRouter.post('/sales/wholesale', async (req: Request, res: Response) => {
  try {
    const { shopId, saleDate, quantityPieces, totalSaleAmount, notes } = req.body;
    const sId = parseInt(shopId, 10);
    const pieces = parseInt(quantityPieces, 10);
    const amount = Number(totalSaleAmount);

    if (!sId || isNaN(pieces) || pieces <= 0 || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Valid wholesale shop, quantity in pieces, and total sale amount are required',
      });
    }

    // Available batches FIFO
    const availableBatches = await db
      .select({
        id: stockBatches.id,
        batchNumber: stockBatches.batchNumber,
        remainingPieces: stockBatches.remainingPieces,
        costPerPiece: stockBatches.costPerPiece,
      })
      .from(stockBatches)
      .where(and(eq(stockBatches.isClosed, false), gte(stockBatches.remainingPieces, 1)))
      .orderBy(asc(stockBatches.receivingDate), asc(stockBatches.id));

    const totalStockAvailable = availableBatches.reduce((sum, b) => sum + b.remainingPieces, 0);

    if (pieces > totalStockAvailable) {
      return res.status(400).json({
        error: `Insufficient stock! Requested: ${pieces} pieces, Available: ${totalStockAvailable} pieces.`,
      });
    }

    const fifoCandidates = availableBatches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      remainingPieces: b.remainingPieces,
      costPerPiece: Number(b.costPerPiece),
    }));

    const fifoResult = consumeBatchesFifo(fifoCandidates, pieces);
    const metrics = calculateSaleMetrics(amount, pieces, fifoResult.totalCost);

    const dateStr = saleDate || getPakistanDate();
    const countToday = await db.select({ count: sql<number>`count(*)` }).from(sales);
    const invoiceNumber = `WHL-${dateStr.replace(/-/g, '')}-${String(Number(countToday[0]?.count || 0) + 1).padStart(4, '0')}`;

    const [savedSale] = await db
      .insert(sales)
      .values({
        invoiceNumber,
        saleType: 'WHOLESALE',
        saleDate: dateStr,
        shopId: sId,
        totalPieces: pieces,
        totalAmount: amount.toFixed(2),
        totalCost: fifoResult.totalCost.toFixed(2),
        totalProfit: metrics.totalProfit.toFixed(2),
        sellingPricePerPiece: metrics.sellingPricePerPiece.toFixed(2),
        costPerPiece: metrics.costPerPiece.toFixed(2),
        profitPerPiece: metrics.profitPerPiece.toFixed(2),
        notes: notes?.trim() || null,
      })
      .returning();

    for (const item of fifoResult.consumedBatches) {
      await db.insert(saleItems).values({
        saleId: savedSale.id,
        stockBatchId: item.batchId,
        quantity: item.quantity,
        unitCost: item.unitCost.toFixed(2),
        totalCost: item.totalCost.toFixed(2),
      });

      const [currentBatch] = await db
        .select()
        .from(stockBatches)
        .where(eq(stockBatches.id, item.batchId));

      const newRemaining = currentBatch.remainingPieces - item.quantity;
      const newSold = currentBatch.soldPieces + item.quantity;

      await db
        .update(stockBatches)
        .set({
          remainingPieces: newRemaining,
          soldPieces: newSold,
          isClosed: newRemaining === 0,
        })
        .where(eq(stockBatches.id, item.batchId));

      await db.insert(stockMovements).values({
        stockBatchId: item.batchId,
        movementType: 'WHOLESALE_OUT',
        quantity: -item.quantity,
        balanceAfter: newRemaining,
        unitCost: item.unitCost.toFixed(2),
        referenceType: 'SHOP_DISTRIBUTION',
        referenceId: savedSale.id,
        notes: `Wholesale delivery ${invoiceNumber} to Shop ID ${sId}: ${item.quantity} pcs`,
      });
    }

    res.status(201).json({ sale: savedSale, summary: metrics });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 9. WHOLESALE SHOPS
// -------------------------------------------------------------
apiRouter.get('/shops', async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(shops).orderBy(asc(shops.shopName));
    const withSales = await Promise.all(
      list.map(async (sh) => {
        const stats = await db
          .select({
            totalPieces: sql<string>`coalesce(sum(total_pieces), '0')`,
            totalAmount: sql<string>`coalesce(sum(total_amount), '0')`,
            ordersCount: sql<number>`count(*)`,
          })
          .from(sales)
          .where(eq(sales.shopId, sh.id));

        return {
          ...sh,
          totalPiecesDelivered: Number(stats[0]?.totalPieces || 0),
          totalSalesAmount: Number(stats[0]?.totalAmount || 0),
          ordersCount: Number(stats[0]?.ordersCount || 0),
        };
      })
    );
    res.json(withSales);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/shops', async (req: Request, res: Response) => {
  try {
    const { shopName, ownerName, phone, address, notes } = req.body;
    if (!shopName?.trim()) {
      return res.status(400).json({ error: 'Shop name is required' });
    }
    const [created] = await db
      .insert(shops)
      .values({
        shopName: shopName.trim(),
        ownerName: ownerName?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      })
      .returning();
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 10. WORKERS & PAYMENTS
// -------------------------------------------------------------
apiRouter.get('/workers', async (_req: Request, res: Response) => {
  try {
    const allWorkers = await db.select().from(workers).orderBy(asc(workers.name));
    const withTotals = await Promise.all(
      allWorkers.map(async (w) => {
        const pmt = await db
          .select({
            totalPaid: sql<string>`coalesce(sum(amount), '0')`,
            paymentCount: sql<number>`count(*)`,
          })
          .from(workerPayments)
          .where(eq(workerPayments.workerId, w.id));

        return {
          ...w,
          totalPaid: Number(pmt[0]?.totalPaid || 0),
          paymentCount: Number(pmt[0]?.paymentCount || 0),
        };
      })
    );
    res.json(withTotals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/workers', async (req: Request, res: Response) => {
  try {
    const { name, phone, notes, isActive } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Worker name is required' });
    }
    const [worker] = await db
      .insert(workers)
      .values({
        name: name.trim(),
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        isActive: isActive !== false,
      })
      .returning();
    res.status(201).json(worker);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.put('/workers/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, phone, notes, isActive } = req.body;
    const [updated] = await db
      .update(workers)
      .set({
        name: name.trim(),
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        isActive: Boolean(isActive),
      })
      .where(eq(workers.id, id))
      .returning();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/workers/:id/payments', async (req: Request, res: Response) => {
  try {
    const workerId = parseInt(req.params.id, 10);
    const payments = await db
      .select()
      .from(workerPayments)
      .where(eq(workerPayments.workerId, workerId))
      .orderBy(desc(workerPayments.paymentDate), desc(workerPayments.id));

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/workers/:id/payments', async (req: Request, res: Response) => {
  try {
    const workerId = parseInt(req.params.id, 10);
    const { amount, paymentDate, paymentMethod, description } = req.body;
    const pmtAmount = Number(amount);

    if (isNaN(pmtAmount) || pmtAmount <= 0) {
      return res.status(400).json({ error: 'Positive payment amount required' });
    }

    const [pmt] = await db
      .insert(workerPayments)
      .values({
        workerId,
        amount: pmtAmount.toFixed(2),
        paymentDate: paymentDate || getPakistanDate(),
        paymentMethod: paymentMethod || 'CASH',
        description: description?.trim() || null,
      })
      .returning();

    res.status(201).json(pmt);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 11. GENERAL BUSINESS EXPENSES
// -------------------------------------------------------------
apiRouter.get('/expenses', async (_req: Request, res: Response) => {
  try {
    const list = await db
      .select()
      .from(businessExpenses)
      .orderBy(desc(businessExpenses.expenseDate), desc(businessExpenses.id));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/expenses', async (req: Request, res: Response) => {
  try {
    const { category, amount, expenseDate, paymentMethod, description } = req.body;
    const expAmount = Number(amount);

    if (!category || isNaN(expAmount) || expAmount <= 0) {
      return res.status(400).json({ error: 'Valid category and positive amount are required' });
    }

    const [created] = await db
      .insert(businessExpenses)
      .values({
        category,
        amount: expAmount.toFixed(2),
        expenseDate: expenseDate || getPakistanDate(),
        paymentMethod: paymentMethod || 'CASH',
        description: description?.trim() || null,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(businessExpenses).where(eq(businessExpenses.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 12. DASHBOARD & BUSINESS OVERVIEW
// -------------------------------------------------------------
apiRouter.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'today';
    const customStart = req.query.startDate as string;
    const customEnd = req.query.endDate as string;

    const todayStr = getPakistanDate();
    let startDate = todayStr;
    let endDate = todayStr;

    if (period === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      startDate = getPakistanDate(y);
      endDate = startDate;
    } else if (period === 'last7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      startDate = getPakistanDate(d);
      endDate = todayStr;
    } else if (period === 'thismonth') {
      startDate = `${todayStr.substring(0, 7)}-01`;
      endDate = todayStr;
    } else if (period === 'custom' && customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
    }

    // 1. Sales metrics for selected date range
    const allSales = await db
      .select()
      .from(sales)
      .where(and(gte(sales.saleDate, startDate), lte(sales.saleDate, endDate)));

    let periodRevenue = 0;
    let periodCogs = 0;
    let periodGrossProfit = 0;
    let periodPiecesSold = 0;
    let ownShopRevenue = 0;
    let wholesaleRevenue = 0;

    allSales.forEach((s) => {
      const amt = Number(s.totalAmount);
      const c = Number(s.totalCost);
      const p = Number(s.totalProfit);
      periodRevenue += amt;
      periodCogs += c;
      periodGrossProfit += p;
      periodPiecesSold += s.totalPieces;

      if (s.saleType === 'OWN_SHOP') {
        ownShopRevenue += amt;
      } else {
        wholesaleRevenue += amt;
      }
    });

    // 2. Expenses for date range
    const expensesList = await db
      .select()
      .from(businessExpenses)
      .where(and(gte(businessExpenses.expenseDate, startDate), lte(businessExpenses.expenseDate, endDate)));

    const periodGeneralExpenses = expensesList.reduce((sum, e) => sum + Number(e.amount), 0);

    // 3. Worker payments for date range
    const paymentsList = await db
      .select()
      .from(workerPayments)
      .where(and(gte(workerPayments.paymentDate, startDate), lte(workerPayments.paymentDate, endDate)));

    const periodWorkerPayments = paymentsList.reduce((sum, p) => sum + Number(p.amount), 0);

    // 4. Net Profit calculation
    const pnl = calculatePnl(
      periodRevenue,
      periodCogs,
      periodGeneralExpenses,
      periodWorkerPayments
    );

    // 5. Total Available Stock in inventory (All active batches)
    const activeBatches = await db
      .select({
        totalRemaining: sql<string>`coalesce(sum(remaining_pieces), '0')`,
        totalBatches: sql<number>`count(*)`,
      })
      .from(stockBatches)
      .where(eq(stockBatches.isClosed, false));

    const totalAvailableStock = Number(activeBatches[0]?.totalRemaining || 0);

    // 6. Purchases for date range
    const periodPurchases = await db
      .select({
        totalAmount: sql<string>`coalesce(sum(purchase_amount), '0')`,
        totalWeight: sql<string>`coalesce(sum(total_weight_kg), '0')`,
        count: sql<number>`count(*)`,
      })
      .from(purchaseLoads)
      .where(and(gte(purchaseLoads.purchaseDate, startDate), lte(purchaseLoads.purchaseDate, endDate)));

    const totalPurchaseAmount = Number(periodPurchases[0]?.totalAmount || 0);
    const totalPurchaseWeight = Number(periodPurchases[0]?.totalWeight || 0);

    // 7. Load expenses for date range
    const periodLoadExpenses = await db
      .select({
        total: sql<string>`coalesce(sum(amount), '0')`,
      })
      .from(loadExpenses)
      .where(and(gte(loadExpenses.expenseDate, startDate), lte(loadExpenses.expenseDate, endDate)));

    const totalLoadExpenses = Number(periodLoadExpenses[0]?.total || 0);

    // 8. Dealer Total Outstanding Balance across all suppliers
    const allSuppliers = await db.select().from(suppliers);
    let totalDealerOutstanding = 0;
    for (const sup of allSuppliers) {
      const tx = await db
        .select()
        .from(dealerTransactions)
        .where(eq(dealerTransactions.supplierId, sup.id))
        .orderBy(desc(dealerTransactions.id))
        .limit(1);
      const bal = tx.length > 0 ? Number(tx[0].balanceAfter) : Number(sup.openingBalance);
      totalDealerOutstanding += bal;
    }

    // 9. Recent records
    const recentSales = await db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        saleType: sales.saleType,
        saleDate: sales.saleDate,
        totalPieces: sales.totalPieces,
        totalAmount: sales.totalAmount,
        totalProfit: sales.totalProfit,
      })
      .from(sales)
      .orderBy(desc(sales.saleDate), desc(sales.id))
      .limit(5);

    const recentPurchases = await db
      .select({
        id: purchaseLoads.id,
        loadNumber: purchaseLoads.loadNumber,
        supplierName: suppliers.name,
        purchaseDate: purchaseLoads.purchaseDate,
        totalWeightKg: purchaseLoads.totalWeightKg,
        purchaseAmount: purchaseLoads.purchaseAmount,
        status: purchaseLoads.status,
      })
      .from(purchaseLoads)
      .innerJoin(suppliers, eq(purchaseLoads.supplierId, suppliers.id))
      .orderBy(desc(purchaseLoads.purchaseDate), desc(purchaseLoads.id))
      .limit(5);

    const recentExpenses = await db
      .select()
      .from(businessExpenses)
      .orderBy(desc(businessExpenses.expenseDate), desc(businessExpenses.id))
      .limit(5);

    // Low stock batches
    const lowStockBatches = await db
      .select({
        id: stockBatches.id,
        batchNumber: stockBatches.batchNumber,
        remainingPieces: stockBatches.remainingPieces,
        costPerPiece: stockBatches.costPerPiece,
        receivingDate: stockBatches.receivingDate,
      })
      .from(stockBatches)
      .where(and(eq(stockBatches.isClosed, false), lte(stockBatches.remainingPieces, 100)))
      .orderBy(asc(stockBatches.remainingPieces));

    // Daily breakdown for charts (Last 7 days or selected range)
    const chartDays: Array<{
      date: string;
      revenue: number;
      expenses: number;
      cogs: number;
      grossProfit: number;
      netProfit: number;
      piecesSold: number;
    }> = [];

    // Build last 7 days chart
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = getPakistanDate(d);

      const daySales = await db
        .select({
          revenue: sql<string>`coalesce(sum(total_amount), '0')`,
          cogs: sql<string>`coalesce(sum(total_cost), '0')`,
          profit: sql<string>`coalesce(sum(total_profit), '0')`,
          pieces: sql<string>`coalesce(sum(total_pieces), '0')`,
        })
        .from(sales)
        .where(eq(sales.saleDate, dayStr));

      const dayGenExp = await db
        .select({
          total: sql<string>`coalesce(sum(amount), '0')`,
        })
        .from(businessExpenses)
        .where(eq(businessExpenses.expenseDate, dayStr));

      const dayWkrExp = await db
        .select({
          total: sql<string>`coalesce(sum(amount), '0')`,
        })
        .from(workerPayments)
        .where(eq(workerPayments.paymentDate, dayStr));

      const rev = Number(daySales[0]?.revenue || 0);
      const cogs = Number(daySales[0]?.cogs || 0);
      const gp = Number(daySales[0]?.profit || 0);
      const pieces = Number(daySales[0]?.pieces || 0);
      const exp = Number(dayGenExp[0]?.total || 0) + Number(dayWkrExp[0]?.total || 0);
      const np = Number((gp - exp).toFixed(2));

      chartDays.push({
        date: dayStr.slice(5), // MM-DD
        revenue: rev,
        expenses: exp,
        cogs,
        grossProfit: gp,
        netProfit: np,
        piecesSold: pieces,
      });
    }

    res.json({
      period,
      startDate,
      endDate,
      kpis: {
        revenue: periodRevenue,
        ownShopRevenue,
        wholesaleRevenue,
        cogs: periodCogs,
        grossProfit: pnl.grossProfit,
        netProfit: pnl.netProfit,
        generalExpenses: periodGeneralExpenses,
        workerPayments: periodWorkerPayments,
        totalAvailableStock,
        totalPurchaseAmount,
        totalPurchaseWeight,
        totalLoadExpenses,
        dealerOutstandingBalance: totalDealerOutstanding,
        totalPiecesSold: periodPiecesSold,
      },
      charts: {
        daily: chartDays,
      },
      recent: {
        sales: recentSales,
        purchases: recentPurchases,
        expenses: recentExpenses,
        lowStockBatches,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 13. COMPREHENSIVE REPORTS (Daily, Weekly, Monthly, Custom)
// -------------------------------------------------------------
apiRouter.get('/reports', async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.startDate as string) || getPakistanDate();
    const endDate = (req.query.endDate as string) || getPakistanDate();

    // 1. Sales summary
    const salesList = await db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        saleType: sales.saleType,
        saleDate: sales.saleDate,
        shopName: shops.shopName,
        totalPieces: sales.totalPieces,
        totalAmount: sales.totalAmount,
        totalCost: sales.totalCost,
        totalProfit: sales.totalProfit,
        sellingPricePerPiece: sales.sellingPricePerPiece,
        costPerPiece: sales.costPerPiece,
      })
      .from(sales)
      .leftJoin(shops, eq(sales.shopId, shops.id))
      .where(and(gte(sales.saleDate, startDate), lte(sales.saleDate, endDate)))
      .orderBy(desc(sales.saleDate), desc(sales.id));

    let ownShopRev = 0;
    let wholesaleRev = 0;
    let totalRev = 0;
    let totalCogs = 0;
    let totalPieces = 0;

    salesList.forEach((s) => {
      const amt = Number(s.totalAmount);
      const c = Number(s.totalCost);
      totalRev += amt;
      totalCogs += c;
      totalPieces += s.totalPieces;
      if (s.saleType === 'OWN_SHOP') {
        ownShopRev += amt;
      } else {
        wholesaleRev += amt;
      }
    });

    // 2. General Expenses
    const expensesList = await db
      .select()
      .from(businessExpenses)
      .where(and(gte(businessExpenses.expenseDate, startDate), lte(businessExpenses.expenseDate, endDate)))
      .orderBy(desc(businessExpenses.expenseDate));

    const generalExpTotal = expensesList.reduce((sum, e) => sum + Number(e.amount), 0);

    // Breakdown by category
    const expensesByCategory: Record<string, number> = {};
    expensesList.forEach((e) => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
    });

    // 3. Worker Payments
    const workerPaymentsList = await db
      .select({
        id: workerPayments.id,
        workerName: workers.name,
        amount: workerPayments.amount,
        paymentDate: workerPayments.paymentDate,
        paymentMethod: workerPayments.paymentMethod,
        description: workerPayments.description,
      })
      .from(workerPayments)
      .innerJoin(workers, eq(workerPayments.workerId, workers.id))
      .where(and(gte(workerPayments.paymentDate, startDate), lte(workerPayments.paymentDate, endDate)))
      .orderBy(desc(workerPayments.paymentDate));

    const workerExpTotal = workerPaymentsList.reduce((sum, p) => sum + Number(p.amount), 0);

    // 4. Purchases in period
    const purchasesList = await db
      .select({
        id: purchaseLoads.id,
        loadNumber: purchaseLoads.loadNumber,
        supplierName: suppliers.name,
        purchaseDate: purchaseLoads.purchaseDate,
        totalWeightKg: purchaseLoads.totalWeightKg,
        purchaseAmount: purchaseLoads.purchaseAmount,
        status: purchaseLoads.status,
      })
      .from(purchaseLoads)
      .innerJoin(suppliers, eq(purchaseLoads.supplierId, suppliers.id))
      .where(and(gte(purchaseLoads.purchaseDate, startDate), lte(purchaseLoads.purchaseDate, endDate)))
      .orderBy(desc(purchaseLoads.purchaseDate));

    const totalPurchasesAmount = purchasesList.reduce((sum, p) => sum + Number(p.purchaseAmount), 0);
    const totalPurchasesWeight = purchasesList.reduce((sum, p) => sum + Number(p.totalWeightKg), 0);

    // 5. Landed Load Expenses in period
    const loadExpList = await db
      .select()
      .from(loadExpenses)
      .where(and(gte(loadExpenses.expenseDate, startDate), lte(loadExpenses.expenseDate, endDate)));

    const totalLoadExpAmount = loadExpList.reduce((sum, e) => sum + Number(e.amount), 0);

    // P&L calculation
    const pnl = calculatePnl(totalRev, totalCogs, generalExpTotal, workerExpTotal);

    res.json({
      startDate,
      endDate,
      summary: {
        totalRevenue: totalRev,
        ownShopRevenue: ownShopRev,
        wholesaleRevenue: wholesaleRev,
        cogs: totalCogs,
        grossProfit: pnl.grossProfit,
        grossMarginPercent: pnl.grossMarginPercent,
        generalExpenses: generalExpTotal,
        workerPayments: workerExpTotal,
        netProfit: pnl.netProfit,
        netMarginPercent: pnl.netMarginPercent,
        totalPiecesSold: totalPieces,
        totalPurchasesAmount,
        totalPurchasesWeight,
        totalLoadExpenses: totalLoadExpAmount,
      },
      expensesByCategory,
      sales: salesList,
      generalExpenses: expensesList,
      workerPayments: workerPaymentsList,
      purchases: purchasesList,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 14. SEED DATA (Authentic Pakistani Poultry Business)
// -------------------------------------------------------------
apiRouter.post('/seed', async (_req: Request, res: Response) => {
  try {
    // Check if suppliers already exist
    const supCount = await db.select({ count: sql<number>`count(*)` }).from(suppliers);
    if (Number(supCount[0]?.count || 0) > 0) {
      return res.json({ message: 'Database already has data. Skipping seed.' });
    }

    const todayStr = getPakistanDate();
    const d1 = new Date();
    d1.setDate(d1.getDate() - 3);
    const date3DaysAgo = getPakistanDate(d1);

    const d2 = new Date();
    d2.setDate(d2.getDate() - 1);
    const dateYesterday = getPakistanDate(d2);

    // 1. Create Suppliers in Punjab
    const [sup1] = await db
      .insert(suppliers)
      .values({
        name: 'Chaudhry Poultry Farms',
        phone: '0300-8451234',
        address: 'Kamoke G.T. Road, Gujranwala, Punjab',
        openingBalance: '150000.00',
        notes: 'Primary supplier for heavy broiler birds',
      })
      .returning();

    const [sup2] = await db
      .insert(suppliers)
      .values({
        name: 'Mian Brothers Hatchery & Broilers',
        phone: '0321-7654321',
        address: 'Sheikhupura Bypass, Punjab',
        openingBalance: '50000.00',
        notes: 'Reliable supplier, fast delivery',
      })
      .returning();

    // Opening balances
    await db.insert(dealerTransactions).values([
      {
        supplierId: sup1.id,
        transactionDate: date3DaysAgo,
        transactionType: 'PURCHASE_DEBIT',
        debitAmount: '150000.00',
        creditAmount: '0.00',
        balanceAfter: '150000.00',
        referenceType: 'OPENING_BALANCE',
        notes: 'Opening balance brought forward',
      },
      {
        supplierId: sup2.id,
        transactionDate: date3DaysAgo,
        transactionType: 'PURCHASE_DEBIT',
        debitAmount: '50000.00',
        creditAmount: '0.00',
        balanceAfter: '50000.00',
        referenceType: 'OPENING_BALANCE',
        notes: 'Opening balance brought forward',
      },
    ]);

    // 2. Vehicles
    await db.insert(vehicles).values([
      {
        vehicleNumber: 'LES-4921',
        driverName: 'Muhammad Aslam',
        driverPhone: '0312-4411223',
        notes: 'Mazda Titan 14ft Open Cage',
      },
      {
        vehicleNumber: 'GA-8119',
        driverName: 'Rashid Mehmood',
        driverPhone: '0345-9988776',
        notes: 'Hino Dutro',
      },
    ]);

    // 3. Wholesale Distribution Shops
    const [shop1] = await db
      .insert(shops)
      .values({
        shopName: 'Bismillah Chicken Center',
        ownerName: 'Tariq Butt',
        phone: '0333-4123890',
        address: 'Main Market, Gulberg, Lahore',
      })
      .returning();

    const [shop2] = await db
      .insert(shops)
      .values({
        shopName: 'Madina Meat & Poultry Shop',
        ownerName: 'Haji Farooq',
        phone: '0301-5544332',
        address: 'Saddar Bazaar, Lahore Cantt',
      })
      .returning();

    // 4. Workers
    const [worker1] = await db
      .insert(workers)
      .values({
        name: 'Akram Masih',
        phone: '0322-1122334',
        notes: 'Head cutter and shop supervisor',
        isActive: true,
      })
      .returning();

    const [worker2] = await db
      .insert(workers)
      .values({
        name: 'Zahid Khan',
        phone: '0315-7766554',
        notes: 'Loader & transport helper',
        isActive: true,
      })
      .returning();

    // 5. Purchase Load 1 (3 days ago from Chaudhry Poultry)
    const [load1] = await db
      .insert(purchaseLoads)
      .values({
        loadNumber: `LOAD-${date3DaysAgo.replace(/-/g, '')}-001`,
        supplierId: sup1.id,
        purchaseDate: date3DaysAgo,
        totalWeightKg: '4500.00',
        purchaseAmount: '1350000.00', // Rs. 300 / KG
        vehicleNumber: 'LES-4921',
        driverName: 'Muhammad Aslam',
        status: 'RECEIVED',
        notes: 'Loaded 4,500 KG live broilers from Gujranwala',
      })
      .returning();

    // Update dealer ledger for Load 1
    await db.insert(dealerTransactions).values({
      supplierId: sup1.id,
      transactionDate: date3DaysAgo,
      transactionType: 'PURCHASE_DEBIT',
      debitAmount: '1350000.00',
      creditAmount: '0.00',
      balanceAfter: '1500000.00',
      referenceType: 'PURCHASE_LOAD',
      referenceId: load1.id,
      notes: `Purchase Load ${load1.loadNumber} (4,500 KG @ PKR 300/KG)`,
    });

    // Load 1 Expenses
    await db.insert(loadExpenses).values([
      {
        purchaseLoadId: load1.id,
        category: 'Fuel',
        amount: '22000.00',
        expenseDate: date3DaysAgo,
        description: 'Diesel Gujranwala to Lahore',
      },
      {
        purchaseLoadId: load1.id,
        category: 'Loading',
        amount: '6000.00',
        expenseDate: date3DaysAgo,
        description: 'Farm loaders fee',
      },
      {
        purchaseLoadId: load1.id,
        category: 'Driver Expense',
        amount: '4000.00',
        expenseDate: date3DaysAgo,
        description: 'Driver daily bhatta and food',
      },
    ]);

    // Load 1 Total landed cost: 1,350,000 + 32,000 = 1,382,000
    // Received: 900 pieces, 12 dead, 8 damaged => 880 saleable pieces
    // Cost per piece = 1,382,000 / 880 = 1,570.45
    const [batch1] = await db
      .insert(stockBatches)
      .values({
        batchNumber: `BATCH-${load1.loadNumber}`,
        purchaseLoadId: load1.id,
        receivingDate: date3DaysAgo,
        receivedPieces: 900,
        deadPieces: 12,
        damagedPieces: 8,
        originalSaleablePieces: 880,
        soldPieces: 550,
        remainingPieces: 330,
        purchaseAmount: '1350000.00',
        totalLoadExpenses: '32000.00',
        totalLandedCost: '1382000.00',
        costPerPiece: '1570.45',
        isClosed: false,
        notes: 'Initial heavy broiler batch',
      })
      .returning();

    await db.insert(stockMovements).values({
      stockBatchId: batch1.id,
      movementType: 'STOCK_IN',
      quantity: 880,
      balanceAfter: 880,
      unitCost: '1570.45',
      referenceType: 'PURCHASE_LOAD',
      referenceId: load1.id,
      notes: 'Received 900 pcs (12 dead, 8 damaged)',
    });

    // 6. Purchase Load 2 (Yesterday from Mian Brothers)
    const [load2] = await db
      .insert(purchaseLoads)
      .values({
        loadNumber: `LOAD-${dateYesterday.replace(/-/g, '')}-001`,
        supplierId: sup2.id,
        purchaseDate: dateYesterday,
        totalWeightKg: '3000.00',
        purchaseAmount: '930000.00', // Rs. 310 / KG
        vehicleNumber: 'GA-8119',
        driverName: 'Rashid Mehmood',
        status: 'RECEIVED',
        notes: 'Sheikhupura medium broiler load',
      })
      .returning();

    await db.insert(dealerTransactions).values({
      supplierId: sup2.id,
      transactionDate: dateYesterday,
      transactionType: 'PURCHASE_DEBIT',
      debitAmount: '930000.00',
      creditAmount: '0.00',
      balanceAfter: '980000.00',
      referenceType: 'PURCHASE_LOAD',
      referenceId: load2.id,
      notes: `Purchase Load ${load2.loadNumber} (3,000 KG @ PKR 310/KG)`,
    });

    await db.insert(loadExpenses).values([
      {
        purchaseLoadId: load2.id,
        category: 'Transportation',
        amount: '18000.00',
        expenseDate: dateYesterday,
        description: 'Transport fare',
      },
      {
        purchaseLoadId: load2.id,
        category: 'Unloading',
        amount: '4000.00',
        expenseDate: dateYesterday,
        description: 'Unloading at shop',
      },
    ]);

    // Load 2 Landed Cost: 930,000 + 22,000 = 952,000
    // Received: 600 pieces, 6 dead, 4 damaged => 590 saleable pieces
    // Cost per piece = 952,000 / 590 = 1,613.56
    const [batch2] = await db
      .insert(stockBatches)
      .values({
        batchNumber: `BATCH-${load2.loadNumber}`,
        purchaseLoadId: load2.id,
        receivingDate: dateYesterday,
        receivedPieces: 600,
        deadPieces: 6,
        damagedPieces: 4,
        originalSaleablePieces: 590,
        soldPieces: 100,
        remainingPieces: 490,
        purchaseAmount: '930000.00',
        totalLoadExpenses: '22000.00',
        totalLandedCost: '952000.00',
        costPerPiece: '1613.56',
        isClosed: false,
        notes: 'Fresh birds Sheikhupura',
      })
      .returning();

    await db.insert(stockMovements).values({
      stockBatchId: batch2.id,
      movementType: 'STOCK_IN',
      quantity: 590,
      balanceAfter: 590,
      unitCost: '1613.56',
      referenceType: 'PURCHASE_LOAD',
      referenceId: load2.id,
      notes: 'Received 600 pcs (6 dead, 4 damaged)',
    });

    // 7. Seed Sales
    // Sale 1: Yesterday Own Shop Sale (300 pcs @ Rs. 1,850/pc = 555,000)
    const [sale1] = await db
      .insert(sales)
      .values({
        invoiceNumber: `INV-${dateYesterday.replace(/-/g, '')}-0001`,
        saleType: 'OWN_SHOP',
        saleDate: dateYesterday,
        totalPieces: 300,
        totalAmount: '555000.00',
        totalCost: '471135.00', // 300 * 1570.45
        totalProfit: '83865.00',
        sellingPricePerPiece: '1850.00',
        costPerPiece: '1570.45',
        profitPerPiece: '279.55',
        notes: 'Evening retail sales',
      })
      .returning();

    await db.insert(saleItems).values({
      saleId: sale1.id,
      stockBatchId: batch1.id,
      quantity: 300,
      unitCost: '1570.45',
      totalCost: '471135.00',
    });

    await db.insert(stockMovements).values({
      stockBatchId: batch1.id,
      movementType: 'SALE_OUT',
      quantity: -300,
      balanceAfter: 580,
      unitCost: '1570.45',
      referenceType: 'SALE',
      referenceId: sale1.id,
      notes: `Own shop sale ${sale1.invoiceNumber}`,
    });

    // Sale 2: Yesterday Wholesale Sale to Bismillah Chicken (150 pcs @ Rs. 1,800/pc = 270,000)
    const [sale2] = await db
      .insert(sales)
      .values({
        invoiceNumber: `WHL-${dateYesterday.replace(/-/g, '')}-0001`,
        saleType: 'WHOLESALE',
        saleDate: dateYesterday,
        shopId: shop1.id,
        totalPieces: 150,
        totalAmount: '270000.00',
        totalCost: '235567.50', // 150 * 1570.45
        totalProfit: '34432.50',
        sellingPricePerPiece: '1800.00',
        costPerPiece: '1570.45',
        profitPerPiece: '229.55',
        notes: 'Delivered to Gulberg shop',
      })
      .returning();

    await db.insert(saleItems).values({
      saleId: sale2.id,
      stockBatchId: batch1.id,
      quantity: 150,
      unitCost: '1570.45',
      totalCost: '235567.50',
    });

    // Sale 3: Today Own Shop Sale (100 pcs @ Rs. 1,880/pc = 188,000)
    // Consumes 100 pcs from batch1
    const [sale3] = await db
      .insert(sales)
      .values({
        invoiceNumber: `INV-${todayStr.replace(/-/g, '')}-0001`,
        saleType: 'OWN_SHOP',
        saleDate: todayStr,
        totalPieces: 100,
        totalAmount: '188000.00',
        totalCost: '157045.00', // 100 * 1570.45
        totalProfit: '30955.00',
        sellingPricePerPiece: '1880.00',
        costPerPiece: '1570.45',
        profitPerPiece: '309.55',
        notes: 'Morning retail walk-ins',
      })
      .returning();

    await db.insert(saleItems).values({
      saleId: sale3.id,
      stockBatchId: batch1.id,
      quantity: 100,
      unitCost: '1570.45',
      totalCost: '157045.00',
    });

    // Sale 4: Today Wholesale Sale to Madina Meat (100 pcs from batch2 @ Rs. 1,850/pc = 185,000)
    const [sale4] = await db
      .insert(sales)
      .values({
        invoiceNumber: `WHL-${todayStr.replace(/-/g, '')}-0001`,
        saleType: 'WHOLESALE',
        saleDate: todayStr,
        shopId: shop2.id,
        totalPieces: 100,
        totalAmount: '185000.00',
        totalCost: '161356.00', // 100 * 1613.56
        totalProfit: '23644.00',
        sellingPricePerPiece: '1850.00',
        costPerPiece: '1613.56',
        profitPerPiece: '236.44',
        notes: 'Delivered to Lahore Cantt shop',
      })
      .returning();

    await db.insert(saleItems).values({
      saleId: sale4.id,
      stockBatchId: batch2.id,
      quantity: 100,
      unitCost: '1613.56',
      totalCost: '161356.00',
    });

    // 8. Dealer Payment to Chaudhry Poultry (Paid PKR 500,000)
    await db.insert(dealerTransactions).values({
      supplierId: sup1.id,
      transactionDate: todayStr,
      transactionType: 'PAYMENT_CREDIT',
      debitAmount: '0.00',
      creditAmount: '500000.00',
      balanceAfter: '1000000.00', // 1,500,000 - 500,000
      referenceType: 'PAYMENT',
      paymentMethod: 'BANK_TRANSFER',
      notes: 'HBL Online transfer partial payment',
    });

    // 9. General Business Expenses
    await db.insert(businessExpenses).values([
      {
        category: 'Electricity',
        amount: '18500.00',
        expenseDate: dateYesterday,
        paymentMethod: 'CASH',
        description: 'LESCO commercial shop electricity bill',
      },
      {
        category: 'Food',
        amount: '1500.00',
        expenseDate: todayStr,
        paymentMethod: 'CASH',
        description: 'Staff lunch',
      },
      {
        category: 'Tea',
        amount: '800.00',
        expenseDate: todayStr,
        paymentMethod: 'CASH',
        description: 'Daily tea and refreshments',
      },
      {
        category: 'Cleaning',
        amount: '1200.00',
        expenseDate: todayStr,
        paymentMethod: 'CASH',
        description: 'Disinfectant phenyl & cleaning supplies',
      },
    ]);

    // 10. Worker Payments
    await db.insert(workerPayments).values([
      {
        workerId: worker1.id,
        amount: '5000.00',
        paymentDate: todayStr,
        paymentMethod: 'CASH',
        description: 'Weekly cash wage payment',
      },
      {
        workerId: worker2.id,
        amount: '3500.00',
        paymentDate: todayStr,
        paymentMethod: 'CASH',
        description: 'Weekly wage payment',
      },
    ]);

    res.json({ success: true, message: 'Database successfully seeded with realistic poultry business data' });
  } catch (error: any) {
    console.error('Seed failed:', error);
    res.status(500).json({ error: error.message });
  }
});

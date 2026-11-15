import express, { NextFunction, Request, Response } from 'express';
import { db } from '../db/index.ts';
import { ensureSchema } from '../db/ensureSchema.ts';
import {
  users,
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
import {
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  extractTokenFromHeaders,
  getSessionSecret,
  resolveUserWorkspace,
  SessionPayload,
  WorkspaceMode,
} from '../utils/authCrypto.ts';
import { buildSixMonthDemoDataset } from '../utils/demoData.ts';
import {
  parseServerPaginationParams,
  sortAndPaginateRecords,
} from '../utils/paginationCache.ts';

const SESSION_COOKIE_NAME = 'checkin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getAuthSecret(): string {
  return getSessionSecret(
    process.env.AUTH_SECRET || process.env.SESSION_SECRET,
    process.env.DATABASE_URL
  );
}

function formatSessionCookie(token: string, maxAgeSeconds: number, isSecure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function resolveRequestSession(req: Request): SessionPayload | null {
  const token = extractTokenFromHeaders(
    {
      authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
      cookie: typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined,
    },
    SESSION_COOKIE_NAME
  );
  if (!token) return null;
  return verifySessionToken(token, getAuthSecret());
}

function getRequestWorkspace(req: Request): WorkspaceMode {
  const authUser = (req as Request & { authUser?: SessionPayload }).authUser;
  return resolveUserWorkspace(authUser || {});
}

export const apiRouter = express.Router();

apiRouter.use(express.json());
apiRouter.use(async (_req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (error: any) {
    console.error('Database schema initialization failed:', error);
    res.status(500).json({ error: error?.message || 'Database initialization failed' });
  }
});

const PKT_OFFSET_MS = 5 * 3600000;
const DAY_MS = 24 * 3600000;

// Helper to format Date to YYYY-MM-DD in Pakistan Standard Time (UTC+5)
export function getPakistanDate(d: Date = new Date()): string {
  const pktDate = new Date(d.getTime() + PKT_OFFSET_MS);
  return pktDate.toISOString().split('T')[0];
}

function shiftPakistanDate(d: Date = new Date(), deltaDays = 0): string {
  return getPakistanDate(new Date(d.getTime() + deltaDays * DAY_MS));
}

// -------------------------------------------------------------
// 0. HEALTH & AUTHENTICATION (Public Endpoints)
// -------------------------------------------------------------
apiRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(eq(suppliers.workspace, 'real'));
    res.json({ status: 'ok', database: 'connected', suppliersCount: result[0]?.count ?? 0 });
  } catch (error: any) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!rawEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${rawEmail}`)
      .limit(1);

    if (!user || user.role === 'demo' || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const sessionUser = {
      id: user.id,
      uid: user.uid,
      email: user.email,
      name: user.name || 'Owner',
      role: user.role || 'owner',
      workspace: resolveUserWorkspace(user),
    };

    const token = signSessionToken(sessionUser, getAuthSecret(), SESSION_TTL_SECONDS);
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', formatSessionCookie(token, SESSION_TTL_SECONDS, isSecure));

    return res.json({
      user: sessionUser,
      token,
    });
  } catch (error: any) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
  }
});

apiRouter.post('/auth/demo', async (req: Request, res: Response) => {
  try {
    const [demoUser] = await db
      .select()
      .from(users)
      .where(eq(users.uid, 'demo-checkin-me'))
      .limit(1);

    if (!demoUser) {
      return res.status(500).json({ error: 'Demo account is not initialized' });
    }

    // Regenerate fresh 6-month dynamic demo data anchored up to live PKT today
    await seedSixMonthDemoWorkspace();

    const sessionUser = {
      id: demoUser.id,
      uid: demoUser.uid,
      email: demoUser.email,
      name: demoUser.name || 'Demo Account',
      role: 'demo',
      workspace: 'demo' as WorkspaceMode,
    };

    const token = signSessionToken(sessionUser, getAuthSecret(), SESSION_TTL_SECONDS);
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', formatSessionCookie(token, SESSION_TTL_SECONDS, isSecure));

    return res.json({
      user: sessionUser,
      token,
    });
  } catch (error: any) {
    console.error('Demo login failed:', error);
    return res.status(500).json({ error: 'Unable to start demo session right now.' });
  }
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', formatSessionCookie('', 0, isSecure));
  return res.json({ success: true });
});

apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  try {
    const session = resolveRequestSession(req);
    if (!session) {
      return res.json({ authenticated: false, user: null });
    }

    const [user] = await db
      .select({
        id: users.id,
        uid: users.uid,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (!user) {
      return res.json({ authenticated: false, user: null });
    }

    return res.json({
      authenticated: true,
      user: {
        ...user,
        workspace: resolveUserWorkspace(user),
      },
    });
  } catch (error: any) {
    console.error('Auth session check failed:', error);
    return res.status(500).json({ error: 'Failed to verify session' });
  }
});

// Protect all downstream business API routes
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const session = resolveRequestSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  (req as Request & { authUser?: SessionPayload }).authUser = session;
  next();
});

// -------------------------------------------------------------
// 1. SETTINGS
// -------------------------------------------------------------

apiRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const allSettings = await db.select().from(settings).where(eq(settings.workspace, ws));
    const config: Record<string, string> = {
      businessName: ws === 'demo' ? 'Al-Madina Poultry Traders (Demo)' : 'Al-Madina Poultry Traders',
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
    const ws = getRequestWorkspace(req);
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await db
        .insert(settings)
        .values({
          workspace: ws,
          key,
          value: String(value),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [settings.workspace, settings.key],
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
apiRouter.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const allSuppliers = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.workspace, ws))
      .orderBy(asc(suppliers.name));

    // Calculate current balance for each supplier from dealer_transactions
    const suppliersWithBalance = await Promise.all(
      allSuppliers.map(async (sup) => {
        const txs = await db
          .select()
          .from(dealerTransactions)
          .where(and(eq(dealerTransactions.supplierId, sup.id), eq(dealerTransactions.workspace, ws)))
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
          .where(and(eq(purchaseLoads.supplierId, sup.id), eq(purchaseLoads.workspace, ws)));

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
    const ws = getRequestWorkspace(req);
    const { name, phone, address, openingBalance, notes } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const parsedBal = Number(openingBalance ?? 0);
    const opBal = Number.isFinite(parsedBal) ? parsedBal : 0;

    const [created] = await db
      .insert(suppliers)
      .values({
        workspace: ws,
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        openingBalance: opBal.toFixed(2),
        notes: notes?.trim() || null,
      })
      .returning();

    // If opening balance != 0, record initial opening transaction
    if (opBal !== 0) {
      await db.insert(dealerTransactions).values({
        workspace: ws,
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

    res.status(201).json({
      ...created,
      currentBalance: opBal,
      totalPurchasesAmount: 0,
      purchaseCount: 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const supplierId = parseInt(req.params.id, 10);
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.workspace, ws)));

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Ledger transactions
    const ledger = await db
      .select()
      .from(dealerTransactions)
      .where(and(eq(dealerTransactions.supplierId, supplierId), eq(dealerTransactions.workspace, ws)))
      .orderBy(desc(dealerTransactions.transactionDate), desc(dealerTransactions.id));

    // Purchase history
    const loads = await db
      .select()
      .from(purchaseLoads)
      .where(and(eq(purchaseLoads.supplierId, supplierId), eq(purchaseLoads.workspace, ws)))
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
    const ws = getRequestWorkspace(req);
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
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.workspace, ws)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

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
    const ws = getRequestWorkspace(req);
    const { limit, skip, search, sortKey, sortDir, all } = parseServerPaginationParams(
      req.query as Record<string, unknown>
    );
    const supplierIdRaw = req.query.supplierId ? String(req.query.supplierId) : '';
    const supplierId =
      supplierIdRaw && supplierIdRaw !== 'ALL' ? parseInt(supplierIdRaw, 10) : null;
    const typeFilter = req.query.type ? String(req.query.type) : '';
    const startDate = req.query.startDate ? String(req.query.startDate) : '';
    const endDate = req.query.endDate ? String(req.query.endDate) : '';

    const baseWhere = and(eq(dealerTransactions.workspace, ws), eq(suppliers.workspace, ws));

    const records = await db
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
      .where(
        supplierId && Number.isFinite(supplierId)
          ? and(baseWhere, eq(dealerTransactions.supplierId, supplierId))
          : baseWhere
      )
      .orderBy(desc(dealerTransactions.transactionDate), desc(dealerTransactions.id));

    let filtered = records;
    if (typeFilter && typeFilter !== 'ALL') {
      filtered = filtered.filter((t) => t.transactionType === typeFilter);
    }
    if (startDate) {
      filtered = filtered.filter((t) => String(t.transactionDate) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((t) => String(t.transactionDate) <= endDate);
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
      return res.json(filtered);
    }

    const paginated = sortAndPaginateRecords({
      records: filtered,
      limit,
      skip,
      sortKey: sortKey || 'transactionDate',
      sortDir,
    });

    res.json(paginated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/dealer-ledger/payment', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const { supplierId, amount, transactionDate, paymentMethod, notes } = req.body;
    const supId = parseInt(supplierId, 10);
    const paymentAmount = Number(amount);

    if (!supId || isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid supplier and positive payment amount are required' });
    }

    const [sup] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supId), eq(suppliers.workspace, ws)));

    if (!sup) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Get latest balance
    const lastTx = await db
      .select()
      .from(dealerTransactions)
      .where(and(eq(dealerTransactions.supplierId, supId), eq(dealerTransactions.workspace, ws)))
      .orderBy(desc(dealerTransactions.id))
      .limit(1);

    const prevBalance = lastTx.length > 0 ? Number(lastTx[0].balanceAfter) : Number(sup.openingBalance);
    const newBalance = Number((prevBalance - paymentAmount).toFixed(2));

    const [tx] = await db
      .insert(dealerTransactions)
      .values({
        workspace: ws,
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
apiRouter.get('/vehicles', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const list = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.workspace, ws))
      .orderBy(asc(vehicles.vehicleNumber));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/vehicles', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const { vehicleNumber, driverName, driverPhone, notes } = req.body;
    if (!vehicleNumber?.trim()) {
      return res.status(400).json({ error: 'Vehicle number is required' });
    }
    const [created] = await db
      .insert(vehicles)
      .values({
        workspace: ws,
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
apiRouter.get('/purchases', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const { limit, skip, search, sortKey, sortDir, all } = parseServerPaginationParams(
      req.query as Record<string, unknown>
    );
    const statusFilter = req.query.status ? String(req.query.status) : '';
    const supplierIdRaw = req.query.supplierId ? String(req.query.supplierId) : '';
    const supplierIdFilter =
      supplierIdRaw && supplierIdRaw !== 'ALL' ? parseInt(supplierIdRaw, 10) : null;
    const startDate = req.query.startDate ? String(req.query.startDate) : '';
    const endDate = req.query.endDate ? String(req.query.endDate) : '';

    const [loads, allLoadExps, allBatches] = await Promise.all([
      db
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
        .where(and(eq(purchaseLoads.workspace, ws), eq(suppliers.workspace, ws)))
        .orderBy(desc(purchaseLoads.purchaseDate), desc(purchaseLoads.id)),
      db.select().from(loadExpenses).where(eq(loadExpenses.workspace, ws)),
      db.select().from(stockBatches).where(eq(stockBatches.workspace, ws)),
    ]);

    const expByLoad = new Map<number, typeof allLoadExps>();
    for (const exp of allLoadExps) {
      const list = expByLoad.get(exp.purchaseLoadId);
      if (list) list.push(exp);
      else expByLoad.set(exp.purchaseLoadId, [exp]);
    }
    const batchByLoad = new Map<number, (typeof allBatches)[number]>();
    for (const b of allBatches) {
      batchByLoad.set(b.purchaseLoadId, b);
    }

    let enriched = loads.map((load) => {
      const exps = expByLoad.get(load.id) || [];
      const totalExp = exps.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const landedCost = calculateLandedCost(Number(load.purchaseAmount), totalExp);
      const purchaseRatePerKg = calculatePurchaseRate(
        Number(load.purchaseAmount),
        Number(load.totalWeightKg)
      );
      return {
        ...load,
        expenses: exps,
        purchaseRatePerKg,
        totalExpenses: totalExp,
        totalLandedCost: landedCost,
        stockBatch: batchByLoad.get(load.id) || null,
      };
    });

    if (statusFilter && statusFilter !== 'ALL') {
      enriched = enriched.filter((l) => l.status === statusFilter);
    }
    if (supplierIdFilter && Number.isFinite(supplierIdFilter)) {
      enriched = enriched.filter((l) => l.supplierId === supplierIdFilter);
    }
    if (startDate) {
      enriched = enriched.filter((l) => String(l.purchaseDate) >= startDate);
    }
    if (endDate) {
      enriched = enriched.filter((l) => String(l.purchaseDate) <= endDate);
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
      return res.json(enriched);
    }

    const paginated = sortAndPaginateRecords({
      records: enriched,
      limit,
      skip,
      sortKey: sortKey || 'purchaseDate',
      sortDir,
    });

    res.json(paginated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/purchases', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
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

    const [sup] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supId), eq(suppliers.workspace, ws)));

    if (!sup) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Auto-generate load number scoped cleanly to this workspace: LOAD-YYYYMMDD-XXX
    const dateStr = purchaseDate || getPakistanDate();
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseLoads)
      .where(eq(purchaseLoads.workspace, ws));
    let seq = Number(countRows[0]?.count || 0) + 1;
    let loadNumber = `LOAD-${dateStr.replace(/-/g, '')}-${String(seq).padStart(3, '0')}`;
    const existingLoadNum = await db
      .select({ id: purchaseLoads.id })
      .from(purchaseLoads)
      .where(and(eq(purchaseLoads.workspace, ws), eq(purchaseLoads.loadNumber, loadNumber)))
      .limit(1);
    if (existingLoadNum.length > 0) {
      loadNumber = `LOAD-${dateStr.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;
    }

    // Insert purchase load
    const [newLoad] = await db
      .insert(purchaseLoads)
      .values({
        workspace: ws,
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
      .where(and(eq(dealerTransactions.supplierId, supId), eq(dealerTransactions.workspace, ws)))
      .orderBy(desc(dealerTransactions.id))
      .limit(1);

    const prevBalance = lastTx.length > 0 ? Number(lastTx[0].balanceAfter) : Number(sup.openingBalance);
    const newBalance = Number((prevBalance + amount).toFixed(2));

    await db.insert(dealerTransactions).values({
      workspace: ws,
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
    const ws = getRequestWorkspace(req);
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
      .where(and(eq(purchaseLoads.id, loadId), eq(purchaseLoads.workspace, ws)));

    if (!load) {
      return res.status(404).json({ error: 'Purchase load not found' });
    }

    const expenses = await db
      .select()
      .from(loadExpenses)
      .where(and(eq(loadExpenses.purchaseLoadId, loadId), eq(loadExpenses.workspace, ws)))
      .orderBy(asc(loadExpenses.id));

    const [batch] = await db
      .select()
      .from(stockBatches)
      .where(and(eq(stockBatches.purchaseLoadId, loadId), eq(stockBatches.workspace, ws)));

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
    const ws = getRequestWorkspace(req);
    const loadId = parseInt(req.params.id, 10);
    const { category, amount, expenseDate, description } = req.body;
    const expAmount = Number(amount);

    if (!category || isNaN(expAmount) || expAmount <= 0) {
      return res.status(400).json({ error: 'Category and positive amount are required' });
    }

    const [load] = await db
      .select()
      .from(purchaseLoads)
      .where(and(eq(purchaseLoads.id, loadId), eq(purchaseLoads.workspace, ws)));
    if (!load) {
      return res.status(404).json({ error: 'Purchase load not found' });
    }

    const [expense] = await db
      .insert(loadExpenses)
      .values({
        workspace: ws,
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
      .where(and(eq(stockBatches.purchaseLoadId, loadId), eq(stockBatches.workspace, ws)));

    if (batch) {
      const allExpenses = await db
        .select({ total: sql<string>`coalesce(sum(amount), '0')` })
        .from(loadExpenses)
        .where(and(eq(loadExpenses.purchaseLoadId, loadId), eq(loadExpenses.workspace, ws)));

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
        .where(and(eq(stockBatches.id, batch.id), eq(stockBatches.workspace, ws)));
    }

    res.status(201).json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.delete('/purchases/:id/expenses/:expenseId', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const loadId = parseInt(req.params.id, 10);
    const expId = parseInt(req.params.expenseId, 10);

    const [load] = await db
      .select()
      .from(purchaseLoads)
      .where(and(eq(purchaseLoads.id, loadId), eq(purchaseLoads.workspace, ws)));
    if (!load) {
      return res.status(404).json({ error: 'Purchase load not found' });
    }

    await db
      .delete(loadExpenses)
      .where(
        and(
          eq(loadExpenses.id, expId),
          eq(loadExpenses.purchaseLoadId, loadId),
          eq(loadExpenses.workspace, ws)
        )
      );

    // Recalculate batch if exists
    const [batch] = await db
      .select()
      .from(stockBatches)
      .where(and(eq(stockBatches.purchaseLoadId, loadId), eq(stockBatches.workspace, ws)));

    if (batch) {
      const allExpenses = await db
        .select({ total: sql<string>`coalesce(sum(amount), '0')` })
        .from(loadExpenses)
        .where(and(eq(loadExpenses.purchaseLoadId, loadId), eq(loadExpenses.workspace, ws)));

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
        .where(and(eq(stockBatches.id, batch.id), eq(stockBatches.workspace, ws)));
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
    const ws = getRequestWorkspace(req);
    const loadId = parseInt(req.params.id, 10);
    const { receivingDate, receivedPieces, deadPieces, damagedPieces, notes } = req.body;

    const pieces = parseInt(receivedPieces, 10);
    const dead = parseInt(deadPieces || 0, 10);
    const damaged = parseInt(damagedPieces || 0, 10);

    if (isNaN(pieces) || pieces <= 0) {
      return res.status(400).json({ error: 'Actual received pieces must be greater than zero' });
    }

    const [load] = await db
      .select()
      .from(purchaseLoads)
      .where(and(eq(purchaseLoads.id, loadId), eq(purchaseLoads.workspace, ws)));
    if (!load) {
      return res.status(404).json({ error: 'Purchase load not found' });
    }

    // Check for duplicate receiving
    const [existingBatch] = await db
      .select()
      .from(stockBatches)
      .where(and(eq(stockBatches.purchaseLoadId, loadId), eq(stockBatches.workspace, ws)));

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
      .where(and(eq(loadExpenses.purchaseLoadId, loadId), eq(loadExpenses.workspace, ws)));

    const totalLoadExpenses = Number(expensesRes[0]?.total || 0);
    const totalLandedCost = calculateLandedCost(Number(load.purchaseAmount), totalLoadExpenses);
    const costPerPiece = calculateCostPerPiece(totalLandedCost, saleablePieces);

    const batchNumber = `BATCH-${load.loadNumber}`;

    // Create stock batch
    const [createdBatch] = await db
      .insert(stockBatches)
      .values({
        workspace: ws,
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
        workspace: ws,
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
      .where(and(eq(purchaseLoads.id, loadId), eq(purchaseLoads.workspace, ws)));

    res.status(201).json(createdBatch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 7. INVENTORY MANAGEMENT
// -------------------------------------------------------------
apiRouter.get('/inventory/batches', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const { limit, skip, search, sortKey, sortDir, all } = parseServerPaginationParams(
      req.query as Record<string, unknown>
    );
    const effectiveSortDir = req.query.sortDir ? sortDir : 'asc';
    const statusFilter = req.query.status ? String(req.query.status) : '';
    const startDate = req.query.startDate ? String(req.query.startDate) : '';
    const endDate = req.query.endDate ? String(req.query.endDate) : '';

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
      .where(
        and(
          eq(stockBatches.workspace, ws),
          eq(purchaseLoads.workspace, ws),
          eq(suppliers.workspace, ws)
        )
      )
      .orderBy(asc(stockBatches.receivingDate), asc(stockBatches.id));

    let filtered = batches;
    if (statusFilter === 'ACTIVE') {
      filtered = filtered.filter((b) => !b.isClosed && Number(b.remainingPieces) > 0);
    } else if (statusFilter === 'DEPLETED') {
      filtered = filtered.filter((b) => b.isClosed || Number(b.remainingPieces) === 0);
    }
    if (startDate) {
      filtered = filtered.filter((b) => String(b.receivingDate) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((b) => String(b.receivingDate) <= endDate);
    }
    if (search) {
      filtered = filtered.filter(
        (b) =>
          b.batchNumber.toLowerCase().includes(search) ||
          b.loadNumber.toLowerCase().includes(search) ||
          b.supplierName.toLowerCase().includes(search) ||
          (b.notes && b.notes.toLowerCase().includes(search))
      );
    }

    if (all) {
      return res.json(filtered);
    }

    const paginated = sortAndPaginateRecords({
      records: filtered,
      limit,
      skip,
      sortKey: sortKey || 'receivingDate',
      sortDir: effectiveSortDir,
      getSortValue: (row, key) => {
        if (key === 'status') {
          return row.isClosed ? 0 : row.remainingPieces;
        }
        return (row as Record<string, unknown>)[key];
      },
    });

    res.json(paginated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/inventory/movements', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const { limit, skip, search, sortKey, sortDir, all } = parseServerPaginationParams(
      req.query as Record<string, unknown>
    );
    const typeFilter = req.query.type ? String(req.query.type) : '';
    const batchIdRaw = req.query.stockBatchId ? String(req.query.stockBatchId) : '';
    const batchIdFilter = batchIdRaw ? parseInt(batchIdRaw, 10) : null;

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
      .where(and(eq(stockMovements.workspace, ws), eq(stockBatches.workspace, ws)))
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id));

    let filtered = movements;
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
      return res.json(filtered);
    }

    const paginated = sortAndPaginateRecords({
      records: filtered,
      limit,
      skip,
      sortKey: sortKey || 'createdAt',
      sortDir,
    });

    res.json(paginated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual Stock Adjustment
apiRouter.post('/inventory/adjust', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const { stockBatchId, quantityChange, reason, adjustmentType } = req.body;
    const batchId = parseInt(stockBatchId, 10);
    const change = parseInt(quantityChange, 10); // negative for write-off, positive for count correction

    if (!batchId || isNaN(change) || change === 0) {
      return res.status(400).json({ error: 'Valid batch and non-zero adjustment quantity required' });
    }

    const [batch] = await db
      .select()
      .from(stockBatches)
      .where(and(eq(stockBatches.id, batchId), eq(stockBatches.workspace, ws)));
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
      .where(and(eq(stockBatches.id, batchId), eq(stockBatches.workspace, ws)));

    const movType = adjustmentType || (change < 0 ? 'DAMAGE' : 'ADJUSTMENT');

    const [mov] = await db
      .insert(stockMovements)
      .values({
        workspace: ws,
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
    const ws = getRequestWorkspace(req);
    const { limit, skip, search, sortKey, sortDir, all } = parseServerPaginationParams(
      req.query as Record<string, unknown>
    );
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const type = req.query.type as string;
    const shopIdRaw = req.query.shopId ? String(req.query.shopId) : '';
    const shopIdFilter = shopIdRaw && shopIdRaw !== 'ALL' ? parseInt(shopIdRaw, 10) : null;
    const datePreset = req.query.datePreset ? String(req.query.datePreset) : '';

    const records = await db
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
      .where(eq(sales.workspace, ws))
      .orderBy(desc(sales.saleDate), desc(sales.id));

    let filtered = records;
    const todayStr = getPakistanDate();
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
      return res.json(filtered);
    }

    const paginated = sortAndPaginateRecords({
      records: filtered,
      limit,
      skip,
      sortKey: sortKey || 'saleDate',
      sortDir,
      getSortValue: (row, key) => {
        if (key === 'channel') {
          return row.saleType === 'OWN_SHOP' ? 'Walk-in Shop' : row.shopName || 'Other Shop';
        }
        return (row as Record<string, unknown>)[key];
      },
    });

    res.json(paginated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/sales/:id', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
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
      .where(and(eq(sales.id, saleId), eq(sales.workspace, ws)));

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
      .where(and(eq(saleItems.saleId, saleId), eq(saleItems.workspace, ws)));

    res.json({ ...sale, items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Own Shop Sale (Ultra Simple Form)
apiRouter.post('/sales/own-shop', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
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
      .where(
        and(
          eq(stockBatches.workspace, ws),
          eq(stockBatches.isClosed, false),
          gte(stockBatches.remainingPieces, 1)
        )
      )
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

    // Generate invoice number scoped to workspace: INV-YYYYMMDD-XXXX
    const dateStr = saleDate || getPakistanDate();
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(sales)
      .where(eq(sales.workspace, ws));
    let invoiceNumber = `INV-${dateStr.replace(/-/g, '')}-${String(Number(countRows[0]?.count || 0) + 1).padStart(4, '0')}`;
    const existingInv = await db
      .select({ id: sales.id })
      .from(sales)
      .where(and(eq(sales.workspace, ws), eq(sales.invoiceNumber, invoiceNumber)))
      .limit(1);
    if (existingInv.length > 0) {
      invoiceNumber = `INV-${dateStr.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;
    }

    // 4. Save sale record
    const [savedSale] = await db
      .insert(sales)
      .values({
        workspace: ws,
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
        workspace: ws,
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
        .where(and(eq(stockBatches.id, item.batchId), eq(stockBatches.workspace, ws)));

      const newRemaining = currentBatch.remainingPieces - item.quantity;
      const newSold = currentBatch.soldPieces + item.quantity;

      await db
        .update(stockBatches)
        .set({
          remainingPieces: newRemaining,
          soldPieces: newSold,
          isClosed: newRemaining === 0,
        })
        .where(and(eq(stockBatches.id, item.batchId), eq(stockBatches.workspace, ws)));

      // Record stock movement
      await db.insert(stockMovements).values({
        workspace: ws,
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
    const ws = getRequestWorkspace(req);
    const { shopId, saleDate, quantityPieces, totalSaleAmount, notes } = req.body;
    const sId = parseInt(shopId, 10);
    const pieces = parseInt(quantityPieces, 10);
    const amount = Number(totalSaleAmount);

    if (!sId || isNaN(pieces) || pieces <= 0 || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Valid wholesale shop, quantity in pieces, and total sale amount are required',
      });
    }

    const [targetShop] = await db
      .select()
      .from(shops)
      .where(and(eq(shops.id, sId), eq(shops.workspace, ws)));
    if (!targetShop) {
      return res.status(404).json({ error: 'Selected shop not found' });
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
      .where(
        and(
          eq(stockBatches.workspace, ws),
          eq(stockBatches.isClosed, false),
          gte(stockBatches.remainingPieces, 1)
        )
      )
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
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(sales)
      .where(eq(sales.workspace, ws));
    let invoiceNumber = `WHL-${dateStr.replace(/-/g, '')}-${String(Number(countRows[0]?.count || 0) + 1).padStart(4, '0')}`;
    const existingInv = await db
      .select({ id: sales.id })
      .from(sales)
      .where(and(eq(sales.workspace, ws), eq(sales.invoiceNumber, invoiceNumber)))
      .limit(1);
    if (existingInv.length > 0) {
      invoiceNumber = `WHL-${dateStr.replace(/-/g, '')}-${String(Date.now()).slice(-5)}`;
    }

    const [savedSale] = await db
      .insert(sales)
      .values({
        workspace: ws,
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
        workspace: ws,
        saleId: savedSale.id,
        stockBatchId: item.batchId,
        quantity: item.quantity,
        unitCost: item.unitCost.toFixed(2),
        totalCost: item.totalCost.toFixed(2),
      });

      const [currentBatch] = await db
        .select()
        .from(stockBatches)
        .where(and(eq(stockBatches.id, item.batchId), eq(stockBatches.workspace, ws)));

      const newRemaining = currentBatch.remainingPieces - item.quantity;
      const newSold = currentBatch.soldPieces + item.quantity;

      await db
        .update(stockBatches)
        .set({
          remainingPieces: newRemaining,
          soldPieces: newSold,
          isClosed: newRemaining === 0,
        })
        .where(and(eq(stockBatches.id, item.batchId), eq(stockBatches.workspace, ws)));

      await db.insert(stockMovements).values({
        workspace: ws,
        stockBatchId: item.batchId,
        movementType: 'WHOLESALE_OUT',
        quantity: -item.quantity,
        balanceAfter: newRemaining,
        unitCost: item.unitCost.toFixed(2),
        referenceType: 'SHOP_DISTRIBUTION',
        referenceId: savedSale.id,
        notes: `Wholesale delivery ${invoiceNumber} to ${targetShop.shopName}: ${item.quantity} pcs`,
      });
    }

    res.status(201).json({ sale: { ...savedSale, shopName: targetShop.shopName }, summary: metrics });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 9. WHOLESALE SHOPS
// -------------------------------------------------------------
apiRouter.get('/shops', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const list = await db
      .select()
      .from(shops)
      .where(eq(shops.workspace, ws))
      .orderBy(asc(shops.shopName));
    const withSales = await Promise.all(
      list.map(async (sh) => {
        const stats = await db
          .select({
            totalPieces: sql<string>`coalesce(sum(total_pieces), '0')`,
            totalAmount: sql<string>`coalesce(sum(total_amount), '0')`,
            ordersCount: sql<number>`count(*)`,
          })
          .from(sales)
          .where(and(eq(sales.shopId, sh.id), eq(sales.workspace, ws)));

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
    const ws = getRequestWorkspace(req);
    const { shopName, ownerName, phone, address, notes } = req.body;
    if (!shopName?.trim()) {
      return res.status(400).json({ error: 'Shop name is required' });
    }
    const [created] = await db
      .insert(shops)
      .values({
        workspace: ws,
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
apiRouter.get('/workers', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const allWorkers = await db
      .select()
      .from(workers)
      .where(eq(workers.workspace, ws))
      .orderBy(asc(workers.name));
    const withTotals = await Promise.all(
      allWorkers.map(async (w) => {
        const pmt = await db
          .select({
            totalPaid: sql<string>`coalesce(sum(amount), '0')`,
            paymentCount: sql<number>`count(*)`,
          })
          .from(workerPayments)
          .where(and(eq(workerPayments.workerId, w.id), eq(workerPayments.workspace, ws)));

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
    const ws = getRequestWorkspace(req);
    const { name, phone, notes, isActive } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Worker name is required' });
    }
    const [worker] = await db
      .insert(workers)
      .values({
        workspace: ws,
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
    const ws = getRequestWorkspace(req);
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
      .where(and(eq(workers.id, id), eq(workers.workspace, ws)))
      .returning();
    if (!updated) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.get('/workers/:id/payments', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const workerId = parseInt(req.params.id, 10);
    const [worker] = await db
      .select()
      .from(workers)
      .where(and(eq(workers.id, workerId), eq(workers.workspace, ws)));
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const payments = await db
      .select()
      .from(workerPayments)
      .where(and(eq(workerPayments.workerId, workerId), eq(workerPayments.workspace, ws)))
      .orderBy(desc(workerPayments.paymentDate), desc(workerPayments.id));

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/workers/:id/payments', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const workerId = parseInt(req.params.id, 10);
    const { amount, paymentDate, paymentMethod, description } = req.body;
    const pmtAmount = Number(amount);

    if (isNaN(pmtAmount) || pmtAmount <= 0) {
      return res.status(400).json({ error: 'Positive payment amount required' });
    }

    const [worker] = await db
      .select()
      .from(workers)
      .where(and(eq(workers.id, workerId), eq(workers.workspace, ws)));
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const [pmt] = await db
      .insert(workerPayments)
      .values({
        workspace: ws,
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

apiRouter.get('/worker-payments', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const { limit, skip, search, sortKey, sortDir, all } = parseServerPaginationParams(
      req.query as Record<string, unknown>
    );
    const workerIdRaw = req.query.workerId ? String(req.query.workerId) : '';
    const workerIdFilter = workerIdRaw && workerIdRaw !== 'ALL' ? parseInt(workerIdRaw, 10) : null;
    const startDate = req.query.startDate ? String(req.query.startDate) : '';
    const endDate = req.query.endDate ? String(req.query.endDate) : '';

    const payments = await db
      .select({
        id: workerPayments.id,
        workerId: workerPayments.workerId,
        workerName: workers.name,
        amount: workerPayments.amount,
        paymentDate: workerPayments.paymentDate,
        paymentMethod: workerPayments.paymentMethod,
        description: workerPayments.description,
        createdAt: workerPayments.createdAt,
      })
      .from(workerPayments)
      .innerJoin(workers, eq(workerPayments.workerId, workers.id))
      .where(and(eq(workerPayments.workspace, ws), eq(workers.workspace, ws)))
      .orderBy(desc(workerPayments.paymentDate), desc(workerPayments.id));

    let filtered = payments;
    if (workerIdFilter && Number.isFinite(workerIdFilter)) {
      filtered = filtered.filter((p) => p.workerId === workerIdFilter);
    }
    if (startDate) {
      filtered = filtered.filter((p) => String(p.paymentDate) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((p) => String(p.paymentDate) <= endDate);
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
      return res.json(filtered);
    }

    const paginated = sortAndPaginateRecords({
      records: filtered,
      limit,
      skip,
      sortKey: sortKey || 'paymentDate',
      sortDir,
    });

    res.json(paginated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 11. GENERAL BUSINESS EXPENSES
// -------------------------------------------------------------
apiRouter.get('/expenses', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const { limit, skip, search, sortKey, sortDir, all } = parseServerPaginationParams(
      req.query as Record<string, unknown>
    );
    const categoryFilter = req.query.category ? String(req.query.category) : '';
    const methodFilter = req.query.paymentMethod ? String(req.query.paymentMethod) : '';
    const startDate = req.query.startDate ? String(req.query.startDate) : '';
    const endDate = req.query.endDate ? String(req.query.endDate) : '';

    const list = await db
      .select()
      .from(businessExpenses)
      .where(eq(businessExpenses.workspace, ws))
      .orderBy(desc(businessExpenses.expenseDate), desc(businessExpenses.id));

    let filtered = list;
    if (categoryFilter && categoryFilter !== 'ALL') {
      filtered = filtered.filter((e) => e.category === categoryFilter);
    }
    if (methodFilter && methodFilter !== 'ALL') {
      filtered = filtered.filter((e) => e.paymentMethod === methodFilter);
    }
    if (startDate) {
      filtered = filtered.filter((e) => String(e.expenseDate) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((e) => String(e.expenseDate) <= endDate);
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
      return res.json(filtered);
    }

    const paginated = sortAndPaginateRecords({
      records: filtered,
      limit,
      skip,
      sortKey: sortKey || 'expenseDate',
      sortDir,
    });

    res.json(paginated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post('/expenses', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    const { category, amount, expenseDate, paymentMethod, description } = req.body;
    const expAmount = Number(amount);

    if (!category || isNaN(expAmount) || expAmount <= 0) {
      return res.status(400).json({ error: 'Valid category and positive amount are required' });
    }

    const [created] = await db
      .insert(businessExpenses)
      .values({
        workspace: ws,
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
    const ws = getRequestWorkspace(req);
    const id = parseInt(req.params.id, 10);
    await db
      .delete(businessExpenses)
      .where(and(eq(businessExpenses.id, id), eq(businessExpenses.workspace, ws)));
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
    const ws = getRequestWorkspace(req);
    const period = (req.query.period as string) || 'today';
    const customStart = req.query.startDate as string;
    const customEnd = req.query.endDate as string;

    const now = new Date();
    const todayStr = getPakistanDate(now);
    let startDate = todayStr;
    let endDate = todayStr;

    if (period === 'yesterday') {
      startDate = shiftPakistanDate(now, -1);
      endDate = startDate;
    } else if (period === 'last7days') {
      startDate = shiftPakistanDate(now, -6);
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
      .where(
        and(eq(sales.workspace, ws), gte(sales.saleDate, startDate), lte(sales.saleDate, endDate))
      );

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
      .where(
        and(
          eq(businessExpenses.workspace, ws),
          gte(businessExpenses.expenseDate, startDate),
          lte(businessExpenses.expenseDate, endDate)
        )
      );

    const periodGeneralExpenses = expensesList.reduce((sum, e) => sum + Number(e.amount), 0);

    // 3. Worker payments for date range
    const paymentsList = await db
      .select()
      .from(workerPayments)
      .where(
        and(
          eq(workerPayments.workspace, ws),
          gte(workerPayments.paymentDate, startDate),
          lte(workerPayments.paymentDate, endDate)
        )
      );

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
      .where(and(eq(stockBatches.workspace, ws), eq(stockBatches.isClosed, false)));

    const totalAvailableStock = Number(activeBatches[0]?.totalRemaining || 0);

    // 6. Purchases for date range
    const periodPurchases = await db
      .select({
        totalAmount: sql<string>`coalesce(sum(purchase_amount), '0')`,
        totalWeight: sql<string>`coalesce(sum(total_weight_kg), '0')`,
        count: sql<number>`count(*)`,
      })
      .from(purchaseLoads)
      .where(
        and(
          eq(purchaseLoads.workspace, ws),
          gte(purchaseLoads.purchaseDate, startDate),
          lte(purchaseLoads.purchaseDate, endDate)
        )
      );

    const totalPurchaseAmount = Number(periodPurchases[0]?.totalAmount || 0);
    const totalPurchaseWeight = Number(periodPurchases[0]?.totalWeight || 0);

    // 7. Load expenses for date range
    const periodLoadExpenses = await db
      .select({
        total: sql<string>`coalesce(sum(amount), '0')`,
      })
      .from(loadExpenses)
      .where(
        and(
          eq(loadExpenses.workspace, ws),
          gte(loadExpenses.expenseDate, startDate),
          lte(loadExpenses.expenseDate, endDate)
        )
      );

    const totalLoadExpenses = Number(periodLoadExpenses[0]?.total || 0);

    // 8. Dealer Total Outstanding Balance across all suppliers
    const allSuppliers = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.workspace, ws));
    let totalDealerOutstanding = 0;
    for (const sup of allSuppliers) {
      const tx = await db
        .select()
        .from(dealerTransactions)
        .where(and(eq(dealerTransactions.supplierId, sup.id), eq(dealerTransactions.workspace, ws)))
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
        shopId: sales.shopId,
        shopName: shops.shopName,
        totalPieces: sales.totalPieces,
        totalAmount: sales.totalAmount,
        totalProfit: sales.totalProfit,
      })
      .from(sales)
      .leftJoin(shops, eq(sales.shopId, shops.id))
      .where(eq(sales.workspace, ws))
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
      .where(and(eq(purchaseLoads.workspace, ws), eq(suppliers.workspace, ws)))
      .orderBy(desc(purchaseLoads.purchaseDate), desc(purchaseLoads.id))
      .limit(5);

    const recentExpenses = await db
      .select()
      .from(businessExpenses)
      .where(eq(businessExpenses.workspace, ws))
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
      .where(
        and(
          eq(stockBatches.workspace, ws),
          eq(stockBatches.isClosed, false),
          lte(stockBatches.remainingPieces, 100)
        )
      )
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
      const dayStr = shiftPakistanDate(now, -i);

      const daySales = await db
        .select({
          revenue: sql<string>`coalesce(sum(total_amount), '0')`,
          cogs: sql<string>`coalesce(sum(total_cost), '0')`,
          profit: sql<string>`coalesce(sum(total_profit), '0')`,
          pieces: sql<string>`coalesce(sum(total_pieces), '0')`,
        })
        .from(sales)
        .where(and(eq(sales.workspace, ws), eq(sales.saleDate, dayStr)));

      const dayGenExp = await db
        .select({
          total: sql<string>`coalesce(sum(amount), '0')`,
        })
        .from(businessExpenses)
        .where(and(eq(businessExpenses.workspace, ws), eq(businessExpenses.expenseDate, dayStr)));

      const dayWkrExp = await db
        .select({
          total: sql<string>`coalesce(sum(amount), '0')`,
        })
        .from(workerPayments)
        .where(and(eq(workerPayments.workspace, ws), eq(workerPayments.paymentDate, dayStr)));

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
    const ws = getRequestWorkspace(req);
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
      .where(
        and(eq(sales.workspace, ws), gte(sales.saleDate, startDate), lte(sales.saleDate, endDate))
      )
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
      .where(
        and(
          eq(businessExpenses.workspace, ws),
          gte(businessExpenses.expenseDate, startDate),
          lte(businessExpenses.expenseDate, endDate)
        )
      )
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
      .where(
        and(
          eq(workerPayments.workspace, ws),
          eq(workers.workspace, ws),
          gte(workerPayments.paymentDate, startDate),
          lte(workerPayments.paymentDate, endDate)
        )
      )
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
      .where(
        and(
          eq(purchaseLoads.workspace, ws),
          eq(suppliers.workspace, ws),
          gte(purchaseLoads.purchaseDate, startDate),
          lte(purchaseLoads.purchaseDate, endDate)
        )
      )
      .orderBy(desc(purchaseLoads.purchaseDate));

    const totalPurchasesAmount = purchasesList.reduce((sum, p) => sum + Number(p.purchaseAmount), 0);
    const totalPurchasesWeight = purchasesList.reduce((sum, p) => sum + Number(p.totalWeightKg), 0);

    // 5. Landed Load Expenses in period (with load & supplier details)
    const loadExpList = await db
      .select({
        id: loadExpenses.id,
        purchaseLoadId: loadExpenses.purchaseLoadId,
        loadNumber: purchaseLoads.loadNumber,
        supplierName: suppliers.name,
        category: loadExpenses.category,
        amount: loadExpenses.amount,
        expenseDate: loadExpenses.expenseDate,
        description: loadExpenses.description,
        createdAt: loadExpenses.createdAt,
      })
      .from(loadExpenses)
      .innerJoin(purchaseLoads, eq(loadExpenses.purchaseLoadId, purchaseLoads.id))
      .innerJoin(suppliers, eq(purchaseLoads.supplierId, suppliers.id))
      .where(
        and(
          eq(loadExpenses.workspace, ws),
          eq(purchaseLoads.workspace, ws),
          eq(suppliers.workspace, ws),
          gte(loadExpenses.expenseDate, startDate),
          lte(loadExpenses.expenseDate, endDate)
        )
      )
      .orderBy(desc(loadExpenses.expenseDate), desc(loadExpenses.id));

    const totalLoadExpAmount = loadExpList.reduce((sum, e) => sum + Number(e.amount), 0);

    // 6. Dealer Payments in period
    const dealerPaymentsList = await db
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
      .where(
        and(
          eq(dealerTransactions.workspace, ws),
          eq(suppliers.workspace, ws),
          gte(dealerTransactions.transactionDate, startDate),
          lte(dealerTransactions.transactionDate, endDate),
          eq(dealerTransactions.transactionType, 'PAYMENT_CREDIT')
        )
      )
      .orderBy(desc(dealerTransactions.transactionDate), desc(dealerTransactions.id));

    // 7. Current Stock Valuation
    const activeBatchesList = await db
      .select()
      .from(stockBatches)
      .where(and(eq(stockBatches.workspace, ws), eq(stockBatches.isClosed, false)));

    const stockValuation = {
      totalPieces: activeBatchesList.reduce((s, b) => s + b.remainingPieces, 0),
      totalValue: Number(
        activeBatchesList
          .reduce((s, b) => s + b.remainingPieces * Number(b.costPerPiece), 0)
          .toFixed(2)
      ),
      activeBatchesCount: activeBatchesList.length,
    };

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
      loadExpenses: loadExpList,
      dealerPayments: dealerPaymentsList,
      stockValuation,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 14. WORKSPACE CLEAR, DYNAMIC 6-MONTH DEMO SEED, RESET & BOOTSTRAP
// -------------------------------------------------------------
async function clearWorkspaceData(ws: WorkspaceMode, includeSettings = true): Promise<void> {
  // Delete leaf child tables first in parallel, then parents tier-by-tier
  await Promise.all([
    db.delete(saleItems).where(eq(saleItems.workspace, ws)),
    db.delete(stockMovements).where(eq(stockMovements.workspace, ws)),
    db.delete(loadExpenses).where(eq(loadExpenses.workspace, ws)),
    db.delete(dealerTransactions).where(eq(dealerTransactions.workspace, ws)),
    db.delete(workerPayments).where(eq(workerPayments.workspace, ws)),
    db.delete(businessExpenses).where(eq(businessExpenses.workspace, ws)),
  ]);

  await Promise.all([
    db.delete(sales).where(eq(sales.workspace, ws)),
    db.delete(stockBatches).where(eq(stockBatches.workspace, ws)),
    db.delete(workers).where(eq(workers.workspace, ws)),
  ]);

  await Promise.all([
    db.delete(purchaseLoads).where(eq(purchaseLoads.workspace, ws)),
    db.delete(shops).where(eq(shops.workspace, ws)),
    db.delete(vehicles).where(eq(vehicles.workspace, ws)),
  ]);

  await Promise.all([
    db.delete(suppliers).where(eq(suppliers.workspace, ws)),
    includeSettings ? db.delete(settings).where(eq(settings.workspace, ws)) : Promise.resolve(),
  ]);
}

let activeDemoSeedPromise: Promise<{ seeded: boolean; message: string }> | null = null;

async function seedSixMonthDemoWorkspace(): Promise<{ seeded: boolean; message: string }> {
  if (activeDemoSeedPromise) {
    return activeDemoSeedPromise;
  }

  activeDemoSeedPromise = (async () => {
    const ws: WorkspaceMode = 'demo';
    await clearWorkspaceData(ws, true);

    const dataset = buildSixMonthDemoDataset(new Date());

    // 1. Bulk insert top-level independent entities in parallel
    const [insertedSuppliers, , insertedShops, insertedWorkers] = await Promise.all([
      dataset.suppliers.length > 0
        ? db
            .insert(suppliers)
            .values(
              dataset.suppliers.map((s) => ({
                workspace: ws,
                name: s.name,
                phone: s.phone,
                address: s.address,
                openingBalance: s.openingBalance,
                notes: s.notes,
              }))
            )
            .returning()
        : Promise.resolve([]),
      dataset.vehicles.length > 0
        ? db.insert(vehicles).values(
            dataset.vehicles.map((v) => ({
              workspace: ws,
              vehicleNumber: v.vehicleNumber,
              driverName: v.driverName,
              driverPhone: v.driverPhone,
              notes: v.notes,
            }))
          )
        : Promise.resolve([]),
      dataset.shops.length > 0
        ? db
            .insert(shops)
            .values(
              dataset.shops.map((sh) => ({
                workspace: ws,
                shopName: sh.shopName,
                ownerName: sh.ownerName,
                phone: sh.phone,
                address: sh.address,
                notes: sh.notes,
              }))
            )
            .returning()
        : Promise.resolve([]),
      dataset.workers.length > 0
        ? db
            .insert(workers)
            .values(
              dataset.workers.map((w) => ({
                workspace: ws,
                name: w.name,
                phone: w.phone,
                notes: w.notes,
                isActive: w.isActive,
              }))
            )
            .returning()
        : Promise.resolve([]),
    ]);

    const supplierIdByKey = new Map<string, number>();
    dataset.suppliers.forEach((s, idx) => {
      const match = insertedSuppliers[idx] || insertedSuppliers.find((r) => r.name === s.name);
      if (match) supplierIdByKey.set(s.key, match.id);
    });

    const shopIdByKey = new Map<string, number>();
    dataset.shops.forEach((sh, idx) => {
      const match = insertedShops[idx] || insertedShops.find((r) => r.shopName === sh.shopName);
      if (match) shopIdByKey.set(sh.key, match.id);
    });

    const workerIdByKey = new Map<string, number>();
    dataset.workers.forEach((w, idx) => {
      const match = insertedWorkers[idx] || insertedWorkers.find((r) => r.name === w.name);
      if (match) workerIdByKey.set(w.key, match.id);
    });

    // 2. Bulk insert purchase loads
    const loadIdByKey = new Map<string, number>();
    const insertedLoads =
      dataset.purchaseLoads.length > 0
        ? await db
            .insert(purchaseLoads)
            .values(
              dataset.purchaseLoads.map((load) => ({
                workspace: ws,
                loadNumber: load.loadNumber,
                supplierId: supplierIdByKey.get(load.supplierKey)!,
                purchaseDate: load.purchaseDate,
                totalWeightKg: load.totalWeightKg,
                purchaseAmount: load.purchaseAmount,
                vehicleNumber: load.vehicleNumber,
                driverName: load.driverName,
                status: load.status,
                notes: load.notes,
              }))
            )
            .returning()
        : [];

    dataset.purchaseLoads.forEach((load, idx) => {
      const match =
        insertedLoads[idx] || insertedLoads.find((r) => r.loadNumber === load.loadNumber);
      if (match) loadIdByKey.set(load.key, match.id);
    });

    // 3. Bulk insert load expenses & stock batches in parallel
    const allLoadExpenseRows = dataset.purchaseLoads.flatMap((load) => {
      const loadId = loadIdByKey.get(load.key)!;
      return load.loadExpenses.map((exp) => ({
        workspace: ws,
        purchaseLoadId: loadId,
        category: exp.category,
        amount: exp.amount,
        expenseDate: exp.expenseDate,
        description: exp.description,
      }));
    });

    const batchEntries = dataset.purchaseLoads
      .filter((load) => Boolean(load.batch))
      .map((load) => ({
        loadKey: load.key,
        batch: load.batch!,
      }));

    const [, insertedBatches] = await Promise.all([
      allLoadExpenseRows.length > 0
        ? db.insert(loadExpenses).values(allLoadExpenseRows)
        : Promise.resolve([]),
      batchEntries.length > 0
        ? db
            .insert(stockBatches)
            .values(
              batchEntries.map(({ loadKey, batch: b }) => ({
                workspace: ws,
                batchNumber: b.batchNumber,
                purchaseLoadId: loadIdByKey.get(loadKey)!,
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
              }))
            )
            .returning()
        : Promise.resolve([]),
    ]);

    const batchIdByKey = new Map<string, number>();
    batchEntries.forEach(({ batch: b }, idx) => {
      const match =
        insertedBatches[idx] || insertedBatches.find((r) => r.batchNumber === b.batchNumber);
      if (match) batchIdByKey.set(b.key, match.id);
    });

    // 4. Bulk insert dealer transactions & sales in parallel
    const [, insertedSales] = await Promise.all([
      dataset.dealerTransactions.length > 0
        ? db.insert(dealerTransactions).values(
            dataset.dealerTransactions.map((tx) => ({
              workspace: ws,
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
            }))
          )
        : Promise.resolve([]),
      dataset.sales.length > 0
        ? db
            .insert(sales)
            .values(
              dataset.sales.map((s) => ({
                workspace: ws,
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
              }))
            )
            .returning()
        : Promise.resolve([]),
    ]);

    const saleIdByKey = new Map<string, number>();
    dataset.sales.forEach((s, idx) => {
      const match =
        insertedSales[idx] || insertedSales.find((r) => r.invoiceNumber === s.invoiceNumber);
      if (match) saleIdByKey.set(s.key, match.id);
    });

    // 5. Bulk insert sale items, stock movements, worker payments, general expenses, and settings in parallel
    const allSaleItems = dataset.sales.flatMap((s) => {
      const saleId = saleIdByKey.get(s.key)!;
      return s.items.map((item) => ({
        workspace: ws,
        saleId,
        stockBatchId: batchIdByKey.get(item.batchKey)!,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
      }));
    });

    const settingsEntries = Object.entries(dataset.settings);

    await Promise.all([
      allSaleItems.length > 0 ? db.insert(saleItems).values(allSaleItems) : Promise.resolve([]),
      dataset.stockMovements.length > 0
        ? db.insert(stockMovements).values(
            dataset.stockMovements.map((m) => ({
              workspace: ws,
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
            }))
          )
        : Promise.resolve([]),
      dataset.workerPayments.length > 0
        ? db.insert(workerPayments).values(
            dataset.workerPayments.map((wp) => ({
              workspace: ws,
              workerId: workerIdByKey.get(wp.workerKey)!,
              amount: wp.amount,
              paymentDate: wp.paymentDate,
              paymentMethod: wp.paymentMethod,
              description: wp.description,
            }))
          )
        : Promise.resolve([]),
      dataset.businessExpenses.length > 0
        ? db.insert(businessExpenses).values(
            dataset.businessExpenses.map((exp) => ({
              workspace: ws,
              category: exp.category,
              amount: exp.amount,
              expenseDate: exp.expenseDate,
              paymentMethod: exp.paymentMethod,
              description: exp.description,
            }))
          )
        : Promise.resolve([]),
      settingsEntries.length > 0
        ? db.insert(settings).values(
            settingsEntries.map(([key, value]) => ({
              workspace: ws,
              key,
              value,
              updatedAt: new Date(),
            }))
          )
        : Promise.resolve([]),
    ]);

    return {
      seeded: true,
      message: 'Demo data loaded with 6 months of synced poultry shop records.',
    };
  })().finally(() => {
    activeDemoSeedPromise = null;
  });

  return activeDemoSeedPromise;
}

async function runRealSeed(force = false): Promise<{ seeded: boolean; message: string }> {
  const ws: WorkspaceMode = 'real';
  if (!force) {
    const supCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(eq(suppliers.workspace, ws));
    if (Number(supCount[0]?.count || 0) > 0) {
      return { seeded: false, message: 'Database already has data. Skipping seed.' };
    }
  } else {
    await clearWorkspaceData(ws, false);
  }

  const now = new Date();
  const todayStr = getPakistanDate(now);
  const date3DaysAgo = shiftPakistanDate(now, -3);
  const dateYesterday = shiftPakistanDate(now, -1);

  const [sup1] = await db
    .insert(suppliers)
    .values({
      workspace: ws,
      name: 'Chaudhry Poultry Farms',
      phone: '0300-8451234',
      address: 'Kamoke G.T. Road, Gujranwala',
      openingBalance: '150000.00',
      notes: 'Main supplier for heavy broiler chickens',
    })
    .returning();

  const [sup2] = await db
    .insert(suppliers)
    .values({
      workspace: ws,
      name: 'Mian Brothers Hatchery',
      phone: '0321-7654321',
      address: 'Sheikhupura Bypass',
      openingBalance: '50000.00',
      notes: 'Fast delivery medium broiler supplier',
    })
    .returning();

  await db.insert(dealerTransactions).values([
    {
      workspace: ws,
      supplierId: sup1.id,
      transactionDate: date3DaysAgo,
      transactionType: 'PURCHASE_DEBIT',
      debitAmount: '150000.00',
      creditAmount: '0.00',
      balanceAfter: '150000.00',
      referenceType: 'OPENING_BALANCE',
      notes: 'Previous balance carried forward',
    },
    {
      workspace: ws,
      supplierId: sup2.id,
      transactionDate: date3DaysAgo,
      transactionType: 'PURCHASE_DEBIT',
      debitAmount: '50000.00',
      creditAmount: '0.00',
      balanceAfter: '50000.00',
      referenceType: 'OPENING_BALANCE',
      notes: 'Previous balance carried forward',
    },
  ]);

  await db.insert(vehicles).values([
    {
      workspace: ws,
      vehicleNumber: 'LES-4921',
      driverName: 'Muhammad Aslam',
      driverPhone: '0312-4411223',
      notes: 'Mazda Titan 14ft Open Cage',
    },
    {
      workspace: ws,
      vehicleNumber: 'GA-8119',
      driverName: 'Rashid Mehmood',
      driverPhone: '0345-9988776',
      notes: 'Hino Dutro',
    },
  ]);

  const [shop1] = await db
    .insert(shops)
    .values({
      workspace: ws,
      shopName: 'Bismillah Chicken Center',
      ownerName: 'Tariq Butt',
      phone: '0333-4123890',
      address: 'Main Market, Gulberg, Lahore',
    })
    .returning();

  const [shop2] = await db
    .insert(shops)
    .values({
      workspace: ws,
      shopName: 'Madina Meat & Poultry Shop',
      ownerName: 'Haji Farooq',
      phone: '0301-5544332',
      address: 'Saddar Bazaar, Lahore Cantt',
    })
    .returning();

  const [worker1] = await db
    .insert(workers)
    .values({
      workspace: ws,
      name: 'Akram Masih',
      phone: '0322-1122334',
      notes: 'Head cutter and shop supervisor',
      isActive: true,
    })
    .returning();

  const [worker2] = await db
    .insert(workers)
    .values({
      workspace: ws,
      name: 'Zahid Khan',
      phone: '0315-7766554',
      notes: 'Loader & transport helper',
      isActive: true,
    })
    .returning();

  const [load1] = await db
    .insert(purchaseLoads)
    .values({
      workspace: ws,
      loadNumber: `LOAD-${date3DaysAgo.replace(/-/g, '')}-001`,
      supplierId: sup1.id,
      purchaseDate: date3DaysAgo,
      totalWeightKg: '4500.00',
      purchaseAmount: '1350000.00',
      vehicleNumber: 'LES-4921',
      driverName: 'Muhammad Aslam',
      status: 'RECEIVED',
      notes: '4,500 KG live birds from Gujranwala',
    })
    .returning();

  await db.insert(dealerTransactions).values({
    workspace: ws,
    supplierId: sup1.id,
    transactionDate: date3DaysAgo,
    transactionType: 'PURCHASE_DEBIT',
    debitAmount: '1350000.00',
    creditAmount: '0.00',
    balanceAfter: '1500000.00',
    referenceType: 'PURCHASE_LOAD',
    referenceId: load1.id,
    notes: `Truck ${load1.loadNumber} (4,500 KG @ PKR 300/KG)`,
  });

  await db.insert(loadExpenses).values([
    {
      workspace: ws,
      purchaseLoadId: load1.id,
      category: 'Fuel',
      amount: '22000.00',
      expenseDate: date3DaysAgo,
      description: 'Diesel Gujranwala to Lahore',
    },
    {
      workspace: ws,
      purchaseLoadId: load1.id,
      category: 'Loading',
      amount: '6000.00',
      expenseDate: date3DaysAgo,
      description: 'Farm loaders fee',
    },
    {
      workspace: ws,
      purchaseLoadId: load1.id,
      category: 'Driver Expense',
      amount: '4000.00',
      expenseDate: date3DaysAgo,
      description: 'Driver daily allowance & meal',
    },
  ]);

  const [batch1] = await db
    .insert(stockBatches)
    .values({
      workspace: ws,
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
      notes: 'Heavy broiler birds batch',
    })
    .returning();

  await db.insert(stockMovements).values({
    workspace: ws,
    stockBatchId: batch1.id,
    movementType: 'STOCK_IN',
    quantity: 880,
    balanceAfter: 880,
    unitCost: '1570.45',
    referenceType: 'PURCHASE_LOAD',
    referenceId: load1.id,
    notes: 'Received 900 birds (12 dead, 8 damaged)',
  });

  const [load2] = await db
    .insert(purchaseLoads)
    .values({
      workspace: ws,
      loadNumber: `LOAD-${dateYesterday.replace(/-/g, '')}-001`,
      supplierId: sup2.id,
      purchaseDate: dateYesterday,
      totalWeightKg: '3000.00',
      purchaseAmount: '930000.00',
      vehicleNumber: 'GA-8119',
      driverName: 'Rashid Mehmood',
      status: 'RECEIVED',
      notes: 'Sheikhupura medium broiler truck',
    })
    .returning();

  await db.insert(dealerTransactions).values({
    workspace: ws,
    supplierId: sup2.id,
    transactionDate: dateYesterday,
    transactionType: 'PURCHASE_DEBIT',
    debitAmount: '930000.00',
    creditAmount: '0.00',
    balanceAfter: '980000.00',
    referenceType: 'PURCHASE_LOAD',
    referenceId: load2.id,
    notes: `Truck ${load2.loadNumber} (3,000 KG @ PKR 310/KG)`,
  });

  await db.insert(loadExpenses).values([
    {
      workspace: ws,
      purchaseLoadId: load2.id,
      category: 'Transportation',
      amount: '18000.00',
      expenseDate: dateYesterday,
      description: 'Truck fare',
    },
    {
      workspace: ws,
      purchaseLoadId: load2.id,
      category: 'Unloading',
      amount: '4000.00',
      expenseDate: dateYesterday,
      description: 'Unloading at shop',
    },
  ]);

  const [batch2] = await db
    .insert(stockBatches)
    .values({
      workspace: ws,
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
    workspace: ws,
    stockBatchId: batch2.id,
    movementType: 'STOCK_IN',
    quantity: 590,
    balanceAfter: 590,
    unitCost: '1613.56',
    referenceType: 'PURCHASE_LOAD',
    referenceId: load2.id,
    notes: 'Received 600 birds (6 dead, 4 damaged)',
  });

  const [load3] = await db
    .insert(purchaseLoads)
    .values({
      workspace: ws,
      loadNumber: `LOAD-${todayStr.replace(/-/g, '')}-001`,
      supplierId: sup1.id,
      purchaseDate: todayStr,
      totalWeightKg: '2500.00',
      purchaseAmount: '762500.00',
      vehicleNumber: 'LES-4921',
      driverName: 'Muhammad Aslam',
      status: 'PENDING_RECEIVING',
      notes: 'Morning fresh truck arrived, waiting for bird count',
    })
    .returning();

  await db.insert(dealerTransactions).values({
    workspace: ws,
    supplierId: sup1.id,
    transactionDate: todayStr,
    transactionType: 'PURCHASE_DEBIT',
    debitAmount: '762500.00',
    creditAmount: '0.00',
    balanceAfter: '2262500.00',
    referenceType: 'PURCHASE_LOAD',
    referenceId: load3.id,
    notes: `Truck ${load3.loadNumber} (2,500 KG @ PKR 305/KG)`,
  });

  await db.insert(loadExpenses).values([
    {
      workspace: ws,
      purchaseLoadId: load3.id,
      category: 'Fuel',
      amount: '15000.00',
      expenseDate: todayStr,
      description: 'Diesel & toll tax',
    },
  ]);

  const [sale1] = await db
    .insert(sales)
    .values({
      workspace: ws,
      invoiceNumber: `INV-${dateYesterday.replace(/-/g, '')}-0001`,
      saleType: 'OWN_SHOP',
      saleDate: dateYesterday,
      totalPieces: 300,
      totalAmount: '555000.00',
      totalCost: '471135.00',
      totalProfit: '83865.00',
      sellingPricePerPiece: '1850.00',
      costPerPiece: '1570.45',
      profitPerPiece: '279.55',
      notes: 'Evening retail counter sales',
    })
    .returning();

  await db.insert(saleItems).values({
    workspace: ws,
    saleId: sale1.id,
    stockBatchId: batch1.id,
    quantity: 300,
    unitCost: '1570.45',
    totalCost: '471135.00',
  });

  await db.insert(stockMovements).values({
    workspace: ws,
    stockBatchId: batch1.id,
    movementType: 'SALE_OUT',
    quantity: -300,
    balanceAfter: 580,
    unitCost: '1570.45',
    referenceType: 'SALE',
    referenceId: sale1.id,
    notes: `Counter sale ${sale1.invoiceNumber}`,
  });

  const [sale2] = await db
    .insert(sales)
    .values({
      workspace: ws,
      invoiceNumber: `WHL-${dateYesterday.replace(/-/g, '')}-0002`,
      saleType: 'WHOLESALE',
      saleDate: dateYesterday,
      shopId: shop1.id,
      totalPieces: 150,
      totalAmount: '270000.00',
      totalCost: '235567.50',
      totalProfit: '34432.50',
      sellingPricePerPiece: '1800.00',
      costPerPiece: '1570.45',
      profitPerPiece: '229.55',
      notes: 'Delivered to Bismillah Chicken Center, Gulberg',
    })
    .returning();

  await db.insert(saleItems).values({
    workspace: ws,
    saleId: sale2.id,
    stockBatchId: batch1.id,
    quantity: 150,
    unitCost: '1570.45',
    totalCost: '235567.50',
  });

  await db.insert(stockMovements).values({
    workspace: ws,
    stockBatchId: batch1.id,
    movementType: 'WHOLESALE_OUT',
    quantity: -150,
    balanceAfter: 430,
    unitCost: '1570.45',
    referenceType: 'SHOP_DISTRIBUTION',
    referenceId: sale2.id,
    notes: `Wholesale delivery ${sale2.invoiceNumber} to Bismillah Chicken Center`,
  });

  const [sale3] = await db
    .insert(sales)
    .values({
      workspace: ws,
      invoiceNumber: `INV-${todayStr.replace(/-/g, '')}-0003`,
      saleType: 'OWN_SHOP',
      saleDate: todayStr,
      totalPieces: 100,
      totalAmount: '188000.00',
      totalCost: '157045.00',
      totalProfit: '30955.00',
      sellingPricePerPiece: '1880.00',
      costPerPiece: '1570.45',
      profitPerPiece: '309.55',
      notes: 'Morning counter sales',
    })
    .returning();

  await db.insert(saleItems).values({
    workspace: ws,
    saleId: sale3.id,
    stockBatchId: batch1.id,
    quantity: 100,
    unitCost: '1570.45',
    totalCost: '157045.00',
  });

  await db.insert(stockMovements).values({
    workspace: ws,
    stockBatchId: batch1.id,
    movementType: 'SALE_OUT',
    quantity: -100,
    balanceAfter: 330,
    unitCost: '1570.45',
    referenceType: 'SALE',
    referenceId: sale3.id,
    notes: `Counter sale ${sale3.invoiceNumber}`,
  });

  const [sale4] = await db
    .insert(sales)
    .values({
      workspace: ws,
      invoiceNumber: `WHL-${todayStr.replace(/-/g, '')}-0004`,
      saleType: 'WHOLESALE',
      saleDate: todayStr,
      shopId: shop2.id,
      totalPieces: 100,
      totalAmount: '185000.00',
      totalCost: '161356.00',
      totalProfit: '23644.00',
      sellingPricePerPiece: '1850.00',
      costPerPiece: '1613.56',
      profitPerPiece: '236.44',
      notes: 'Delivered to Madina Meat & Poultry Shop, Cantt',
    })
    .returning();

  await db.insert(saleItems).values({
    workspace: ws,
    saleId: sale4.id,
    stockBatchId: batch2.id,
    quantity: 100,
    unitCost: '1613.56',
    totalCost: '161356.00',
  });

  await db.insert(stockMovements).values({
    workspace: ws,
    stockBatchId: batch2.id,
    movementType: 'WHOLESALE_OUT',
    quantity: -100,
    balanceAfter: 490,
    unitCost: '1613.56',
    referenceType: 'SHOP_DISTRIBUTION',
    referenceId: sale4.id,
    notes: `Wholesale delivery ${sale4.invoiceNumber} to Madina Meat & Poultry Shop`,
  });

  await db.insert(dealerTransactions).values({
    workspace: ws,
    supplierId: sup1.id,
    transactionDate: todayStr,
    transactionType: 'PAYMENT_CREDIT',
    debitAmount: '0.00',
    creditAmount: '500000.00',
    balanceAfter: '1762500.00',
    referenceType: 'PAYMENT',
    paymentMethod: 'BANK_TRANSFER',
    notes: 'HBL Online transfer partial payment',
  });

  await db.insert(businessExpenses).values([
    {
      workspace: ws,
      category: 'Electricity',
      amount: '18500.00',
      expenseDate: dateYesterday,
      paymentMethod: 'CASH',
      description: 'LESCO commercial shop electricity bill',
    },
    {
      workspace: ws,
      category: 'Food',
      amount: '1500.00',
      expenseDate: todayStr,
      paymentMethod: 'CASH',
      description: 'Staff lunch',
    },
    {
      workspace: ws,
      category: 'Tea',
      amount: '800.00',
      expenseDate: todayStr,
      paymentMethod: 'CASH',
      description: 'Daily tea and refreshments',
    },
    {
      workspace: ws,
      category: 'Cleaning',
      amount: '1200.00',
      expenseDate: todayStr,
      paymentMethod: 'CASH',
      description: 'Disinfectant & cleaning supplies',
    },
  ]);

  await db.insert(workerPayments).values([
    {
      workspace: ws,
      workerId: worker1.id,
      amount: '5000.00',
      paymentDate: todayStr,
      paymentMethod: 'CASH',
      description: 'Weekly cash wage payment',
    },
    {
      workspace: ws,
      workerId: worker2.id,
      amount: '3500.00',
      paymentDate: todayStr,
      paymentMethod: 'CASH',
      description: 'Weekly wage payment',
    },
  ]);

  return { seeded: true, message: 'Sample business data loaded and synced across all modules' };
}

apiRouter.post('/seed', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    if (ws === 'demo') {
      const result = await seedSixMonthDemoWorkspace();
      return res.json({ success: true, ...result });
    }
    const force = Boolean(req.body?.force || req.query?.force === 'true');
    const result = await runRealSeed(force);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Seed failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mode-aware Workspace Reset
apiRouter.post('/reset', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);
    if (ws === 'demo') {
      await seedSixMonthDemoWorkspace();
      return res.json({
        success: true,
        mode: 'demo',
        message: 'Demo account reset with fresh 6-month dynamic data. Real data is untouched.',
      });
    }

    await clearWorkspaceData('real', true);
    return res.json({
      success: true,
      mode: 'real',
      message: 'All real business records have been permanently cleared.',
    });
  } catch (error: any) {
    console.error('Reset workspace failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unified Bootstrap Endpoint for Zustand Store
apiRouter.get('/bootstrap', async (req: Request, res: Response) => {
  try {
    const ws = getRequestWorkspace(req);

    // Only auto-seed when the demo sandbox is empty; NEVER auto-seed real workspace
    // so resetting real data keeps the account cleanly empty.
    if (ws === 'demo') {
      const demoSupCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(suppliers)
        .where(eq(suppliers.workspace, 'demo'));
      if (Number(demoSupCount[0]?.count || 0) === 0) {
        await seedSixMonthDemoWorkspace();
      }
    }

    const [
      allSuppliers,
      allLoads,
      allBatches,
      allMovements,
      allSales,
      allShops,
      allDealerTx,
      allWorkers,
      allWorkerPayments,
      allExpenses,
      allVehicles,
      allSettings,
      allLoadExps,
    ] = await Promise.all([
      db
        .select()
        .from(suppliers)
        .where(eq(suppliers.workspace, ws))
        .orderBy(asc(suppliers.name)),
      db
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
        .where(and(eq(purchaseLoads.workspace, ws), eq(suppliers.workspace, ws)))
        .orderBy(desc(purchaseLoads.purchaseDate), desc(purchaseLoads.id)),
      db
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
        .where(
          and(
            eq(stockBatches.workspace, ws),
            eq(purchaseLoads.workspace, ws),
            eq(suppliers.workspace, ws)
          )
        )
        .orderBy(asc(stockBatches.receivingDate), asc(stockBatches.id)),
      db
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
        .where(and(eq(stockMovements.workspace, ws), eq(stockBatches.workspace, ws)))
        .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
        .limit(200),
      db
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
        .where(eq(sales.workspace, ws))
        .orderBy(desc(sales.saleDate), desc(sales.id)),
      db
        .select()
        .from(shops)
        .where(eq(shops.workspace, ws))
        .orderBy(asc(shops.shopName)),
      db
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
        .where(and(eq(dealerTransactions.workspace, ws), eq(suppliers.workspace, ws)))
        .orderBy(desc(dealerTransactions.id)),
      db
        .select()
        .from(workers)
        .where(eq(workers.workspace, ws))
        .orderBy(asc(workers.name)),
      db
        .select({
          id: workerPayments.id,
          workerId: workerPayments.workerId,
          workerName: workers.name,
          amount: workerPayments.amount,
          paymentDate: workerPayments.paymentDate,
          paymentMethod: workerPayments.paymentMethod,
          description: workerPayments.description,
          createdAt: workerPayments.createdAt,
        })
        .from(workerPayments)
        .innerJoin(workers, eq(workerPayments.workerId, workers.id))
        .where(and(eq(workerPayments.workspace, ws), eq(workers.workspace, ws)))
        .orderBy(desc(workerPayments.paymentDate), desc(workerPayments.id)),
      db
        .select()
        .from(businessExpenses)
        .where(eq(businessExpenses.workspace, ws))
        .orderBy(desc(businessExpenses.expenseDate), desc(businessExpenses.id)),
      db
        .select()
        .from(vehicles)
        .where(eq(vehicles.workspace, ws))
        .orderBy(asc(vehicles.vehicleNumber)),
      db.select().from(settings).where(eq(settings.workspace, ws)),
      db
        .select()
        .from(loadExpenses)
        .where(eq(loadExpenses.workspace, ws))
        .orderBy(desc(loadExpenses.id)),
    ]);

    // Enrich suppliers
    const enrichedSuppliers = allSuppliers.map((sup) => {
      const supTxs = allDealerTx.filter((t) => t.supplierId === sup.id);
      const currentBalance =
        supTxs.length > 0 ? Number(supTxs[0].balanceAfter) : Number(sup.openingBalance);
      const supLoads = allLoads.filter((l) => l.supplierId === sup.id);
      return {
        ...sup,
        currentBalance,
        totalPurchasesAmount: supLoads.reduce((s, l) => s + Number(l.purchaseAmount), 0),
        purchaseCount: supLoads.length,
      };
    });

    // Enrich purchases
    const enrichedPurchases = allLoads.map((load) => {
      const exps = allLoadExps.filter((e) => e.purchaseLoadId === load.id);
      const totalExp = exps.reduce((s, e) => s + Number(e.amount), 0);
      const batch = allBatches.find((b) => b.purchaseLoadId === load.id) || null;
      return {
        ...load,
        expenses: exps,
        purchaseRatePerKg: calculatePurchaseRate(
          Number(load.purchaseAmount),
          Number(load.totalWeightKg)
        ),
        totalExpenses: totalExp,
        totalLandedCost: calculateLandedCost(Number(load.purchaseAmount), totalExp),
        stockBatch: batch,
      };
    });

    // Enrich shops
    const enrichedShops = allShops.map((sh) => {
      const shopSales = allSales.filter((s) => s.shopId === sh.id);
      return {
        ...sh,
        totalPiecesDelivered: shopSales.reduce((s, x) => s + x.totalPieces, 0),
        totalSalesAmount: shopSales.reduce((s, x) => s + Number(x.totalAmount), 0),
        ordersCount: shopSales.length,
      };
    });

    // Enrich workers
    const enrichedWorkers = allWorkers.map((w) => {
      const wPmts = allWorkerPayments.filter((p) => p.workerId === w.id);
      return {
        ...w,
        totalPaid: wPmts.reduce((s, p) => s + Number(p.amount), 0),
        paymentCount: wPmts.length,
      };
    });

    const config: Record<string, string> = {
      businessName:
        ws === 'demo' ? 'Al-Madina Poultry Traders (Demo)' : 'Al-Madina Poultry Traders',
      businessLocation: 'Lahore Road, Punjab, Pakistan',
      examplePrice1: ws === 'demo' ? '1850' : '1200',
      examplePrice2: ws === 'demo' ? '1950' : '1500',
      lowStockThreshold: '300',
    };
    allSettings.forEach((s) => {
      config[s.key] = s.value;
    });

    res.json({
      suppliers: enrichedSuppliers,
      purchases: enrichedPurchases,
      batches: allBatches,
      movements: allMovements,
      sales: allSales,
      shops: enrichedShops,
      dealerTransactions: allDealerTx,
      workers: enrichedWorkers,
      workerPayments: allWorkerPayments,
      expenses: allExpenses,
      vehicles: allVehicles,
      settings: config,
    });
  } catch (error: any) {
    console.error('Bootstrap failed:', error);
    res.status(500).json({ error: error.message });
  }
});

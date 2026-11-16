import demoSeedJson from '../data/demoData.json' with { type: 'json' };
import {
  calculateSaleablePieces,
  calculateLandedCost,
  calculateCostPerPiece,
  calculateSaleMetrics,
  calculatePurchaseRate,
  consumeBatchesFifo,
} from './poultryMath.js';
import { getLocalPakistanDate, shiftPakistanDate } from './syncCalculations.js';

export interface DemoCredentialsConfig {
  email: string;
  password: string;
  uid: string;
  name: string;
  role: string;
}

export const DEMO_STATIC_CREDENTIALS: DemoCredentialsConfig = demoSeedJson.credentials;

export interface DemoSupplierSeed {
  key: string;
  name: string;
  phone: string;
  address: string;
  openingBalance: string;
  notes: string;
  openingDate: string;
}

export interface DemoVehicleSeed {
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  notes: string;
}

export interface DemoShopSeed {
  key: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  notes: string;
}

export interface DemoWorkerSeed {
  key: string;
  name: string;
  phone: string;
  notes: string;
  isActive: boolean;
}

export interface DemoLoadExpenseSeed {
  category: string;
  amount: string;
  expenseDate: string;
  description: string;
}

export interface DemoPurchaseLoadSeed {
  key: string;
  loadNumber: string;
  supplierKey: string;
  purchaseDate: string;
  totalWeightKg: string;
  purchaseAmount: string;
  vehicleNumber: string;
  driverName: string;
  status: 'RECEIVED' | 'PENDING_RECEIVING';
  notes: string;
  loadExpenses: DemoLoadExpenseSeed[];
  batch?: {
    key: string;
    batchNumber: string;
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
    notes: string;
  };
}

export interface DemoDealerPaymentSeed {
  supplierKey: string;
  transactionDate: string;
  amount: string;
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';
  notes: string;
}

export interface DemoDealerTransactionSeed {
  supplierKey: string;
  transactionDate: string;
  transactionType: 'PURCHASE_DEBIT' | 'PAYMENT_CREDIT';
  debitAmount: string;
  creditAmount: string;
  balanceAfter: string;
  referenceType: 'OPENING_BALANCE' | 'PURCHASE_LOAD' | 'PAYMENT';
  loadKey?: string;
  paymentMethod?: string | null;
  notes: string;
}

export interface DemoSaleSeed {
  key: string;
  invoiceNumber: string;
  saleType: 'OWN_SHOP' | 'WHOLESALE';
  saleDate: string;
  shopKey?: string;
  totalPieces: number;
  totalAmount: string;
  totalCost: string;
  totalProfit: string;
  sellingPricePerPiece: string;
  costPerPiece: string;
  profitPerPiece: string;
  notes: string;
  items: Array<{
    batchKey: string;
    quantity: number;
    unitCost: string;
    totalCost: string;
  }>;
}

export interface DemoStockMovementSeed {
  batchKey: string;
  movementType: 'STOCK_IN' | 'SALE_OUT' | 'WHOLESALE_OUT';
  quantity: number;
  balanceAfter: number;
  unitCost: string;
  referenceType: 'PURCHASE_LOAD' | 'SALE' | 'SHOP_DISTRIBUTION';
  loadKey?: string;
  saleKey?: string;
  notes: string;
  movementDate?: string;
}

export interface DemoWorkerPaymentSeed {
  workerKey: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  description: string;
}

export interface DemoBusinessExpenseSeed {
  category: string;
  amount: string;
  expenseDate: string;
  paymentMethod: string;
  description: string;
}

export interface SixMonthDemoDataset {
  startDate: string;
  endDate: string;
  suppliers: DemoSupplierSeed[];
  vehicles: DemoVehicleSeed[];
  shops: DemoShopSeed[];
  workers: DemoWorkerSeed[];
  purchaseLoads: DemoPurchaseLoadSeed[];
  dealerTransactions: DemoDealerTransactionSeed[];
  sales: DemoSaleSeed[];
  stockMovements: DemoStockMovementSeed[];
  workerPayments: DemoWorkerPaymentSeed[];
  businessExpenses: DemoBusinessExpenseSeed[];
  settings: Record<string, string>;
}

interface InternalBatchState {
  key: string;
  batchNumber: string;
  receivingDate: string;
  remainingPieces: number;
  soldPieces: number;
  costPerPiece: number;
}

/**
 * Hydrates the static demo template JSON (`src/data/demoData.json`) against `baseDate`
 * using relative `offsetDays` so all dates, invoice numbers, and 6-month charts always
 * reflect live current-day history — regardless of what year the app is opened.
 */
export function buildSixMonthDemoDataset(baseDate: Date = new Date()): SixMonthDemoDataset {
  const todayStr = getLocalPakistanDate(baseDate);
  const startDate = shiftPakistanDate(baseDate, -175);

  const suppliers: DemoSupplierSeed[] = demoSeedJson.suppliers.map((s) => ({
    key: s.key,
    name: s.name,
    phone: s.phone,
    address: s.address,
    openingBalance: s.openingBalance,
    notes: s.notes,
    openingDate: shiftPakistanDate(baseDate, s.openingOffsetDays ?? -175),
  }));

  const vehicles: DemoVehicleSeed[] = demoSeedJson.vehicles.map((v) => ({
    vehicleNumber: v.vehicleNumber,
    driverName: v.driverName,
    driverPhone: v.driverPhone,
    notes: v.notes,
  }));

  const shops: DemoShopSeed[] = demoSeedJson.shops.map((sh) => ({
    key: sh.key,
    shopName: sh.shopName,
    ownerName: sh.ownerName,
    phone: sh.phone,
    address: sh.address,
    notes: sh.notes,
  }));

  const workers: DemoWorkerSeed[] = demoSeedJson.workers.map((w) => ({
    key: w.key,
    name: w.name,
    phone: w.phone,
    notes: w.notes,
    isActive: Boolean(w.isActive),
  }));

  const purchaseLoads: DemoPurchaseLoadSeed[] = [];
  const stockMovements: DemoStockMovementSeed[] = [];
  const loadDaySeq: Record<string, number> = {};
  const batchStates: InternalBatchState[] = [];

  for (let i = 0; i < demoSeedJson.loadBlueprints.length; i++) {
    const bp = demoSeedJson.loadBlueprints[i];
    const pDate = shiftPakistanDate(baseDate, bp.offsetDays);
    const compactDate = pDate.replace(/-/g, '');
    loadDaySeq[compactDate] = (loadDaySeq[compactDate] || 0) + 1;
    const loadNumber = `LOAD-${compactDate}-${String(loadDaySeq[compactDate]).padStart(3, '0')}`;
    const loadKey = `load${i + 1}`;
    const purchaseAmountNum = Number((bp.weightKg * bp.ratePerKg).toFixed(2));
    const vehicle = vehicles[bp.vehicleIdx] || vehicles[0];

    const loadExps: DemoLoadExpenseSeed[] = [
      {
        category: 'Fuel',
        amount: bp.fuelCost.toFixed(2),
        expenseDate: pDate,
        description: 'Diesel & highway toll',
      },
      {
        category: 'Loading',
        amount: bp.loadingCost.toFixed(2),
        expenseDate: pDate,
        description: 'Farm & shop loaders',
      },
    ];
    if (bp.driverCost > 0) {
      loadExps.push({
        category: 'Driver Expense',
        amount: bp.driverCost.toFixed(2),
        expenseDate: pDate,
        description: 'Driver trip allowance & meal',
      });
    }

    const totalLoadExp = loadExps.reduce((s, e) => s + Number(e.amount), 0);

    if (bp.status === 'RECEIVED') {
      const saleable = calculateSaleablePieces(bp.receivedPieces, bp.deadPieces, bp.damagedPieces);
      const landed = calculateLandedCost(purchaseAmountNum, totalLoadExp);
      const costPerPiece = calculateCostPerPiece(landed, saleable);
      const batchKey = `batch${i + 1}`;
      const batchNumber = `BATCH-${loadNumber}`;

      batchStates.push({
        key: batchKey,
        batchNumber,
        receivingDate: pDate,
        remainingPieces: saleable,
        soldPieces: 0,
        costPerPiece,
      });

      stockMovements.push({
        batchKey,
        movementType: 'STOCK_IN',
        quantity: saleable,
        balanceAfter: saleable,
        unitCost: costPerPiece.toFixed(2),
        referenceType: 'PURCHASE_LOAD',
        loadKey,
        movementDate: pDate,
        notes: `Received ${bp.receivedPieces} birds (${bp.deadPieces} dead, ${bp.damagedPieces} damaged)`,
      });

      purchaseLoads.push({
        key: loadKey,
        loadNumber,
        supplierKey: bp.supplierKey,
        purchaseDate: pDate,
        totalWeightKg: bp.weightKg.toFixed(2),
        purchaseAmount: purchaseAmountNum.toFixed(2),
        vehicleNumber: vehicle.vehicleNumber,
        driverName: vehicle.driverName,
        status: 'RECEIVED',
        notes: bp.notes,
        loadExpenses: loadExps,
        batch: {
          key: batchKey,
          batchNumber,
          receivingDate: pDate,
          receivedPieces: bp.receivedPieces,
          deadPieces: bp.deadPieces,
          damagedPieces: bp.damagedPieces,
          originalSaleablePieces: saleable,
          soldPieces: 0,
          remainingPieces: saleable,
          purchaseAmount: purchaseAmountNum.toFixed(2),
          totalLoadExpenses: totalLoadExp.toFixed(2),
          totalLandedCost: landed.toFixed(2),
          costPerPiece: costPerPiece.toFixed(2),
          isClosed: false,
          notes: bp.notes,
        },
      });
    } else {
      purchaseLoads.push({
        key: loadKey,
        loadNumber,
        supplierKey: bp.supplierKey,
        purchaseDate: pDate,
        totalWeightKg: bp.weightKg.toFixed(2),
        purchaseAmount: purchaseAmountNum.toFixed(2),
        vehicleNumber: vehicle.vehicleNumber,
        driverName: vehicle.driverName,
        status: 'PENDING_RECEIVING',
        notes: bp.notes,
        loadExpenses: loadExps,
      });
    }
  }

  const sales: DemoSaleSeed[] = [];

  for (let i = 0; i < demoSeedJson.saleBlueprints.length; i++) {
    const sb = demoSeedJson.saleBlueprints[i];
    const sDate = shiftPakistanDate(baseDate, sb.offsetDays);
    const saleKey = `sale${i + 1}`;
    const prefix = sb.saleType === 'OWN_SHOP' ? 'INV' : 'WHL';
    const invoiceNumber = `${prefix}-${sDate.replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`;

    const eligibleBatches = batchStates
      .filter((b) => b.receivingDate <= sDate && b.remainingPieces > 0)
      .map((b) => ({
        id: batchStates.indexOf(b) + 1,
        batchNumber: b.batchNumber,
        remainingPieces: b.remainingPieces,
        costPerPiece: b.costPerPiece,
      }));

    const fifoResult = consumeBatchesFifo(eligibleBatches, sb.pieces);
    if (fifoResult.remainingShortfall > 0) {
      throw new Error(`Demo FIFO shortfall on ${saleKey} (${sDate}): short by ${fifoResult.remainingShortfall}`);
    }

    const avgCost = fifoResult.totalCost / sb.pieces;
    const targetSellPrice = Math.round((avgCost + sb.markupPerPiece) / 5) * 5;
    const totalSaleAmount = Number((targetSellPrice * sb.pieces).toFixed(2));
    const metrics = calculateSaleMetrics(totalSaleAmount, sb.pieces, fifoResult.totalCost);

    const items: DemoSaleSeed['items'] = [];
    for (const consumed of fifoResult.consumedBatches) {
      const targetState = batchStates[consumed.batchId - 1];
      targetState.remainingPieces -= consumed.quantity;
      targetState.soldPieces += consumed.quantity;

      items.push({
        batchKey: targetState.key,
        quantity: consumed.quantity,
        unitCost: consumed.unitCost.toFixed(2),
        totalCost: consumed.totalCost.toFixed(2),
      });

      stockMovements.push({
        batchKey: targetState.key,
        movementType: sb.saleType === 'OWN_SHOP' ? 'SALE_OUT' : 'WHOLESALE_OUT',
        quantity: -consumed.quantity,
        balanceAfter: targetState.remainingPieces,
        unitCost: consumed.unitCost.toFixed(2),
        referenceType: sb.saleType === 'OWN_SHOP' ? 'SALE' : 'SHOP_DISTRIBUTION',
        saleKey,
        movementDate: sDate,
        notes:
          sb.saleType === 'OWN_SHOP'
            ? `Walk-in sale ${invoiceNumber}: ${consumed.quantity} birds`
            : `Delivery ${invoiceNumber}: ${consumed.quantity} birds`,
      });
    }

    sales.push({
      key: saleKey,
      invoiceNumber,
      saleType: sb.saleType as 'OWN_SHOP' | 'WHOLESALE',
      saleDate: sDate,
      shopKey: sb.shopKey,
      totalPieces: sb.pieces,
      totalAmount: totalSaleAmount.toFixed(2),
      totalCost: fifoResult.totalCost.toFixed(2),
      totalProfit: metrics.totalProfit.toFixed(2),
      sellingPricePerPiece: metrics.sellingPricePerPiece.toFixed(2),
      costPerPiece: metrics.costPerPiece.toFixed(2),
      profitPerPiece: metrics.profitPerPiece.toFixed(2),
      notes: sb.notes,
      items,
    });
  }

  const stateByBatchKey = new Map(batchStates.map((b) => [b.key, b]));
  for (const load of purchaseLoads) {
    if (load.batch) {
      const st = stateByBatchKey.get(load.batch.key);
      if (st) {
        load.batch.soldPieces = st.soldPieces;
        load.batch.remainingPieces = st.remainingPieces;
        load.batch.isClosed = st.remainingPieces === 0;
      }
    }
  }

  const dealerPaymentSeeds: DemoDealerPaymentSeed[] = demoSeedJson.dealerPaymentBlueprints.map((p) => ({
    supplierKey: p.supplierKey,
    transactionDate: shiftPakistanDate(baseDate, p.offsetDays),
    amount: p.amount,
    paymentMethod: p.paymentMethod as 'BANK_TRANSFER' | 'CASH' | 'CHEQUE',
    notes: p.notes,
  }));

  type RawTx = {
    supplierKey: string;
    date: string;
    order: number;
    type: 'PURCHASE_DEBIT' | 'PAYMENT_CREDIT';
    debit: number;
    credit: number;
    refType: 'OPENING_BALANCE' | 'PURCHASE_LOAD' | 'PAYMENT';
    loadKey?: string;
    paymentMethod?: string | null;
    notes: string;
  };

  const rawTxs: RawTx[] = [];
  for (const sup of suppliers) {
    const op = Number(sup.openingBalance);
    if (op !== 0) {
      rawTxs.push({
        supplierKey: sup.key,
        date: sup.openingDate,
        order: 0,
        type: 'PURCHASE_DEBIT',
        debit: op,
        credit: 0,
        refType: 'OPENING_BALANCE',
        notes: 'Previous balance carried forward',
      });
    }
  }
  for (const l of purchaseLoads) {
    const amt = Number(l.purchaseAmount);
    const rate = calculatePurchaseRate(amt, Number(l.totalWeightKg));
    rawTxs.push({
      supplierKey: l.supplierKey,
      date: l.purchaseDate,
      order: 1,
      type: 'PURCHASE_DEBIT',
      debit: amt,
      credit: 0,
      refType: 'PURCHASE_LOAD',
      loadKey: l.key,
      notes: `Truck ${l.loadNumber} (${Number(l.totalWeightKg).toLocaleString('en-US')} KG @ PKR ${rate}/KG)`,
    });
  }
  for (const p of dealerPaymentSeeds) {
    rawTxs.push({
      supplierKey: p.supplierKey,
      date: p.transactionDate,
      order: 2,
      type: 'PAYMENT_CREDIT',
      debit: 0,
      credit: Number(p.amount),
      refType: 'PAYMENT',
      paymentMethod: p.paymentMethod,
      notes: p.notes,
    });
  }

  rawTxs.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  const supRunningBalance: Record<string, number> = {};
  const dealerTransactions: DemoDealerTransactionSeed[] = rawTxs.map((tx) => {
    const prev = supRunningBalance[tx.supplierKey] || 0;
    const next = Number((prev + tx.debit - tx.credit).toFixed(2));
    supRunningBalance[tx.supplierKey] = next;
    return {
      supplierKey: tx.supplierKey,
      transactionDate: tx.date,
      transactionType: tx.type,
      debitAmount: tx.debit.toFixed(2),
      creditAmount: tx.credit.toFixed(2),
      balanceAfter: next.toFixed(2),
      referenceType: tx.refType,
      loadKey: tx.loadKey,
      paymentMethod: tx.paymentMethod ?? null,
      notes: tx.notes,
    };
  });

  const businessExpenses: DemoBusinessExpenseSeed[] = [];
  const workerPayments: DemoWorkerPaymentSeed[] = [];

  const monthAnchors = demoSeedJson.expenseSchedule.monthlyAnchors;
  for (let m = 0; m < monthAnchors.length; m++) {
    const dRent = shiftPakistanDate(baseDate, monthAnchors[m]);
    const dElec = shiftPakistanDate(baseDate, monthAnchors[m] + 4);
    const dMaint = shiftPakistanDate(baseDate, monthAnchors[m] + 9);
    const dClean = shiftPakistanDate(baseDate, monthAnchors[m] + 12);

    businessExpenses.push(
      {
        category: 'Rent',
        amount: '45000.00',
        expenseDate: dRent,
        paymentMethod: 'BANK_TRANSFER',
        description: `Monthly shop & cage yard rent (Month ${m + 1})`,
      },
      {
        category: 'Electricity',
        amount: String(19500 + m * 650) + '.00',
        expenseDate: dElec,
        paymentMethod: 'CASH',
        description: 'LESCO commercial shop electricity bill',
      },
      {
        category: 'Maintenance',
        amount: String(4500 + (m % 3) * 1200) + '.00',
        expenseDate: dMaint,
        paymentMethod: 'CASH',
        description: 'Cage welding, scale check & water line repair',
      },
      {
        category: 'Cleaning',
        amount: '2800.00',
        expenseDate: dClean,
        paymentMethod: 'CASH',
        description: 'Shop sanitizer, lime & washdown supplies',
      }
    );
  }

  for (let w = demoSeedJson.expenseSchedule.weeklyCount; w >= 0; w--) {
    const offset = Math.min(0, -w * 7);
    const d = shiftPakistanDate(baseDate, offset);
    for (const exp of demoSeedJson.expenseSchedule.weeklyExpenses) {
      businessExpenses.push({
        category: exp.category,
        amount: exp.amount,
        expenseDate: d,
        paymentMethod: exp.paymentMethod,
        description: exp.description,
      });
    }
    for (const wage of demoSeedJson.expenseSchedule.weeklyWorkerWages) {
      workerPayments.push({
        workerKey: wage.workerKey,
        amount: wage.amount,
        paymentDate: d,
        paymentMethod: wage.paymentMethod,
        description: wage.description,
      });
    }
  }

  for (const exp of demoSeedJson.expenseSchedule.todayExpenses) {
    businessExpenses.push({
      category: exp.category,
      amount: exp.amount,
      expenseDate: todayStr,
      paymentMethod: exp.paymentMethod,
      description: exp.description,
    });
  }

  return {
    startDate,
    endDate: todayStr,
    suppliers,
    vehicles,
    shops,
    workers,
    purchaseLoads,
    dealerTransactions,
    sales,
    stockMovements,
    workerPayments,
    businessExpenses,
    settings: { ...demoSeedJson.settings },
  };
}

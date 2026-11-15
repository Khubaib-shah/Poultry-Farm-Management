import {
  calculateSaleablePieces,
  calculateLandedCost,
  calculateCostPerPiece,
  calculateSaleMetrics,
  calculatePurchaseRate,
  consumeBatchesFifo,
} from './poultryMath.ts';
import { getLocalPakistanDate, shiftPakistanDate } from './syncCalculations.ts';

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

export function buildSixMonthDemoDataset(baseDate: Date = new Date()): SixMonthDemoDataset {
  const todayStr = getLocalPakistanDate(baseDate);
  const startDate = shiftPakistanDate(baseDate, -175);

  // 1. Suppliers
  const suppliers: DemoSupplierSeed[] = [
    {
      key: 'sup1',
      name: 'Chaudhry Poultry Farms',
      phone: '0300-8451234',
      address: 'Kamoke G.T. Road, Gujranwala',
      openingBalance: '120000.00',
      notes: 'Primary supplier for heavy broiler trucks',
      openingDate: startDate,
    },
    {
      key: 'sup2',
      name: 'Mian Brothers Hatchery',
      phone: '0321-7654321',
      address: 'Sheikhupura Bypass',
      openingBalance: '65000.00',
      notes: 'Regular medium broiler supplier',
      openingDate: startDate,
    },
    {
      key: 'sup3',
      name: 'Ravi Broiler Breeders',
      phone: '0334-6129088',
      address: 'Kasur Multan Road',
      openingBalance: '0.00',
      notes: 'Quick morning dispatch loads',
      openingDate: startDate,
    },
    {
      key: 'sup4',
      name: 'Al-Fajar Poultry Traders',
      phone: '0302-9914521',
      address: 'Okara Poultry Mandi',
      openingBalance: '40000.00',
      notes: 'Backup farm supply for peak weekends',
      openingDate: startDate,
    },
  ];

  // 2. Vehicles
  const vehicles: DemoVehicleSeed[] = [
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
      notes: 'Hino Dutro Cage Truck',
    },
    {
      vehicleNumber: 'LEJ-7734',
      driverName: 'Tariq Javed',
      driverPhone: '0306-5541122',
      notes: 'Suzuki Pickup Backup',
    },
  ];

  // 3. Buyer Shops
  const shops: DemoShopSeed[] = [
    {
      key: 'shop1',
      shopName: 'Bismillah Chicken Center',
      ownerName: 'Tariq Butt',
      phone: '0333-4123890',
      address: 'Main Market, Gulberg, Lahore',
      notes: 'Daily wholesale buyer',
    },
    {
      key: 'shop2',
      shopName: 'Madina Meat & Poultry Shop',
      ownerName: 'Haji Farooq',
      phone: '0301-5544332',
      address: 'Saddar Bazaar, Lahore Cantt',
      notes: 'Takes large morning cage orders',
    },
    {
      key: 'shop3',
      shopName: 'Al-Raziq Broiler Point',
      ownerName: 'Imran Qureshi',
      phone: '0322-8871234',
      address: 'C-Block Market, Model Town',
      notes: 'Regular twice-a-week orders',
    },
    {
      key: 'shop4',
      shopName: 'Lahore Fresh Meat',
      ownerName: 'Salman Malik',
      phone: '0311-9045678',
      address: 'Allah Hoo Chowk, Johar Town',
      notes: 'Prefers medium weight birds',
    },
    {
      key: 'shop5',
      shopName: 'Noor Poultry Corner',
      ownerName: 'Bilal Ahmed',
      phone: '0344-7732190',
      address: 'Shadbagh Chowk, Lahore',
      notes: 'Cash on delivery buyer',
    },
  ];

  // 4. Workers
  const workers: DemoWorkerSeed[] = [
    {
      key: 'wrk1',
      name: 'Akram Masih',
      phone: '0322-1122334',
      notes: 'Head cutter and shop supervisor',
      isActive: true,
    },
    {
      key: 'wrk2',
      name: 'Zahid Khan',
      phone: '0315-7766554',
      notes: 'Loader & transport helper',
      isActive: true,
    },
    {
      key: 'wrk3',
      name: 'Nadeem Iqbal',
      phone: '0304-6628910',
      notes: 'Counter sales & weighing assistant',
      isActive: true,
    },
  ];

  // 5. Purchase Loads across ~6 months (offsetDays from today)
  // 18 RECEIVED loads from -175 to -1, plus 1 PENDING_RECEIVING load today (0)
  const loadBlueprints: Array<{
    offsetDays: number;
    supplierKey: string;
    vehicleIdx: number;
    weightKg: number;
    ratePerKg: number;
    receivedPieces: number;
    deadPieces: number;
    damagedPieces: number;
    fuelCost: number;
    loadingCost: number;
    driverCost: number;
    status: 'RECEIVED' | 'PENDING_RECEIVING';
    notes: string;
  }> = [
    { offsetDays: -175, supplierKey: 'sup1', vehicleIdx: 0, weightKg: 4200, ratePerKg: 275, receivedPieces: 2100, deadPieces: 18, damagedPieces: 12, fuelCost: 19000, loadingCost: 5000, driverCost: 3500, status: 'RECEIVED', notes: 'Month 1 opening broiler truck' },
    { offsetDays: -167, supplierKey: 'sup2', vehicleIdx: 1, weightKg: 3800, ratePerKg: 280, receivedPieces: 1900, deadPieces: 14, damagedPieces: 10, fuelCost: 17500, loadingCost: 4500, driverCost: 3200, status: 'RECEIVED', notes: 'Sheikhupura broiler consignment' },
    { offsetDays: -158, supplierKey: 'sup3', vehicleIdx: 0, weightKg: 3900, ratePerKg: 278, receivedPieces: 1950, deadPieces: 15, damagedPieces: 9, fuelCost: 18000, loadingCost: 4800, driverCost: 3400, status: 'RECEIVED', notes: 'Kasur farm direct load' },

    { offsetDays: -145, supplierKey: 'sup1', vehicleIdx: 0, weightKg: 4100, ratePerKg: 282, receivedPieces: 2050, deadPieces: 16, damagedPieces: 10, fuelCost: 20500, loadingCost: 5500, driverCost: 3500, status: 'RECEIVED', notes: 'Month 2 heavy farm truck' },
    { offsetDays: -135, supplierKey: 'sup4', vehicleIdx: 1, weightKg: 3600, ratePerKg: 285, receivedPieces: 1800, deadPieces: 12, damagedPieces: 8, fuelCost: 21000, loadingCost: 4500, driverCost: 3500, status: 'RECEIVED', notes: 'Okara mandi load' },
    { offsetDays: -124, supplierKey: 'sup2', vehicleIdx: 1, weightKg: 3800, ratePerKg: 288, receivedPieces: 1900, deadPieces: 14, damagedPieces: 11, fuelCost: 18500, loadingCost: 5000, driverCost: 3500, status: 'RECEIVED', notes: 'Mid-month refill batch' },

    { offsetDays: -112, supplierKey: 'sup3', vehicleIdx: 0, weightKg: 4000, ratePerKg: 290, receivedPieces: 2000, deadPieces: 18, damagedPieces: 10, fuelCost: 19500, loadingCost: 5200, driverCost: 3600, status: 'RECEIVED', notes: 'Month 3 morning arrival' },
    { offsetDays: -102, supplierKey: 'sup1', vehicleIdx: 0, weightKg: 4200, ratePerKg: 292, receivedPieces: 2100, deadPieces: 19, damagedPieces: 11, fuelCost: 21000, loadingCost: 5600, driverCost: 3800, status: 'RECEIVED', notes: 'Weekend rush broiler stock' },
    { offsetDays: -92, supplierKey: 'sup2', vehicleIdx: 1, weightKg: 3700, ratePerKg: 294, receivedPieces: 1850, deadPieces: 13, damagedPieces: 9, fuelCost: 18000, loadingCost: 4800, driverCost: 3400, status: 'RECEIVED', notes: 'Healthy medium weight lot' },

    { offsetDays: -78, supplierKey: 'sup4', vehicleIdx: 1, weightKg: 3800, ratePerKg: 296, receivedPieces: 1900, deadPieces: 15, damagedPieces: 10, fuelCost: 22000, loadingCost: 5000, driverCost: 3500, status: 'RECEIVED', notes: 'Month 4 Okara farm dispatch' },
    { offsetDays: -68, supplierKey: 'sup1', vehicleIdx: 0, weightKg: 4200, ratePerKg: 298, receivedPieces: 2100, deadPieces: 17, damagedPieces: 12, fuelCost: 20500, loadingCost: 5500, driverCost: 3700, status: 'RECEIVED', notes: 'Chaudhry Farms fresh load' },
    { offsetDays: -57, supplierKey: 'sup3', vehicleIdx: 0, weightKg: 3900, ratePerKg: 300, receivedPieces: 1950, deadPieces: 14, damagedPieces: 9, fuelCost: 19000, loadingCost: 5100, driverCost: 3500, status: 'RECEIVED', notes: 'Kasur evening delivery' },

    { offsetDays: -45, supplierKey: 'sup2', vehicleIdx: 1, weightKg: 4100, ratePerKg: 302, receivedPieces: 2050, deadPieces: 16, damagedPieces: 10, fuelCost: 19500, loadingCost: 5300, driverCost: 3600, status: 'RECEIVED', notes: 'Month 5 main batch' },
    { offsetDays: -34, supplierKey: 'sup1', vehicleIdx: 0, weightKg: 4300, ratePerKg: 304, receivedPieces: 2150, deadPieces: 18, damagedPieces: 12, fuelCost: 21500, loadingCost: 5800, driverCost: 3900, status: 'RECEIVED', notes: 'End-of-month full cage truck' },
    { offsetDays: -23, supplierKey: 'sup3', vehicleIdx: 0, weightKg: 3900, ratePerKg: 305, receivedPieces: 1950, deadPieces: 13, damagedPieces: 8, fuelCost: 18800, loadingCost: 5000, driverCost: 3500, status: 'RECEIVED', notes: 'Month 6 early supply' },

    { offsetDays: -12, supplierKey: 'sup4', vehicleIdx: 1, weightKg: 3800, ratePerKg: 308, receivedPieces: 1900, deadPieces: 12, damagedPieces: 8, fuelCost: 21500, loadingCost: 4900, driverCost: 3500, status: 'RECEIVED', notes: 'Recent Okara broiler load' },
    { offsetDays: -5, supplierKey: 'sup1', vehicleIdx: 0, weightKg: 3200, ratePerKg: 310, receivedPieces: 1600, deadPieces: 10, damagedPieces: 6, fuelCost: 19500, loadingCost: 4600, driverCost: 3400, status: 'RECEIVED', notes: 'This week primary broiler batch' },
    { offsetDays: -1, supplierKey: 'sup2', vehicleIdx: 1, weightKg: 2600, ratePerKg: 312, receivedPieces: 1300, deadPieces: 8, damagedPieces: 5, fuelCost: 17500, loadingCost: 4200, driverCost: 3200, status: 'RECEIVED', notes: 'Yesterday fresh arrival' },
    { offsetDays: 0, supplierKey: 'sup1', vehicleIdx: 0, weightKg: 2200, ratePerKg: 315, receivedPieces: 0, deadPieces: 0, damagedPieces: 0, fuelCost: 15500, loadingCost: 4000, driverCost: 0, status: 'PENDING_RECEIVING', notes: 'Morning truck arrived — awaiting bird count' },
  ];

  const purchaseLoads: DemoPurchaseLoadSeed[] = [];
  const stockMovements: DemoStockMovementSeed[] = [];
  const loadDaySeq: Record<string, number> = {};
  const batchStates: InternalBatchState[] = [];

  for (let i = 0; i < loadBlueprints.length; i++) {
    const bp = loadBlueprints[i];
    const pDate = shiftPakistanDate(baseDate, bp.offsetDays);
    const compactDate = pDate.replace(/-/g, '');
    loadDaySeq[compactDate] = (loadDaySeq[compactDate] || 0) + 1;
    const loadNumber = `LOAD-${compactDate}-${String(loadDaySeq[compactDate]).padStart(3, '0')}`;
    const loadKey = `load${i + 1}`;
    const purchaseAmountNum = Number((bp.weightKg * bp.ratePerKg).toFixed(2));
    const vehicle = vehicles[bp.vehicleIdx];

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

  // 6. Sales across the 6 months (respecting FIFO batches received on or before each sale date)
  // Carefully sized so earlier batches deplete cleanly to 0 and recent batches still hold ~850-1000 healthy birds!
  const saleBlueprints: Array<{
    offsetDays: number;
    saleType: 'OWN_SHOP' | 'WHOLESALE';
    shopKey?: string;
    pieces: number;
    markupPerPiece: number;
    notes: string;
  }> = [
    // Month 1 (-174 to -150) — total ~5300 birds received
    { offsetDays: -174, saleType: 'OWN_SHOP', pieces: 420, markupPerPiece: 95, notes: 'Walk-in retail counter' },
    { offsetDays: -173, saleType: 'WHOLESALE', shopKey: 'shop1', pieces: 500, markupPerPiece: 70, notes: 'Morning cage delivery' },
    { offsetDays: -170, saleType: 'WHOLESALE', shopKey: 'shop2', pieces: 480, markupPerPiece: 72, notes: 'Cantt wholesale supply' },
    { offsetDays: -168, saleType: 'OWN_SHOP', pieces: 450, markupPerPiece: 98, notes: 'Weekend retail rush' },
    { offsetDays: -163, saleType: 'WHOLESALE', shopKey: 'shop3', pieces: 520, markupPerPiece: 75, notes: 'Model Town bulk bill' },
    { offsetDays: -160, saleType: 'OWN_SHOP', pieces: 510, markupPerPiece: 92, notes: 'Daily shop counter' },
    { offsetDays: -158, saleType: 'WHOLESALE', shopKey: 'shop4', pieces: 460, markupPerPiece: 70, notes: 'Johar Town supply' },
    { offsetDays: -154, saleType: 'OWN_SHOP', pieces: 440, markupPerPiece: 96, notes: 'Shop counter evening' },
    { offsetDays: -151, saleType: 'WHOLESALE', shopKey: 'shop5', pieces: 550, markupPerPiece: 74, notes: 'Shadbagh delivery' },
    { offsetDays: -149, saleType: 'OWN_SHOP', pieces: 470, markupPerPiece: 95, notes: 'Month 1 closing counter' },
    { offsetDays: -146, saleType: 'WHOLESALE', shopKey: 'shop1', pieces: 500, markupPerPiece: 76, notes: 'Gulberg regular lot' },

    // Month 2 (-139 to -114) — total ~5370 birds received
    { offsetDays: -139, saleType: 'OWN_SHOP', pieces: 480, markupPerPiece: 100, notes: 'Fresh batch retail' },
    { offsetDays: -137, saleType: 'WHOLESALE', shopKey: 'shop2', pieces: 560, markupPerPiece: 78, notes: 'Saddar shop delivery' },
    { offsetDays: -134, saleType: 'OWN_SHOP', pieces: 440, markupPerPiece: 102, notes: 'Walk-in sales' },
    { offsetDays: -131, saleType: 'WHOLESALE', shopKey: 'shop3', pieces: 500, markupPerPiece: 75, notes: 'Model Town delivery' },
    { offsetDays: -128, saleType: 'OWN_SHOP', pieces: 510, markupPerPiece: 96, notes: 'Weekend walk-in' },
    { offsetDays: -125, saleType: 'WHOLESALE', shopKey: 'shop4', pieces: 580, markupPerPiece: 74, notes: 'Johar Town bulk order' },
    { offsetDays: -122, saleType: 'OWN_SHOP', pieces: 460, markupPerPiece: 98, notes: 'Counter retail' },
    { offsetDays: -117, saleType: 'WHOLESALE', shopKey: 'shop1', pieces: 620, markupPerPiece: 76, notes: 'Gulberg delivery' },
    { offsetDays: -115, saleType: 'OWN_SHOP', pieces: 540, markupPerPiece: 104, notes: 'Evening counter bill' },
    { offsetDays: -112, saleType: 'WHOLESALE', shopKey: 'shop5', pieces: 620, markupPerPiece: 72, notes: 'Shadbagh order' },

    // Month 3 (-106 to -81) — total ~5720 birds received
    { offsetDays: -106, saleType: 'OWN_SHOP', pieces: 520, markupPerPiece: 102, notes: 'Morning counter rush' },
    { offsetDays: -104, saleType: 'WHOLESALE', shopKey: 'shop2', pieces: 640, markupPerPiece: 78, notes: 'Cantt wholesale truck' },
    { offsetDays: -100, saleType: 'OWN_SHOP', pieces: 490, markupPerPiece: 105, notes: 'Shop retail sales' },
    { offsetDays: -95, saleType: 'WHOLESALE', shopKey: 'shop1', pieces: 680, markupPerPiece: 80, notes: 'Bismillah shop delivery' },
    { offsetDays: -93, saleType: 'OWN_SHOP', pieces: 560, markupPerPiece: 100, notes: 'Sunday counter sales' },
    { offsetDays: -90, saleType: 'WHOLESALE', shopKey: 'shop3', pieces: 600, markupPerPiece: 75, notes: 'Model Town order' },
    { offsetDays: -87, saleType: 'OWN_SHOP', pieces: 510, markupPerPiece: 104, notes: 'Walk-in retail' },
    { offsetDays: -84, saleType: 'WHOLESALE', shopKey: 'shop4', pieces: 650, markupPerPiece: 77, notes: 'Johar Town cage lot' },
    { offsetDays: -82, saleType: 'OWN_SHOP', pieces: 520, markupPerPiece: 106, notes: 'Counter sales' },
    { offsetDays: -79, saleType: 'WHOLESALE', shopKey: 'shop5', pieces: 540, markupPerPiece: 76, notes: 'Shadbagh delivery' },

    // Month 4 (-73 to -48) — total ~5670 birds received
    { offsetDays: -73, saleType: 'OWN_SHOP', pieces: 530, markupPerPiece: 108, notes: 'Walk-in shop counter' },
    { offsetDays: -70, saleType: 'WHOLESALE', shopKey: 'shop1', pieces: 620, markupPerPiece: 82, notes: 'Gulberg morning lot' },
    { offsetDays: -67, saleType: 'OWN_SHOP', pieces: 490, markupPerPiece: 105, notes: 'Counter retail' },
    { offsetDays: -62, saleType: 'WHOLESALE', shopKey: 'shop2', pieces: 680, markupPerPiece: 80, notes: 'Saddar Cantt supply' },
    { offsetDays: -60, saleType: 'OWN_SHOP', pieces: 550, markupPerPiece: 110, notes: 'Weekend retail' },
    { offsetDays: -57, saleType: 'WHOLESALE', shopKey: 'shop3', pieces: 610, markupPerPiece: 78, notes: 'Model Town bulk' },
    { offsetDays: -51, saleType: 'OWN_SHOP', pieces: 580, markupPerPiece: 106, notes: 'Counter retail' },
    { offsetDays: -49, saleType: 'WHOLESALE', shopKey: 'shop4', pieces: 640, markupPerPiece: 82, notes: 'Johar Town regular' },
    { offsetDays: -46, saleType: 'OWN_SHOP', pieces: 510, markupPerPiece: 104, notes: 'Daily shop bill' },
    { offsetDays: -44, saleType: 'WHOLESALE', shopKey: 'shop5', pieces: 460, markupPerPiece: 79, notes: 'Shadbagh supply' },

    // Month 5 (-40 to -18) — total ~5920 birds received
    { offsetDays: -40, saleType: 'OWN_SHOP', pieces: 520, markupPerPiece: 112, notes: 'Walk-in retail' },
    { offsetDays: -38, saleType: 'WHOLESALE', shopKey: 'shop1', pieces: 640, markupPerPiece: 84, notes: 'Gulberg bulk lot' },
    { offsetDays: -35, saleType: 'OWN_SHOP', pieces: 480, markupPerPiece: 108, notes: 'Afternoon counter' },
    { offsetDays: -32, saleType: 'WHOLESALE', shopKey: 'shop2', pieces: 560, markupPerPiece: 82, notes: 'Cantt delivery' },
    { offsetDays: -29, saleType: 'OWN_SHOP', pieces: 590, markupPerPiece: 115, notes: 'Weekend rush' },
    { offsetDays: -26, saleType: 'WHOLESALE', shopKey: 'shop3', pieces: 660, markupPerPiece: 80, notes: 'Model Town delivery' },
    { offsetDays: -23, saleType: 'OWN_SHOP', pieces: 510, markupPerPiece: 110, notes: 'Walk-in counter' },
    { offsetDays: -19, saleType: 'WHOLESALE', shopKey: 'shop4', pieces: 690, markupPerPiece: 85, notes: 'Johar Town supply' },
    { offsetDays: -17, saleType: 'OWN_SHOP', pieces: 540, markupPerPiece: 112, notes: 'Counter retail' },
    { offsetDays: -14, saleType: 'WHOLESALE', shopKey: 'shop5', pieces: 600, markupPerPiece: 82, notes: 'Shadbagh wholesale' },

    // Recent Month / Last 14 Days (-12 to Today) — total ~4400 birds received in last 3 loads
    { offsetDays: -10, saleType: 'OWN_SHOP', pieces: 410, markupPerPiece: 115, notes: 'Walk-in morning rush' },
    { offsetDays: -9, saleType: 'WHOLESALE', shopKey: 'shop1', pieces: 460, markupPerPiece: 86, notes: 'Bismillah shop delivery' },
    { offsetDays: -8, saleType: 'OWN_SHOP', pieces: 380, markupPerPiece: 112, notes: 'Retail counter sales' },
    { offsetDays: -6, saleType: 'WHOLESALE', shopKey: 'shop2', pieces: 320, markupPerPiece: 84, notes: 'Madina Meat supply' },
    { offsetDays: -5, saleType: 'OWN_SHOP', pieces: 260, markupPerPiece: 118, notes: 'Evening walk-in bill' },
    { offsetDays: -4, saleType: 'WHOLESALE', shopKey: 'shop3', pieces: 380, markupPerPiece: 88, notes: 'Al-Raziq Model Town' },
    { offsetDays: -3, saleType: 'OWN_SHOP', pieces: 340, markupPerPiece: 120, notes: 'Weekend counter bill' },
    { offsetDays: -2, saleType: 'WHOLESALE', shopKey: 'shop4', pieces: 410, markupPerPiece: 90, notes: 'Lahore Fresh Meat lot' },
    { offsetDays: -1, saleType: 'OWN_SHOP', pieces: 280, markupPerPiece: 122, notes: 'Yesterday walk-in retail' },
    { offsetDays: -1, saleType: 'WHOLESALE', shopKey: 'shop1', pieces: 250, markupPerPiece: 92, notes: 'Yesterday Bismillah delivery' },
    { offsetDays: 0, saleType: 'OWN_SHOP', pieces: 165, markupPerPiece: 125, notes: 'Today morning counter sales' },
    { offsetDays: 0, saleType: 'WHOLESALE', shopKey: 'shop2', pieces: 140, markupPerPiece: 95, notes: 'Today Cantt delivery' },
  ];

  const sales: DemoSaleSeed[] = [];

  for (let i = 0; i < saleBlueprints.length; i++) {
    const sb = saleBlueprints[i];
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
        _ref: b,
      }));

    const fifoResult = consumeBatchesFifo(eligibleBatches, sb.pieces);
    if (fifoResult.remainingShortfall > 0) {
      throw new Error(`Demo FIFO shortfall on ${saleKey} (${sDate}): short by ${fifoResult.remainingShortfall}`);
    }

    // Derive totalAmount using weighted FIFO cost + realistic per-bird markup
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
        notes:
          sb.saleType === 'OWN_SHOP'
            ? `Walk-in sale ${invoiceNumber}: ${consumed.quantity} birds`
            : `Delivery ${invoiceNumber}: ${consumed.quantity} birds`,
      });
    }

    sales.push({
      key: saleKey,
      invoiceNumber,
      saleType: sb.saleType,
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

  // Sync batch sold/remaining/isClosed back onto purchaseLoads
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

  // 7. Dealer Ledger Transactions (Opening balances + Purchase Debits + Periodic Payments sorted chronologically per supplier)
  const dealerPaymentSeeds: DemoDealerPaymentSeed[] = [
    { supplierKey: 'sup1', transactionDate: shiftPakistanDate(baseDate, -165), amount: '950000.00', paymentMethod: 'BANK_TRANSFER', notes: 'HBL Online settlement' },
    { supplierKey: 'sup2', transactionDate: shiftPakistanDate(baseDate, -155), amount: '820000.00', paymentMethod: 'CASH', notes: 'Cash paid to farm munshi' },
    { supplierKey: 'sup3', transactionDate: shiftPakistanDate(baseDate, -142), amount: '900000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Meezan Bank transfer' },
    { supplierKey: 'sup1', transactionDate: shiftPakistanDate(baseDate, -130), amount: '1100000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Monthly account clearing' },
    { supplierKey: 'sup4', transactionDate: shiftPakistanDate(baseDate, -120), amount: '780000.00', paymentMethod: 'CHEQUE', notes: 'Askari Bank cheque #4412' },
    { supplierKey: 'sup2', transactionDate: shiftPakistanDate(baseDate, -108), amount: '1050000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Partial hatchery transfer' },
    { supplierKey: 'sup3', transactionDate: shiftPakistanDate(baseDate, -96), amount: '1100000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Kasur farm settlement' },
    { supplierKey: 'sup1', transactionDate: shiftPakistanDate(baseDate, -85), amount: '1250000.00', paymentMethod: 'BANK_TRANSFER', notes: 'HBL Online payment' },
    { supplierKey: 'sup2', transactionDate: shiftPakistanDate(baseDate, -72), amount: '980000.00', paymentMethod: 'CASH', notes: 'Cash settlement' },
    { supplierKey: 'sup4', transactionDate: shiftPakistanDate(baseDate, -60), amount: '950000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Okara dealer online' },
    { supplierKey: 'sup1', transactionDate: shiftPakistanDate(baseDate, -50), amount: '1200000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Chaudhry Farms clearing' },
    { supplierKey: 'sup3', transactionDate: shiftPakistanDate(baseDate, -38), amount: '1120000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Kasur payment' },
    { supplierKey: 'sup2', transactionDate: shiftPakistanDate(baseDate, -28), amount: '1180000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Mian Brothers HBL transfer' },
    { supplierKey: 'sup1', transactionDate: shiftPakistanDate(baseDate, -18), amount: '1300000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Bi-weekly transfer' },
    { supplierKey: 'sup3', transactionDate: shiftPakistanDate(baseDate, -10), amount: '1100000.00', paymentMethod: 'CASH', notes: 'Cash paid on delivery' },
    { supplierKey: 'sup4', transactionDate: shiftPakistanDate(baseDate, -6), amount: '850000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Online account settlement' },
    { supplierKey: 'sup1', transactionDate: todayStr, amount: '550000.00', paymentMethod: 'BANK_TRANSFER', notes: 'Today partial payment via HBL' },
  ];

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

  // 8. General Business Expenses & Worker Payments across 6 months
  const businessExpenses: DemoBusinessExpenseSeed[] = [];
  const workerPayments: DemoWorkerPaymentSeed[] = [];

  // Monthly fixed & utility bills across 6 monthly intervals
  const monthAnchors = [-165, -135, -105, -75, -45, -15];
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

  // Weekly tea/food + staff wages for 25 weeks up to today
  for (let w = 25; w >= 0; w--) {
    const offset = Math.min(0, -w * 7);
    const d = shiftPakistanDate(baseDate, offset);
    businessExpenses.push(
      {
        category: 'Food',
        amount: '2400.00',
        expenseDate: d,
        paymentMethod: 'CASH',
        description: 'Weekly shop staff meals',
      },
      {
        category: 'Tea',
        amount: '950.00',
        expenseDate: d,
        paymentMethod: 'CASH',
        description: 'Chai & refreshments for buyers and drivers',
      }
    );

    workerPayments.push(
      {
        workerKey: 'wrk1',
        amount: '7500.00',
        paymentDate: d,
        paymentMethod: 'CASH',
        description: 'Weekly supervisor wage',
      },
      {
        workerKey: 'wrk2',
        amount: '5500.00',
        paymentDate: d,
        paymentMethod: 'CASH',
        description: 'Weekly loader & helper wage',
      },
      {
        workerKey: 'wrk3',
        amount: '5000.00',
        paymentDate: d,
        paymentMethod: 'CASH',
        description: 'Weekly counter staff wage',
      }
    );
  }

  // Extra today items so "Today" view has immediate lively activity
  businessExpenses.push({
    category: 'Other',
    amount: '1200.00',
    expenseDate: todayStr,
    paymentMethod: 'CASH',
    description: 'Plastic crates & polythene packing bags',
  });

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
    settings: {
      businessName: 'Al-Madina Poultry Traders (Demo)',
      businessLocation: 'Lahore Road, Punjab, Pakistan',
      examplePrice1: '1850',
      examplePrice2: '1950',
      lowStockThreshold: '300',
    },
  };
}

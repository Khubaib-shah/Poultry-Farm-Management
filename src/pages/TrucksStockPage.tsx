import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Truck,
  Boxes,
  Calculator,
  History,
  Scale,
  Check,
} from 'lucide-react';
import { motion } from 'motion/react';
import { PurchaseLoad, StockBatch, StockMovement } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { ConfirmDeleteButton } from '../components/common/ConfirmDeleteButton.tsx';
import { formatPKR, formatNumber, formatDate, formatDateTime } from '../utils/formatters.ts';
import {
  calculatePurchaseRate,
  calculateSaleablePieces,
  getCostAnalysisStatus,
} from '../utils/poultryMath.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

export type TrucksStockSubTab = 'trucks' | 'lots' | 'calculator' | 'movements';

interface TrucksStockPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
  initialSubTab?: TrucksStockSubTab;
  initialOpenNewModal?: boolean;
}

const EXPENSE_CAT_OPTIONS = [
  { value: 'Fuel', label: 'Fuel (Diesel)' },
  { value: 'Transportation', label: 'Truck Rent / Fare' },
  { value: 'Loading', label: 'Farm Loading' },
  { value: 'Unloading', label: 'Shop Unloading' },
  { value: 'Driver Expense', label: 'Driver Food & Bhatta' },
  { value: 'Other', label: 'Other Cost' },
];

export const TrucksStockPage: React.FC<TrucksStockPageProps> = ({
  onShowToast,
  initialSubTab = 'trucks',
  initialOpenNewModal = false,
}) => {
  const loads = useAppStore((s) => s.purchases);
  const suppliersList = useAppStore((s) => s.suppliers);
  const batches = useAppStore((s) => s.batches);
  const movements = useAppStore((s) => s.movements);
  const settings = useAppStore((s) => s.settings);
  const resolvedIdMap = useAppStore((s) => s.resolvedIdMap);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const isInitialLoading = loading && !initialized;

  const createPurchase = useAppStore((s) => s.createPurchase);
  const addLoadExpense = useAppStore((s) => s.addLoadExpense);
  const deleteLoadExpense = useAppStore((s) => s.deleteLoadExpense);
  const receiveStock = useAppStore((s) => s.receiveStock);
  const adjustStock = useAppStore((s) => s.adjustStock);
  const deletePurchase = useAppStore((s) => s.deletePurchase);
  const deleteBatch = useAppStore((s) => s.deleteBatch);
  const deleteMovement = useAppStore((s) => s.deleteMovement);

  const [activeTab, setActiveTab] = useState<TrucksStockSubTab>(initialSubTab);

  // Filters
  const [truckSearch, setTruckSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [lotSearch, setLotSearch] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState('ALL');

  // Truck Modals
  const [isNewLoadOpen, setIsNewLoadOpen] = useState(initialOpenNewModal);
  const [selectedLoadId, setSelectedLoadId] = useState<number | null>(null);
  const [isReceivingOpen, setIsReceivingOpen] = useState(false);
  const [receivingLoad, setReceivingLoad] = useState<PurchaseLoad | null>(null);
  const [confirmDeleteExpId, setConfirmDeleteExpId] = useState<number | null>(null);

  // New Truck Form
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => getLocalPakistanDate());
  const [totalWeightKg, setTotalWeightKg] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [notes, setNotes] = useState('');

  // Truck Expense Form
  const [expenseCategory, setExpenseCategory] = useState('Fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => getLocalPakistanDate());
  const [expenseDesc, setExpenseDesc] = useState('');

  // Count Birds Form
  const [recvDate, setRecvDate] = useState(() => getLocalPakistanDate());
  const [receivedPieces, setReceivedPieces] = useState('');
  const [deadPieces, setDeadPieces] = useState('0');
  const [damagedPieces, setDamagedPieces] = useState('0');
  const [receivingNotes, setReceivingNotes] = useState('');

  // Rate & Profit Checker
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [proposedPrice, setProposedPrice] = useState<string>('1850');

  // Stock Adjustment Modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustBatchId, setAdjustBatchId] = useState<string>('');
  const [quantityChange, setQuantityChange] = useState<string>('-5');
  const [adjustReason, setAdjustReason] = useState<string>('');

  const { isSubmitting: isSavingLoad, runOptimistic: runSaveLoad } = useThrottledSubmit();
  const { isSubmitting: isAddingExpense, runOptimistic: runAddExpense } = useThrottledSubmit();
  const { isSubmitting: isDeletingExpense, runOptimistic: runDeleteExpense } = useThrottledSubmit();
  const { isSubmitting: isReceivingStock, runOptimistic: runReceiveStock } = useThrottledSubmit();
  const { isSubmitting: isAdjusting, runOptimistic: runAdjust } = useThrottledSubmit();

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (initialOpenNewModal) {
      setPurchaseDate(getLocalPakistanDate());
      setIsNewLoadOpen(true);
    }
  }, [initialOpenNewModal]);

  useEffect(() => {
    if (suppliersList.length > 0 && !supplierId) {
      setSupplierId(String(suppliersList[0].id));
    }
  }, [suppliersList, supplierId]);

  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      const firstActive = batches.find((b) => !b.isClosed) || batches[0];
      setSelectedBatchId(String(firstActive.id));
    }
  }, [batches, selectedBatchId]);

  const loadDetails = useMemo(
    () =>
      selectedLoadId
        ? loads.find((l) => l.id === selectedLoadId || l.id === resolvedIdMap[selectedLoadId]) ||
          null
        : null,
    [loads, selectedLoadId, resolvedIdMap]
  );

  const selectedBatch = useMemo(
    () => batches.find((b) => String(b.id) === selectedBatchId) || batches[0] || null,
    [batches, selectedBatchId]
  );

  // Handlers
  const handleCreateLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    const supId = parseInt(supplierId, 10);
    const weight = parseFloat(totalWeightKg);
    const amt = parseFloat(purchaseAmount);

    if (
      !supplierId ||
      !Number.isFinite(supId) ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !Number.isFinite(amt) ||
      amt <= 0
    ) {
      onShowToast('Please fill all required fields with valid numbers', 'error');
      return;
    }

    await runSaveLoad((onOptimistic) =>
      createPurchase(
        {
          supplierId: supId,
          purchaseDate,
          totalWeightKg: weight,
          purchaseAmount: amt,
          vehicleNumber: vehicleNumber || undefined,
          driverName: driverName || undefined,
          notes: notes || undefined,
        },
        {
          onOptimistic: () => {
            setIsNewLoadOpen(false);
            setTotalWeightKg('');
            setPurchaseAmount('');
            setVehicleNumber('');
            setDriverName('');
            setNotes('');
            setActiveTab('trucks');
            onOptimistic();
          },
        }
      )
    );
  };

  const handleAddLoadExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expenseAmount);
    const activeLoadId = loadDetails?.id ?? selectedLoadId;
    if (!activeLoadId || !Number.isFinite(amt) || amt <= 0) {
      onShowToast('Please enter a valid expense amount', 'error');
      return;
    }

    const desc = expenseDesc;

    await runAddExpense((onOptimistic) =>
      addLoadExpense(
        activeLoadId,
        {
          category: expenseCategory,
          amount: amt,
          expenseDate,
          description: desc || undefined,
        },
        {
          onOptimistic: () => {
            setExpenseAmount('');
            setExpenseDesc('');
            onOptimistic();
          },
        }
      )
    );
  };

  const handleDeleteExpense = async (expenseId: number) => {
    const activeLoadId = loadDetails?.id ?? selectedLoadId;
    if (!activeLoadId || isDeletingExpense) return;
    if (confirmDeleteExpId !== expenseId) {
      setConfirmDeleteExpId(expenseId);
      return;
    }
    await runDeleteExpense((onOptimistic) =>
      deleteLoadExpense(activeLoadId, expenseId, {
        onOptimistic: () => {
          setConfirmDeleteExpId(null);
          onOptimistic();
        },
      })
    );
  };

  const openReceivingForm = (load: PurchaseLoad) => {
    setReceivingLoad(load);
    setRecvDate(getLocalPakistanDate());
    setReceivedPieces('');
    setDeadPieces('0');
    setDamagedPieces('0');
    setReceivingNotes('');
    setIsReceivingOpen(true);
  };

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingLoad) return;
    const pieces = parseInt(receivedPieces, 10);
    if (isNaN(pieces) || pieces <= 0) {
      onShowToast('Please enter the number of birds unloaded', 'error');
      return;
    }

    const targetId = receivingLoad.id;
    await runReceiveStock((onOptimistic) =>
      receiveStock(
        targetId,
        {
          receivingDate: recvDate,
          receivedPieces: pieces,
          deadPieces: parseInt(deadPieces || '0', 10),
          damagedPieces: parseInt(damagedPieces || '0', 10),
          notes: receivingNotes || undefined,
        },
        {
          onOptimistic: () => {
            setIsReceivingOpen(false);
            setReceivingLoad(null);
            onOptimistic();
          },
        }
      )
    );
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantityChange, 10);
    if (!adjustBatchId || isNaN(qty) || qty === 0) {
      onShowToast('Please pick a stock lot and enter a valid count change', 'error');
      return;
    }

    const reason = adjustReason || 'Manual stock count update';

    await runAdjust((onOptimistic) =>
      adjustStock(
        {
          stockBatchId: parseInt(adjustBatchId, 10),
          quantityChange: qty,
          reason,
          adjustmentType: qty < 0 ? 'DAMAGE' : 'ADJUSTMENT',
        },
        {
          onOptimistic: () => {
            setIsAdjustOpen(false);
            setQuantityChange('-5');
            setAdjustReason('');
            onOptimistic();
          },
        }
      )
    );
  };

  // Filtered Datasets
  const filteredLoads = useMemo(() => {
    return loads.filter((load) => {
      const q = truckSearch.toLowerCase();
      const matchesSearch =
        !q ||
        load.loadNumber.toLowerCase().includes(q) ||
        load.supplierName.toLowerCase().includes(q) ||
        (load.vehicleNumber && load.vehicleNumber.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'ALL' || load.status === statusFilter;
      const matchesSup = supplierFilter === 'ALL' || String(load.supplierId) === supplierFilter;
      return matchesSearch && matchesStatus && matchesSup;
    });
  }, [loads, truckSearch, statusFilter, supplierFilter]);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const q = lotSearch.toLowerCase();
      const matchesSearch =
        !q ||
        b.batchNumber.toLowerCase().includes(q) ||
        (b.supplierName && b.supplierName.toLowerCase().includes(q));
      const matchesStatus =
        batchStatusFilter === 'ALL' ||
        (batchStatusFilter === 'ACTIVE' && !b.isClosed) ||
        (batchStatusFilter === 'DEPLETED' && b.isClosed);
      return matchesSearch && matchesStatus;
    });
  }, [batches, lotSearch, batchStatusFilter]);

  const filteredMovements = useMemo(() => {
    return movements.filter(
      (m) => movementTypeFilter === 'ALL' || m.movementType === movementTypeFilter
    );
  }, [movements, movementTypeFilter]);

  // KPI Metrics
  const activeBatchesCount = useMemo(
    () => batches.filter((b) => !b.isClosed).length,
    [batches]
  );
  const totalStockPieces = useMemo(
    () =>
      batches
        .filter((b) => !b.isClosed)
        .reduce((sum, b) => sum + Number(b.remainingPieces || 0), 0),
    [batches]
  );
  const totalStockValue = useMemo(
    () =>
      batches
        .filter((b) => !b.isClosed)
        .reduce((sum, b) => sum + Number(b.remainingPieces || 0) * Number(b.costPerPiece || 0), 0),
    [batches]
  );
  const pendingLoadsCount = useMemo(
    () => loads.filter((l) => l.status !== 'RECEIVED').length,
    [loads]
  );

  // Options
  const supplierOptions = useMemo(
    () =>
      suppliersList.map((sup) => ({
        value: String(sup.id),
        label: sup.name,
        sublabel: sup.phone || undefined,
      })),
    [suppliersList]
  );

  const batchOptions = useMemo(
    () =>
      batches.map((b) => ({
        value: String(b.id),
        label: b.batchNumber,
        sublabel: `${b.remainingPieces} left @ ${formatPKR(b.costPerPiece)}/bird`,
      })),
    [batches]
  );

  const activeBatchOptions = useMemo(
    () =>
      batches
        .filter((b) => !b.isClosed)
        .map((b) => ({
          value: String(b.id),
          label: b.batchNumber,
          sublabel: `${b.remainingPieces} birds available`,
        })),
    [batches]
  );

  // Rate Checker calculations
  const lowThreshold = Number(settings.lowStockThreshold || 300);
  const examplePrice1 = Number(settings.examplePrice1 || 1200);
  const examplePrice2 = Number(settings.examplePrice2 || 1500);
  const calcCost = selectedBatch ? Number(selectedBatch.costPerPiece) : 0;
  const calcSellingPrice = parseFloat(proposedPrice) || 0;
  const analysis = getCostAnalysisStatus(calcSellingPrice, calcCost);
  const analysisEx1 = getCostAnalysisStatus(examplePrice1, calcCost);
  const analysisEx2 = getCostAnalysisStatus(examplePrice2, calcCost);

  const liveRatePerKg =
    parseFloat(totalWeightKg) > 0 && parseFloat(purchaseAmount) > 0
      ? calculatePurchaseRate(parseFloat(purchaseAmount), parseFloat(totalWeightKg))
      : 0;
  const liveReceived = parseInt(receivedPieces || '0', 10);
  const liveDead = parseInt(deadPieces || '0', 10);
  const liveDamaged = parseInt(damagedPieces || '0', 10);
  const liveSaleable = calculateSaleablePieces(liveReceived, liveDead, liveDamaged);

  // Columns
  const truckColumns: DataTableColumn<PurchaseLoad>[] = [
    {
      key: 'loadNumber',
      header: 'Load #',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (load) => (
        <span className="font-normal tabular-nums text-[#7B848F] dark:text-[#8A929C]">
          {load.loadNumber}
        </span>
      ),
    },
    {
      key: 'supplierName',
      header: 'Supplier & Truck',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (load) => (
        <div>
          <div className="font-normal text-[#636B76] dark:text-[#A3AAB3]">{load.supplierName}</div>
          {load.vehicleNumber && (
            <div className="text-[10px] text-[#7B848F] dark:text-[#8A929C]">
              {load.vehicleNumber} {load.driverName ? `(${load.driverName})` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'purchaseDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (load) => (
        <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">
          {formatDate(load.purchaseDate)}
        </span>
      ),
    },
    {
      key: 'totalWeightKg',
      header: 'Weight',
      align: 'right',
      sortable: true,
      sortValue: (l) => Number(l.totalWeightKg),
      render: (load) => (
        <span className="font-normal tabular-nums text-[#636B76] dark:text-[#A3AAB3]">
          {formatNumber(load.totalWeightKg)} KG
        </span>
      ),
    },
    {
      key: 'purchaseRatePerKg',
      header: 'Price / KG',
      align: 'right',
      sortable: true,
      defaultVisible: false,
      sortValue: (l) => Number(l.purchaseRatePerKg),
      render: (load) => (
        <span className="font-normal tabular-nums text-[#7B848F] dark:text-[#8A929C]">
          {formatPKR(load.purchaseRatePerKg)}
        </span>
      ),
    },
    {
      key: 'purchaseAmount',
      header: 'Bird Bill',
      align: 'right',
      sortable: true,
      defaultVisible: false,
      sortValue: (l) => Number(l.purchaseAmount),
      render: (load) => (
        <span className="font-normal tabular-nums">{formatPKR(load.purchaseAmount)}</span>
      ),
    },
    {
      key: 'totalExpenses',
      header: 'Truck Costs',
      align: 'right',
      sortable: true,
      defaultVisible: false,
      sortValue: (l) => Number(l.totalExpenses || 0),
      render: (load) => (
        <span className="font-normal tabular-nums text-[#7B848F] dark:text-[#8A929C]">
          {formatPKR(load.totalExpenses || 0)}
        </span>
      ),
    },
    {
      key: 'totalLandedCost',
      header: 'Total Cost',
      align: 'right',
      sortable: true,
      sortValue: (l) => Number(l.totalLandedCost || l.purchaseAmount),
      render: (load) => (
        <span className="font-normal tabular-nums text-[#636B76] dark:text-[#A3AAB3]">
          {formatPKR(load.totalLandedCost || load.purchaseAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      sortable: true,
      hideOnMobileDefault: true,
      render: (load) => (
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-normal tracking-wider whitespace-nowrap ${
            load.status === 'RECEIVED'
              ? 'bg-[#92E2B3]/25 text-emerald-800 dark:text-[#92E2B3] border border-[#92E2B3]/40'
              : 'bg-[#F6E7A1]/35 text-amber-900 dark:text-[#F6E7A1] border border-[#F6E7A1]/50'
          }`}
        >
          {load.status === 'RECEIVED' ? 'IN STOCK' : 'COUNT BIRDS'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      alwaysVisible: true,
      render: (load) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap min-w-[186px]">
          {load.status !== 'RECEIVED' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openReceivingForm(load);
              }}
              className="px-3 py-1.5 text-[11px] font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs cursor-pointer"
            >
              Count Birds
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedLoadId(load.id);
              setConfirmDeleteExpId(null);
            }}
            className="px-3 py-1.5 text-[11px] font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition cursor-pointer"
          >
            Costs & Info
          </button>
          <ConfirmDeleteButton
            compactSlot
            ariaLabel={`Delete truck load ${load.loadNumber}`}
            onConfirm={() => deletePurchase(load.id)}
          />
        </div>
      ),
    },
  ];

  const batchColumns: DataTableColumn<StockBatch>[] = [
    {
      key: 'batchNumber',
      header: 'Lot #',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (b) => (
        <span className="font-normal tabular-nums text-[#7B848F] dark:text-[#8A929C]">
          {b.batchNumber}
        </span>
      ),
    },
    {
      key: 'receivingDate',
      header: 'Arrival Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (b) => (
        <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">
          {formatDate(b.receivingDate)}
        </span>
      ),
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      sortable: true,
      hideOnMobileDefault: true,
      render: (b) => (
        <div>
          <div className="font-normal text-[#636B76] dark:text-[#A3AAB3]">{b.supplierName}</div>
          <div className="text-[10px] text-[#7B848F] dark:text-[#8A929C]">{b.loadNumber}</div>
        </div>
      ),
    },
    {
      key: 'receivedPieces',
      header: 'Arrived / Dead',
      align: 'right',
      defaultVisible: false,
      sortable: true,
      sortValue: (b) => b.receivedPieces,
      render: (b) => (
        <span className="font-normal tabular-nums">
          {b.receivedPieces} / <span className="text-rose-500">{b.deadPieces}</span> /{' '}
          <span className="text-amber-500">{b.damagedPieces}</span>
        </span>
      ),
    },
    {
      key: 'originalSaleablePieces',
      header: 'Healthy Total',
      align: 'right',
      defaultVisible: false,
      sortable: true,
      render: (b) => (
        <span className="font-normal tabular-nums">{formatNumber(b.originalSaleablePieces)}</span>
      ),
    },
    {
      key: 'soldPieces',
      header: 'Sold',
      align: 'right',
      sortable: true,
      render: (b) => <span className="font-normal tabular-nums">{formatNumber(b.soldPieces)}</span>,
    },
    {
      key: 'remainingPieces',
      header: 'Birds Left',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (b) => (
        <span className="font-normal tabular-nums text-[#636B76] dark:text-[#A3AAB3]">
          {formatNumber(b.remainingPieces)}
        </span>
      ),
    },
    {
      key: 'costPerPiece',
      header: 'Cost / Bird',
      align: 'right',
      sortable: true,
      sortValue: (b) => Number(b.costPerPiece),
      render: (b) => (
        <span className="font-normal tabular-nums text-[#2FB67C]">
          {formatPKR(b.costPerPiece)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      sortable: true,
      sortValue: (b) => (b.isClosed ? 0 : b.remainingPieces),
      render: (b) => (
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-normal whitespace-nowrap ${
            b.isClosed
              ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#7B848F]'
              : b.remainingPieces <= lowThreshold
              ? 'bg-[#F6E7A1]/40 text-amber-900 dark:text-[#F6E7A1]'
              : 'bg-[#92E2B3]/25 text-emerald-800 dark:text-[#92E2B3]'
          }`}
        >
          {b.isClosed ? 'Finished' : b.remainingPieces <= lowThreshold ? 'Low Stock' : 'Selling Now'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      alwaysVisible: true,
      render: (b) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => {
              setSelectedBatchId(String(b.id));
              setActiveTab('calculator');
            }}
            className="px-3 py-1.5 text-[11px] font-medium rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] cursor-pointer whitespace-nowrap"
          >
            Check Profit
          </button>
          <ConfirmDeleteButton
            ariaLabel={`Delete stock lot ${b.batchNumber}`}
            onConfirm={() => deleteBatch(b.id)}
          />
        </div>
      ),
    },
  ];

  const movementColumns: DataTableColumn<StockMovement>[] = [
    {
      key: 'createdAt',
      header: 'Date & Time',
      sortable: true,
      hideOnMobileDefault: true,
      render: (m) => (
        <span className="font-normal text-[11px] text-[#7B848F] dark:text-[#8A929C]">
          {formatDateTime(m.createdAt)}
        </span>
      ),
    },
    {
      key: 'batchNumber',
      header: 'Lot #',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (m) => (
        <span className="font-normal tabular-nums text-[#7B848F] dark:text-[#8A929C]">
          {m.batchNumber}
        </span>
      ),
    },
    {
      key: 'movementType',
      header: 'Action',
      sortable: true,
      render: (m) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-normal whitespace-nowrap ${
            m.movementType === 'STOCK_IN'
              ? 'bg-[#92E2B3]/30 text-emerald-800 dark:text-[#92E2B3]'
              : m.movementType === 'SALE_OUT'
              ? 'bg-[#A9C8FA]/40 text-blue-900 dark:text-[#A9C8FA]'
              : m.movementType === 'WHOLESALE_OUT'
              ? 'bg-[#C9C3F5]/40 text-purple-900 dark:text-[#C9C3F5]'
              : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
          }`}
        >
          {m.movementType === 'STOCK_IN'
            ? 'Truck Arrival'
            : m.movementType === 'SALE_OUT'
            ? 'Walk-in Shop'
            : m.movementType === 'WHOLESALE_OUT'
            ? 'Other Shop'
            : 'Count Fix'}
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Birds',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (m) => (
        <span
          className={`font-normal tabular-nums ${
            m.quantity > 0 ? 'text-[#2FB67C]' : 'text-rose-500'
          }`}
        >
          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Left in Lot',
      align: 'right',
      sortable: true,
      render: (m) => <span className="font-normal tabular-nums">{m.balanceAfter} birds</span>,
    },
    {
      key: 'unitCost',
      header: 'Cost / Bird',
      align: 'right',
      defaultVisible: false,
      sortable: true,
      sortValue: (m) => Number(m.unitCost),
      render: (m) => <span className="font-normal tabular-nums">{formatPKR(m.unitCost)}</span>,
    },
    {
      key: 'notes',
      header: 'Details',
      defaultVisible: false,
      render: (m) => (
        <span className="text-[#636B76] dark:text-[#8A929C] truncate max-w-[240px] block">
          {m.notes || m.referenceType || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Remove',
      align: 'right',
      alwaysVisible: true,
      render: (m) => (
        <ConfirmDeleteButton
          ariaLabel={`Delete stock movement ${m.batchNumber}`}
          onConfirm={() => deleteMovement(m.id)}
        />
      ),
    },
  ];

  const subTabs: Array<{
    id: TrucksStockSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    {
      id: 'trucks',
      label: 'Truck Arrivals',
      icon: Truck,
      badge: pendingLoadsCount > 0 ? pendingLoadsCount : undefined,
    },
    { id: 'lots', label: 'Stock Lots', icon: Boxes },
    { id: 'calculator', label: 'Rate & Profit Checker', icon: Calculator },
    { id: 'movements', label: 'Stock History', icon: History },
  ];

  const inputCls =
    'w-full min-w-0 max-w-full block min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';
  const labelCls = 'block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] mb-1.5';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Trucks & Bird Stock
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Buy chicken trucks, count healthy birds into stock, and check selling prices in one place
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 w-full xl:w-auto xl:ml-auto">
          <button
            type="button"
            onClick={() => {
              const firstActive = batches.find((b) => !b.isClosed);
              if (firstActive) setAdjustBatchId(String(firstActive.id));
              setIsAdjustOpen(true);
            }}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            Update Bird Count
          </button>
          <button
            type="button"
            onClick={() => {
              setPurchaseDate(getLocalPakistanDate());
              setIsNewLoadOpen(true);
            }}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Truck Purchase
          </button>
        </div>
      </div>

      {/* Unified KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('lots')}
          className="text-left rounded-[20px] p-4 sm:p-5 bg-[#A9C8FA] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[132px] transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Birds in Stock
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-32 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none font-mono tabular-nums">
                {formatNumber(totalStockPieces)} {totalStockPieces === 1 ? 'bird' : 'birds'}
              </div>
            )}
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              In {activeBatchesCount} active {activeBatchesCount === 1 ? 'lot' : 'lots'} (oldest sold first)
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className="text-left rounded-[20px] p-4 sm:p-5 bg-[#92E2B3] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[132px] transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Total Stock Worth
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-36 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none font-mono tabular-nums">
                {formatPKR(totalStockValue)}
              </div>
            )}
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              Purchase + truck cost of remaining birds
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('trucks');
            setStatusFilter(pendingLoadsCount > 0 ? 'PENDING_RECEIVING' : 'ALL');
          }}
          className="text-left rounded-[20px] p-4 sm:p-5 bg-[#C9C3F5] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[132px] transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Truck Arrivals
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-28 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none font-mono tabular-nums">
                {loads.length} {loads.length === 1 ? 'truck' : 'trucks'}
              </div>
            )}
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              {pendingLoadsCount > 0
                ? `${pendingLoadsCount} waiting for bird count`
                : 'All trucks counted into stock'}
            </p>
          </div>
        </button>
      </div>

      {/* Sub-navigation: Mobile vertical card, sm+ pill bar */}
      <div className="sm:hidden bg-white dark:bg-[#181B1F] rounded-[18px] border border-[#E3E6E8] dark:border-[#2A2F35] divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] overflow-hidden shadow-xs">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-4 py-3 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                active
                  ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
                  : 'text-[#4A515B] dark:text-[#A3AAB3]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#D4F56B] text-[#14161A] text-[10px] font-black leading-none">
                    {tab.badge}
                  </span>
                )}
              </span>
              {active && <Check className="w-3.5 h-3.5 text-[#14161A] dark:text-[#D4F56B]" />}
            </button>
          );
        })}
      </div>

      <div className="hidden sm:inline-flex items-center gap-0.5 bg-white dark:bg-[#181B1F] p-1 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] w-fit shadow-xs">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 text-xs font-semibold rounded-full transition-colors focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'text-[#14161A] dark:text-[#F2F4F5]'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="trucksStockTabPill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] z-0"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#D4F56B] text-[#14161A] text-[10px] font-black font-mono leading-none">
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TRUCK ARRIVALS */}
      {activeTab === 'trucks' && (
        <DataTable
          tableId="purchases"
          paginationEndpoint="/api/purchases"
          paginationParams={{
            ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
            ...(supplierFilter !== 'ALL' ? { supplierId: supplierFilter } : {}),
          }}
          data={filteredLoads}
          columns={truckColumns}
          keyExtractor={(l) => l.id}
          loading={isInitialLoading}
          searchValue={truckSearch}
          onSearchChange={setTruckSearch}
          searchPlaceholder="Search load #, supplier, truck..."
          emptyMessage="No truck purchases yet. Click 'New Truck Purchase' to add one."
          defaultSortKey="purchaseDate"
          defaultSortDir="desc"
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: 'ALL', label: 'All Trucks' },
                { value: 'PENDING_RECEIVING', label: 'Waiting for Count' },
                { value: 'RECEIVED', label: 'In Stock' },
              ],
            },
            {
              key: 'supplier',
              label: 'Supplier',
              value: supplierFilter,
              onChange: setSupplierFilter,
              options: [{ value: 'ALL', label: 'All Suppliers' }, ...supplierOptions],
            },
          ]}
          mobileCardTitle={(l) => l.loadNumber}
          mobileCardSubtitle={(l) => `${l.supplierName} · ${formatDate(l.purchaseDate)}`}
          mobileCardBadge={(l) => (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                l.status === 'RECEIVED'
                  ? 'bg-[#92E2B3]/30 text-emerald-800 dark:text-[#92E2B3]'
                  : 'bg-[#F6E7A1]/40 text-amber-900 dark:text-[#F6E7A1]'
              }`}
            >
              {l.status === 'RECEIVED' ? 'IN STOCK' : 'COUNT BIRDS'}
            </span>
          )}
        />
      )}

      {/* TAB 2: STOCK LOTS */}
      {activeTab === 'lots' && (
        <DataTable
          tableId="inventory-batches"
          paginationEndpoint="/api/inventory/batches"
          paginationParams={{
            ...(batchStatusFilter !== 'ALL' ? { status: batchStatusFilter } : {}),
          }}
          data={filteredBatches}
          columns={batchColumns}
          keyExtractor={(b) => b.id}
          loading={isInitialLoading}
          searchValue={lotSearch}
          onSearchChange={setLotSearch}
          searchPlaceholder="Search lot # or supplier..."
          emptyMessage="No stock lots available yet."
          defaultSortKey="receivingDate"
          defaultSortDir="asc"
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: batchStatusFilter,
              onChange: setBatchStatusFilter,
              options: [
                { value: 'ALL', label: 'All Lots' },
                { value: 'ACTIVE', label: 'In Stock Now' },
                { value: 'DEPLETED', label: 'Finished' },
              ],
            },
          ]}
          mobileCardTitle={(b) => b.batchNumber}
          mobileCardSubtitle={(b) => `${b.supplierName || ''} · ${formatDate(b.receivingDate)}`}
          mobileCardBadge={(b) => (
            <span className="font-mono font-black text-xs text-[#2FB67C]">
              {b.remainingPieces} left
            </span>
          )}
        />
      )}

      {/* TAB 3: RATE & PROFIT CHECKER */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider">1. Pick a Stock Lot</h3>
            <Select
              value={selectedBatchId}
              onChange={setSelectedBatchId}
              options={batchOptions}
              placeholder="Choose stock lot"
              searchable
            />

            {selectedBatch && (
              <div className="bg-[#F8F9FA] dark:bg-[#20242A] p-4 rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Bird Bill:</span>
                  <span className="font-mono font-medium">
                    {formatPKR(selectedBatch.purchaseAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Truck Costs:</span>
                  <span className="font-mono font-medium">
                    {formatPKR(selectedBatch.totalLoadExpenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#E3E6E8] dark:border-[#2A2F35] pt-2">
                  <span className="font-semibold">Total Paid:</span>
                  <span className="font-mono font-bold">
                    {formatPKR(selectedBatch.totalLandedCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Healthy Birds:</span>
                  <span className="font-mono font-medium">
                    {selectedBatch.originalSaleablePieces} birds
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#E3E6E8] dark:border-[#2A2F35] pt-2.5 bg-[#92E2B3]/20 -mx-4 -mb-4 p-4 rounded-b-[16px]">
                  <span className="font-bold text-emerald-950 dark:text-[#92E2B3]">
                    Cost Per Bird:
                  </span>
                  <span className="font-mono font-black text-emerald-800 dark:text-[#92E2B3] text-sm">
                    {formatPKR(selectedBatch.costPerPiece)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider">2. Test a Selling Price</h3>
            <div>
              <label className="block text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3] mb-1.5">
                Selling Price Per Bird (PKR)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  className={`${inputCls} text-sm font-bold font-mono pr-12`}
                />
                <span className="absolute right-4 top-3 text-xs text-[#636B76] font-bold">PKR</span>
              </div>
            </div>

            <div
              className={`p-4 rounded-[16px] border text-center ${
                analysis.status === 'PROFITABLE'
                  ? 'bg-[#92E2B3]/20 border-[#92E2B3]/40 text-emerald-950 dark:text-[#92E2B3]'
                  : analysis.status === 'AT_COST'
                  ? 'bg-[#F6E7A1]/30 border-[#F6E7A1]/50 text-amber-950 dark:text-[#F6E7A1]'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-950 dark:text-rose-300'
              }`}
            >
              <div className="text-lg font-black tracking-tight">
                {analysis.status === 'PROFITABLE' && 'GOOD PROFIT'}
                {analysis.status === 'AT_COST' && 'NO PROFIT'}
                {analysis.status === 'BELOW_COST' && 'LOSS WARNING'}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-current/20 pt-3">
                <div>
                  <div className="text-[10px] opacity-75">Profit / Bird</div>
                  <div className="font-bold font-mono text-sm">
                    {formatPKR(analysis.profitPerPiece)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] opacity-75">Profit %</div>
                  <div className="font-bold font-mono text-sm">{analysis.marginPercent}%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider">3. Quick Price Checks</h3>
            <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
              Saved test prices from Settings
            </p>

            {[
              { price: examplePrice1, res: analysisEx1 },
              { price: examplePrice2, res: analysisEx2 },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F8F9FA] dark:bg-[#20242A] space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">At {formatPKR(item.price)} / bird:</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.res.status === 'PROFITABLE'
                        ? 'bg-[#92E2B3]/30 text-emerald-800 dark:text-[#92E2B3]'
                        : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {item.res.status === 'PROFITABLE' ? 'PROFIT' : 'LOSS'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-[#4A515B] dark:text-[#A3AAB3]">
                  <span>Profit per bird:</span>
                  <span className="font-mono font-bold text-[#14161A] dark:text-white">
                    {formatPKR(item.res.profitPerPiece)} ({item.res.marginPercent}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STOCK HISTORY */}
      {activeTab === 'movements' && (
        <DataTable
          tableId="inventory-movements"
          paginationEndpoint="/api/inventory/movements"
          paginationParams={{
            ...(movementTypeFilter !== 'ALL' ? { type: movementTypeFilter } : {}),
          }}
          title="Stock History"
          subtitle="Every truck arrival, walk-in sale, other shop delivery, and count fix"
          data={filteredMovements}
          columns={movementColumns}
          keyExtractor={(m) => m.id}
          loading={isInitialLoading}
          searchPlaceholder="Search lot # or note..."
          defaultSortKey="createdAt"
          defaultSortDir="desc"
          filters={[
            {
              key: 'type',
              label: 'Action Type',
              value: movementTypeFilter,
              onChange: setMovementTypeFilter,
              options: [
                { value: 'ALL', label: 'All Actions' },
                { value: 'STOCK_IN', label: 'Truck Arrivals' },
                { value: 'SALE_OUT', label: 'Walk-in Shop Sales' },
                { value: 'WHOLESALE_OUT', label: 'Other Shop Deliveries' },
                { value: 'DAMAGE', label: 'Dead / Damaged' },
                { value: 'ADJUSTMENT', label: 'Manual Count Fixes' },
              ],
            },
          ]}
          mobileCardTitle={(m) => m.batchNumber}
          mobileCardSubtitle={(m) => `${formatDateTime(m.createdAt)} · ${m.notes || m.movementType}`}
          mobileCardBadge={(m) => (
            <span
              className={`font-mono font-bold text-xs ${
                m.quantity > 0 ? 'text-[#2FB67C]' : 'text-rose-500'
              }`}
            >
              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
            </span>
          )}
        />
      )}

      {/* MODAL 1: NEW TRUCK PURCHASE */}
      <Modal
        isOpen={isNewLoadOpen}
        onClose={() => setIsNewLoadOpen(false)}
        title="Add New Truck Purchase"
        subtitle="Record total chicken weight and supplier bill in PKR"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLoad} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className={labelCls}>Supplier (Farm Dealer) *</label>
              <Select
                value={supplierId}
                onChange={setSupplierId}
                options={supplierOptions}
                placeholder="Choose supplier"
                searchable
              />
            </div>

            <div className="min-w-0">
              <label className={labelCls}>Purchase Date *</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className={labelCls}>Total Weight (KG) *</label>
              <div className="relative min-w-0">
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 4500"
                  value={totalWeightKg}
                  onChange={(e) => setTotalWeightKg(e.target.value)}
                  required
                  className={`${inputCls} font-mono pr-10`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-[#636B76] font-bold pointer-events-none">
                  KG
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <label className={labelCls}>Supplier Bill Amount (PKR) *</label>
              <div className="relative min-w-0">
                <input
                  type="number"
                  step="1"
                  placeholder="e.g. 1350000"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  required
                  className={`${inputCls} font-mono pr-12`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-[#636B76] font-bold pointer-events-none">
                  PKR
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-[#F8F9FA] dark:bg-[#20242A] rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between gap-2">
            <span className="text-xs text-[#636B76] dark:text-[#8A929C] font-semibold">
              Price per KG:
            </span>
            <span className="text-sm font-black text-[#2FB67C] font-mono">
              {liveRatePerKg > 0 ? `${formatPKR(liveRatePerKg)} / KG` : 'Enter weight & bill'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className={labelCls}>Truck Number</label>
              <input
                type="text"
                placeholder="e.g. LES-4921"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className={`${inputCls} uppercase font-mono`}
              />
            </div>

            <div className="min-w-0">
              <label className={labelCls}>Driver Name</label>
              <input
                type="text"
                placeholder="e.g. Muhammad Aslam"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Heavy broiler birds from Gujranwala"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isSavingLoad}
              onClick={() => setIsNewLoadOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingLoad}
              aria-busy={isSavingLoad}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingLoad ? 'Saving...' : 'Save Truck Purchase'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: COUNT BIRDS INTO STOCK */}
      <Modal
        isOpen={isReceivingOpen}
        onClose={() => setIsReceivingOpen(false)}
        title={`Count Birds: ${receivingLoad?.loadNumber || ''}`}
        subtitle="Enter total birds unloaded and any dead or weak birds"
        maxWidth="md"
      >
        <form onSubmit={handleReceiveStock} className="space-y-4">
          <div className="p-3.5 bg-[#F8F9FA] dark:bg-[#20242A] rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[#636B76] dark:text-[#8A929C]">Supplier:</span>
              <span className="font-bold">{receivingLoad?.supplierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#636B76] dark:text-[#8A929C]">Truck Weight:</span>
              <span className="font-mono font-semibold">
                {receivingLoad ? formatNumber(receivingLoad.totalWeightKg) : 0} KG
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#636B76] dark:text-[#8A929C]">Total Cost So Far:</span>
              <span className="font-mono font-bold text-[#2FB67C]">
                {receivingLoad
                  ? formatPKR(receivingLoad.totalLandedCost || receivingLoad.purchaseAmount)
                  : 0}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <label className={labelCls}>Arrival Date *</label>
            <input
              type="date"
              value={recvDate}
              onChange={(e) => setRecvDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div className="min-w-0">
            <label className={labelCls}>Total Birds Counted *</label>
            <input
              type="number"
              placeholder="e.g. 900"
              value={receivedPieces}
              onChange={(e) => setReceivedPieces(e.target.value)}
              required
              min="1"
              className={`${inputCls} font-mono font-bold`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className={labelCls}>Dead Birds</label>
              <input
                type="number"
                value={deadPieces}
                onChange={(e) => setDeadPieces(e.target.value)}
                min="0"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div className="min-w-0">
              <label className={labelCls}>Damaged / Weak</label>
              <input
                type="number"
                value={damagedPieces}
                onChange={(e) => setDamagedPieces(e.target.value)}
                min="0"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div className="p-3.5 bg-[#92E2B3]/20 border border-[#92E2B3]/40 rounded-[14px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 dark:text-[#92E2B3]">
                Healthy Birds Ready to Sell:
              </span>
              <span className="text-base font-black text-emerald-800 dark:text-[#92E2B3] font-mono">
                {liveSaleable} birds
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-[#92E2B3]/80 mt-0.5">
              {liveReceived} total - {liveDead} dead - {liveDamaged} damaged
            </p>
          </div>

          <div>
            <label className={labelCls}>Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Healthy flock, ~2.1 KG average"
              value={receivingNotes}
              onChange={(e) => setReceivingNotes(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isReceivingStock}
              onClick={() => setIsReceivingOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isReceivingStock || liveSaleable <= 0}
              aria-busy={isReceivingStock}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isReceivingStock ? 'Saving...' : 'Add Birds to Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: LOAD DETAILS & TRANSIT EXPENSES */}
      {selectedLoadId && loadDetails && (
        <Modal
          isOpen={Boolean(selectedLoadId)}
          onClose={() => {
            setSelectedLoadId(null);
            setConfirmDeleteExpId(null);
          }}
          title={`Truck Details: ${loadDetails.loadNumber}`}
          subtitle="Supplier bill, truck fuel/driver expenses, and bird cost breakdown"
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8F9FA] dark:bg-[#20242A] p-4 rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35]">
              <div>
                <div className="text-[10px] text-[#636B76] dark:text-[#8A929C] uppercase font-bold">
                  Supplier
                </div>
                <div className="font-bold truncate mt-0.5">{loadDetails.supplierName}</div>
                <div className="text-[11px] text-[#636B76]">{loadDetails.supplierPhone || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#636B76] dark:text-[#8A929C] uppercase font-bold">
                  Weight
                </div>
                <div className="font-bold font-mono mt-0.5">
                  {formatNumber(loadDetails.totalWeightKg)} KG
                </div>
                <div className="text-[11px] text-[#636B76]">
                  @ {formatPKR(loadDetails.purchaseRatePerKg)}/KG
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#636B76] dark:text-[#8A929C] uppercase font-bold">
                  Bird Bill
                </div>
                <div className="font-bold font-mono mt-0.5">
                  {formatPKR(loadDetails.purchaseAmount)}
                </div>
                <div className="text-[11px] text-[#636B76]">
                  {formatDate(loadDetails.purchaseDate)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#636B76] dark:text-[#8A929C] uppercase font-bold">
                  Truck & Driver
                </div>
                <div className="font-bold font-mono mt-0.5">
                  {loadDetails.vehicleNumber || 'No truck #'}
                </div>
                <div className="text-[11px] text-[#636B76]">{loadDetails.driverName || '-'}</div>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-[14px] border flex flex-wrap items-center justify-between gap-2 ${
                loadDetails.stockBatch
                  ? 'bg-[#92E2B3]/20 border-[#92E2B3]/40 text-emerald-950 dark:text-[#92E2B3]'
                  : 'bg-[#F6E7A1]/30 border-[#F6E7A1]/50 text-amber-950 dark:text-[#F6E7A1]'
              }`}
            >
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  {loadDetails.stockBatch ? (
                    <CheckCircle2 className="w-4 h-4 text-[#2FB67C]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  )}
                  {loadDetails.stockBatch
                    ? `In Stock: ${loadDetails.stockBatch.batchNumber}`
                    : 'Birds Not Counted Yet'}
                </div>
                {loadDetails.stockBatch && (
                  <div className="text-[11px] mt-0.5 opacity-90">
                    Unloaded: {loadDetails.stockBatch.receivedPieces} · Dead:{' '}
                    {loadDetails.stockBatch.deadPieces} · Healthy:{' '}
                    <strong>{loadDetails.stockBatch.originalSaleablePieces}</strong> (
                    {loadDetails.stockBatch.remainingPieces} left)
                  </div>
                )}
              </div>

              {!loadDetails.stockBatch && (
                <button
                  type="button"
                  onClick={() => openReceivingForm(loadDetails)}
                  className="px-3.5 py-1.5 bg-[#D4F56B] text-[#14161A] font-bold rounded-full text-xs cursor-pointer"
                >
                  Count Birds Now
                </button>
              )}
            </div>

            <div className="bg-[#F8F9FA] dark:bg-[#20242A] text-[#14161A] dark:text-[#F2F4F5] p-5 rounded-[18px] border border-[#E3E6E8] dark:border-[#2A2F35]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#636B76] dark:text-[#8A929C] tracking-wider">
                    Bird Bill
                  </span>
                  <div className="text-lg font-black text-[#14161A] dark:text-white font-mono mt-0.5">
                    {formatPKR(loadDetails.purchaseAmount)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#636B76] dark:text-[#8A929C] tracking-wider">
                    Truck Costs (+)
                  </span>
                  <div className="text-lg font-black text-[#D9822B] dark:text-[#F6E7A1] font-mono mt-0.5">
                    {formatPKR(loadDetails.totalExpenses || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#636B76] dark:text-[#8A929C] tracking-wider">
                    Total Truck Cost (=)
                  </span>
                  <div className="text-lg font-black text-[#2FB67C] dark:text-[#D4F56B] font-mono mt-0.5">
                    {formatPKR(loadDetails.totalLandedCost || loadDetails.purchaseAmount)}
                  </div>
                </div>
              </div>

              {loadDetails.stockBatch && (
                <div className="mt-3 pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[#636B76] dark:text-[#8A929C]">
                    Final Cost Per Healthy Bird (divided by{' '}
                    {loadDetails.stockBatch.originalSaleablePieces} birds):
                  </span>
                  <span className="text-sm font-black text-[#2FB67C] dark:text-[#D4F56B] font-mono">
                    {formatPKR(loadDetails.stockBatch.costPerPiece)} / bird
                  </span>
                </div>
              )}
            </div>

            <div className="border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[18px]">
              <div className="px-4 py-3 bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35] rounded-t-[17px] flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-[11px]">
                  Fuel, Loading & Driver Expenses
                </span>
                <span className="font-mono font-black text-[#14161A] dark:text-[#D4F56B]">
                  Total: {formatPKR(loadDetails.totalExpenses || 0)}
                </span>
              </div>

              <div className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
                {(loadDetails.expenses || []).length === 0 ? (
                  <div className="py-5 text-center text-[#636B76] dark:text-[#8A929C]">
                    No truck expenses added yet.
                  </div>
                ) : (
                  (loadDetails.expenses || []).map((exp) => (
                    <div
                      key={exp.id}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#F8F9FA] dark:hover:bg-[#20242A]"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#14161A] dark:text-white">
                          {exp.category}{' '}
                          <span className="font-normal text-[#636B76] dark:text-[#8A929C]">
                            · {formatDate(exp.expenseDate)}
                          </span>
                        </div>
                        {exp.description && (
                          <div className="text-[11px] text-[#636B76] dark:text-[#8A929C] truncate">
                            {exp.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold">{formatPKR(exp.amount)}</span>
                        <button
                          type="button"
                          disabled={isDeletingExpense}
                          onClick={() => handleDeleteExpense(exp.id)}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                            confirmDeleteExpId === exp.id
                              ? 'bg-rose-600 text-white'
                              : 'text-[#636B76] hover:text-rose-600'
                          }`}
                        >
                          {confirmDeleteExpId === exp.id ? (
                            'Confirm?'
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={handleAddLoadExpense}
                className="p-3.5 bg-[#F8F9FA] dark:bg-[#20242A] border-t border-[#E3E6E8] dark:border-[#2A2F35] rounded-b-[17px] grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
              >
                <div className="sm:col-span-5 min-w-0">
                  <Select
                    size="sm"
                    placement="up"
                    value={expenseCategory}
                    onChange={setExpenseCategory}
                    options={EXPENSE_CAT_OPTIONS}
                  />
                </div>
                <div className="sm:col-span-3 min-w-0">
                  <input
                    type="number"
                    placeholder="Amount (PKR)"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full min-w-0 max-w-full block min-h-[38px] px-3 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[12px] bg-white dark:bg-[#181B1F] font-mono"
                    required
                    min="1"
                  />
                </div>
                <div className="sm:col-span-4 min-w-0">
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full min-w-0 max-w-full block min-h-[38px] px-2.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[12px] bg-white dark:bg-[#181B1F]"
                  />
                </div>
                <div className="sm:col-span-9 min-w-0">
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="w-full min-w-0 max-w-full block min-h-[38px] px-3 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[12px] bg-white dark:bg-[#181B1F]"
                  />
                </div>
                <div className="sm:col-span-3 min-w-0">
                  <button
                    type="submit"
                    disabled={isAddingExpense}
                    aria-busy={isAddingExpense}
                    className="w-full min-h-[38px] px-3 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  >
                    {isAddingExpense ? 'Adding...' : '+ Add Cost'}
                  </button>
                </div>
              </form>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <ConfirmDeleteButton
                label="Delete Truck"
                ariaLabel={`Delete truck load ${loadDetails.loadNumber}`}
                onConfirm={() => {
                  const id = loadDetails.id;
                  setSelectedLoadId(null);
                  return deletePurchase(id);
                }}
              />
              <button
                type="button"
                onClick={() => setSelectedLoadId(null)}
                className="min-h-[40px] px-5 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: UPDATE STOCK COUNT */}
      <Modal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title="Update Bird Count"
        subtitle="Subtract dead birds or fix a cage recount"
        maxWidth="md"
      >
        <form onSubmit={handleStockAdjustment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">Pick Stock Lot *</label>
            <Select
              value={adjustBatchId}
              onChange={setAdjustBatchId}
              options={activeBatchOptions}
              placeholder="Choose available lot"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Change Amount (+ or -) *</label>
            <input
              type="number"
              placeholder="e.g. -5 for dead birds"
              value={quantityChange}
              onChange={(e) => setQuantityChange(e.target.value)}
              required
              className={`${inputCls} font-mono font-bold`}
            />
            <p className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-1">
              Use a minus sign (e.g. -5) to remove dead or spoiled birds.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Reason *</label>
            <input
              type="text"
              placeholder="e.g. Afternoon heat loss"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isAdjusting}
              onClick={() => setIsAdjustOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdjusting}
              aria-busy={isAdjusting}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isAdjusting ? 'Saving...' : 'Update Count'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

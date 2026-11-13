import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { PurchaseLoad } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { formatPKR, formatNumber, formatDate } from '../utils/formatters.ts';
import {
  calculatePurchaseRate,
  calculateSaleablePieces,
} from '../utils/poultryMath.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

interface PurchasesPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
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

export const PurchasesPage: React.FC<PurchasesPageProps> = ({
  onShowToast,
  initialOpenNewModal = false,
}) => {
  const loads = useAppStore((s) => s.purchases);
  const suppliersList = useAppStore((s) => s.suppliers);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const createPurchase = useAppStore((s) => s.createPurchase);
  const addLoadExpense = useAppStore((s) => s.addLoadExpense);
  const deleteLoadExpense = useAppStore((s) => s.deleteLoadExpense);
  const receiveStock = useAppStore((s) => s.receiveStock);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');

  // Modals
  const [isNewLoadOpen, setIsNewLoadOpen] = useState(initialOpenNewModal);
  const [selectedLoadId, setSelectedLoadId] = useState<number | null>(null);
  const [isReceivingOpen, setIsReceivingOpen] = useState(false);
  const [receivingLoad, setReceivingLoad] = useState<PurchaseLoad | null>(null);
  const [confirmDeleteExpId, setConfirmDeleteExpId] = useState<number | null>(null);

  // Form states for New Load
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => getLocalPakistanDate());
  const [totalWeightKg, setTotalWeightKg] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [notes, setNotes] = useState('');

  // Form states for Add Expense
  const [expenseCategory, setExpenseCategory] = useState('Fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => getLocalPakistanDate());
  const [expenseDesc, setExpenseDesc] = useState('');

  // Form states for Receiving
  const [recvDate, setRecvDate] = useState(() => getLocalPakistanDate());
  const [receivedPieces, setReceivedPieces] = useState('');
  const [deadPieces, setDeadPieces] = useState('0');
  const [damagedPieces, setDamagedPieces] = useState('0');
  const [receivingNotes, setReceivingNotes] = useState('');

  const { isSubmitting: isSavingLoad, run: runSaveLoad } = useThrottledSubmit();
  const { isSubmitting: isAddingExpense, run: runAddExpense } = useThrottledSubmit();
  const { isSubmitting: isDeletingExpense, run: runDeleteExpense } = useThrottledSubmit();
  const { isSubmitting: isReceivingStock, run: runReceiveStock } = useThrottledSubmit();

  useEffect(() => {
    if (suppliersList.length > 0 && !supplierId) {
      setSupplierId(String(suppliersList[0].id));
    }
  }, [suppliersList, supplierId]);

  // Live selected load from Zustand store so details update immediately
  const loadDetails = useMemo(
    () => (selectedLoadId ? loads.find((l) => l.id === selectedLoadId) || null : null),
    [loads, selectedLoadId]
  );

  const handleCreateLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !totalWeightKg || !purchaseAmount) {
      onShowToast('Please fill all required fields', 'error');
      return;
    }

    const supId = parseInt(supplierId, 10);
    const weight = parseFloat(totalWeightKg);
    const amt = parseFloat(purchaseAmount);

    await runSaveLoad(async () => {
      try {
        await createPurchase({
          supplierId: supId,
          purchaseDate,
          totalWeightKg: weight,
          purchaseAmount: amt,
          vehicleNumber: vehicleNumber || undefined,
          driverName: driverName || undefined,
          notes: notes || undefined,
        });
        setIsNewLoadOpen(false);
        setTotalWeightKg('');
        setPurchaseAmount('');
        setVehicleNumber('');
        setDriverName('');
        setNotes('');
      } catch {
        // store rolls back & shows toast
      }
    });
  };

  const handleAddLoadExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoadId || !expenseAmount || parseFloat(expenseAmount) <= 0) {
      onShowToast('Please enter a valid expense amount', 'error');
      return;
    }

    const loadId = selectedLoadId;
    const amt = parseFloat(expenseAmount);
    const desc = expenseDesc;

    await runAddExpense(async () => {
      try {
        await addLoadExpense(loadId, {
          category: expenseCategory,
          amount: amt,
          expenseDate,
          description: desc || undefined,
        });
        setExpenseAmount('');
        setExpenseDesc('');
      } catch {
        // handled by store
      }
    });
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!selectedLoadId || isDeletingExpense) return;
    if (confirmDeleteExpId !== expenseId) {
      setConfirmDeleteExpId(expenseId);
      return;
    }
    const loadId = selectedLoadId;
    await runDeleteExpense(async () => {
      setConfirmDeleteExpId(null);
      try {
        await deleteLoadExpense(loadId, expenseId);
      } catch {
        // handled by store
      }
    });
  };

  const openReceivingForm = (load: PurchaseLoad) => {
    setReceivingLoad(load);
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
    await runReceiveStock(async () => {
      try {
        await receiveStock(targetId, {
          receivingDate: recvDate,
          receivedPieces: pieces,
          deadPieces: parseInt(deadPieces || '0', 10),
          damagedPieces: parseInt(damagedPieces || '0', 10),
          notes: receivingNotes || undefined,
        });
        setIsReceivingOpen(false);
      } catch {
        // handled by store
      }
    });
  };

  const filteredLoads = useMemo(() => {
    return loads.filter((load) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        load.loadNumber.toLowerCase().includes(q) ||
        load.supplierName.toLowerCase().includes(q) ||
        (load.vehicleNumber && load.vehicleNumber.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'ALL' || load.status === statusFilter;
      const matchesSup = supplierFilter === 'ALL' || String(load.supplierId) === supplierFilter;
      return matchesSearch && matchesStatus && matchesSup;
    });
  }, [loads, searchQuery, statusFilter, supplierFilter]);

  const supplierOptions = useMemo(
    () =>
      suppliersList.map((sup) => ({
        value: String(sup.id),
        label: sup.name,
        sublabel: sup.phone || undefined,
      })),
    [suppliersList]
  );

  const columns: DataTableColumn<PurchaseLoad>[] = [
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
        <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">{formatDate(load.purchaseDate)}</span>
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
      render: (load) => <span className="font-normal tabular-nums">{formatPKR(load.purchaseAmount)}</span>,
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
          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-normal tracking-wider ${
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
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
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
        </div>
      ),
    },
  ];

  const liveRatePerKg =
    parseFloat(totalWeightKg) > 0 && parseFloat(purchaseAmount) > 0
      ? calculatePurchaseRate(parseFloat(purchaseAmount), parseFloat(totalWeightKg))
      : 0;

  const liveReceived = parseInt(receivedPieces || '0', 10);
  const liveDead = parseInt(deadPieces || '0', 10);
  const liveDamaged = parseInt(damagedPieces || '0', 10);
  const liveSaleable = calculateSaleablePieces(liveReceived, liveDead, liveDamaged);

  const inputCls =
    'w-full min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';
  const labelCls = 'block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] mb-1.5';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Truck Purchases & Arrivals
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Record chicken trucks from suppliers, add diesel or driver costs, and count birds into stock
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsNewLoadOpen(true)}
          className="w-full sm:w-auto xl:ml-auto min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Truck Purchase
        </button>
      </div>

      <DataTable
        tableId="purchases"
        data={filteredLoads}
        columns={columns}
        keyExtractor={(l) => l.id}
        loading={loading && !initialized}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
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

      {/* MODAL 1: NEW PURCHASE LOAD */}
      <Modal
        isOpen={isNewLoadOpen}
        onClose={() => setIsNewLoadOpen(false)}
        title="Add New Truck Purchase"
        subtitle="Record total chicken weight and supplier bill in PKR"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLoad} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Supplier (Farm Dealer) *</label>
              <Select
                value={supplierId}
                onChange={setSupplierId}
                options={supplierOptions}
                placeholder="Choose supplier"
                searchable
              />
            </div>

            <div>
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
            <div>
              <label className={labelCls}>Total Weight (KG) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 4500"
                  value={totalWeightKg}
                  onChange={(e) => setTotalWeightKg(e.target.value)}
                  required
                  className={`${inputCls} font-mono pr-10`}
                />
                <span className="absolute right-3.5 top-3 text-[11px] text-[#636B76] font-bold">
                  KG
                </span>
              </div>
            </div>

            <div>
              <label className={labelCls}>Supplier Bill Amount (PKR) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  placeholder="e.g. 1350000"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  required
                  className={`${inputCls} font-mono pr-12`}
                />
                <span className="absolute right-3.5 top-3 text-[10px] text-[#636B76] font-bold">
                  PKR
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-[#F8F9FA] dark:bg-[#20242A] rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between">
            <span className="text-xs text-[#636B76] dark:text-[#8A929C] font-semibold">
              Price per KG:
            </span>
            <span className="text-sm font-black text-[#2FB67C] font-mono">
              {liveRatePerKg > 0 ? `${formatPKR(liveRatePerKg)} / KG` : 'Enter weight & bill'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Truck Number</label>
              <input
                type="text"
                placeholder="e.g. LES-4921"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className={`${inputCls} uppercase font-mono`}
              />
            </div>

            <div>
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
                {receivingLoad ? formatPKR(receivingLoad.totalLandedCost || receivingLoad.purchaseAmount) : 0}
              </span>
            </div>
          </div>

          <div>
            <label className={labelCls}>Arrival Date *</label>
            <input
              type="date"
              value={recvDate}
              onChange={(e) => setRecvDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
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
            <div>
              <label className={labelCls}>Dead Birds</label>
              <input
                type="number"
                value={deadPieces}
                onChange={(e) => setDeadPieces(e.target.value)}
                min="0"
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
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
                <div className="text-[11px] text-[#636B76]">{formatDate(loadDetails.purchaseDate)}</div>
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
                    Final Cost Per Healthy Bird (divided by {loadDetails.stockBatch.originalSaleablePieces} birds):
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
                <div className="sm:col-span-5">
                  <Select
                    size="sm"
                    placement="up"
                    value={expenseCategory}
                    onChange={setExpenseCategory}
                    options={EXPENSE_CAT_OPTIONS}
                  />
                </div>
                <div className="sm:col-span-3">
                  <input
                    type="number"
                    placeholder="Amount (PKR)"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full min-h-[38px] px-3 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[12px] bg-white dark:bg-[#181B1F] font-mono"
                    required
                    min="1"
                  />
                </div>
                <div className="sm:col-span-4">
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full min-h-[38px] px-2.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[12px] bg-white dark:bg-[#181B1F]"
                  />
                </div>
                <div className="sm:col-span-9">
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="w-full min-h-[38px] px-3 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[12px] bg-white dark:bg-[#181B1F]"
                  />
                </div>
                <div className="sm:col-span-3">
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

            <div className="flex justify-end pt-2">
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
    </div>
  );
};

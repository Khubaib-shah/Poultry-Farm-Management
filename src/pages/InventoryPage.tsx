import React, { useState, useMemo, useEffect } from 'react';
import {
  Boxes,
  Calculator,
  History,
  Scale,
  Check,
} from 'lucide-react';
import { StockBatch, StockMovement } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { formatPKR, formatNumber, formatDate, formatDateTime } from '../utils/formatters.ts';
import { getCostAnalysisStatus } from '../utils/poultryMath.ts';
import { useAppStore } from '../store/useAppStore.ts';

interface InventoryPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ onShowToast }) => {
  const batches = useAppStore((s) => s.batches);
  const movements = useAppStore((s) => s.movements);
  const settings = useAppStore((s) => s.settings);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const adjustStock = useAppStore((s) => s.adjustStock);

  const [activeTab, setActiveTab] = useState<'batches' | 'calculator' | 'movements'>('batches');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('ALL');
  const [movementTypeFilter, setMovementTypeFilter] = useState('ALL');

  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [proposedPrice, setProposedPrice] = useState<string>('1850');

  // Stock adjustment modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustBatchId, setAdjustBatchId] = useState<string>('');
  const [quantityChange, setQuantityChange] = useState<string>('-5');
  const [adjustReason, setAdjustReason] = useState<string>('');

  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      const firstActive = batches.find((b) => !b.isClosed) || batches[0];
      setSelectedBatchId(String(firstActive.id));
    }
  }, [batches, selectedBatchId]);

  const selectedBatch = useMemo(
    () => batches.find((b) => String(b.id) === selectedBatchId) || batches[0] || null,
    [batches, selectedBatchId]
  );

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantityChange, 10);
    if (!adjustBatchId || isNaN(qty) || qty === 0) {
      onShowToast('Please pick a stock lot and enter a valid count change', 'error');
      return;
    }

    setIsAdjustOpen(false);
    const reason = adjustReason || 'Manual stock count update';
    setQuantityChange('-5');
    setAdjustReason('');

    try {
      await adjustStock({
        stockBatchId: parseInt(adjustBatchId, 10),
        quantityChange: qty,
        reason,
        adjustmentType: qty < 0 ? 'DAMAGE' : 'ADJUSTMENT',
      });
    } catch {
      // handled by store
    }
  };

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const q = searchQuery.toLowerCase();
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
  }, [batches, searchQuery, batchStatusFilter]);

  const filteredMovements = useMemo(() => {
    return movements.filter(
      (m) => movementTypeFilter === 'ALL' || m.movementType === movementTypeFilter
    );
  }, [movements, movementTypeFilter]);

  const totalStockPieces = batches
    .filter((b) => !b.isClosed)
    .reduce((sum, b) => sum + b.remainingPieces, 0);

  const totalStockValue = batches
    .filter((b) => !b.isClosed)
    .reduce((sum, b) => sum + b.remainingPieces * Number(b.costPerPiece), 0);

  const lowThreshold = Number(settings.lowStockThreshold || 300);
  const examplePrice1 = Number(settings.examplePrice1 || 1200);
  const examplePrice2 = Number(settings.examplePrice2 || 1500);

  const calcCost = selectedBatch ? Number(selectedBatch.costPerPiece) : 0;
  const calcSellingPrice = parseFloat(proposedPrice) || 0;
  const analysis = getCostAnalysisStatus(calcSellingPrice, calcCost);
  const analysisEx1 = getCostAnalysisStatus(examplePrice1, calcCost);
  const analysisEx2 = getCostAnalysisStatus(examplePrice2, calcCost);

  const batchColumns: DataTableColumn<StockBatch>[] = [
    {
      key: 'batchNumber',
      header: 'Lot #',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (b) => <span className="font-mono font-bold">{b.batchNumber}</span>,
    },
    {
      key: 'receivingDate',
      header: 'Arrival Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (b) => (
        <span className="text-[#4A515B] dark:text-[#A3AAB3]">{formatDate(b.receivingDate)}</span>
      ),
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      sortable: true,
      hideOnMobileDefault: true,
      render: (b) => (
        <div>
          <div className="font-semibold">{b.supplierName}</div>
          <div className="text-[10px] text-[#636B76] font-mono">{b.loadNumber}</div>
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
        <span className="font-mono">
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
      render: (b) => <span className="font-mono">{formatNumber(b.originalSaleablePieces)}</span>,
    },
    {
      key: 'soldPieces',
      header: 'Sold',
      align: 'right',
      sortable: true,
      render: (b) => <span className="font-mono">{formatNumber(b.soldPieces)}</span>,
    },
    {
      key: 'remainingPieces',
      header: 'Birds Left',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (b) => (
        <span className="font-mono font-black text-[#14161A] dark:text-white">
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
        <span className="font-mono font-bold text-[#2FB67C]">{formatPKR(b.costPerPiece)}</span>
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
          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            b.isClosed
              ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#636B76]'
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
      header: 'Check Rate',
      align: 'right',
      render: (b) => (
        <button
          type="button"
          onClick={() => {
            setSelectedBatchId(String(b.id));
            setActiveTab('calculator');
          }}
          className="px-3 py-1.5 text-[11px] font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] cursor-pointer"
        >
          Check Profit
        </button>
      ),
    },
  ];

  const movementColumns: DataTableColumn<StockMovement>[] = [
    {
      key: 'createdAt',
      header: 'Date & Time',
      sortable: true,
      hideOnMobileDefault: true,
      render: (m) => <span className="font-mono text-[11px]">{formatDateTime(m.createdAt)}</span>,
    },
    {
      key: 'batchNumber',
      header: 'Lot #',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (m) => <span className="font-mono font-bold">{m.batchNumber}</span>,
    },
    {
      key: 'movementType',
      header: 'Action',
      sortable: true,
      render: (m) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
        <span className={`font-mono font-bold ${m.quantity > 0 ? 'text-[#2FB67C]' : 'text-rose-500'}`}>
          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Left in Lot',
      align: 'right',
      sortable: true,
      render: (m) => <span className="font-mono font-semibold">{m.balanceAfter} birds</span>,
    },
    {
      key: 'unitCost',
      header: 'Cost / Bird',
      align: 'right',
      defaultVisible: false,
      sortable: true,
      sortValue: (m) => Number(m.unitCost),
      render: (m) => <span className="font-mono">{formatPKR(m.unitCost)}</span>,
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
  ];

  const batchOptions = batches.map((b) => ({
    value: String(b.id),
    label: b.batchNumber,
    sublabel: `${b.remainingPieces} left @ ${formatPKR(b.costPerPiece)}/bird`,
  }));

  const activeBatchOptions = batches
    .filter((b) => !b.isClosed)
    .map((b) => ({
      value: String(b.id),
      label: b.batchNumber,
      sublabel: `${b.remainingPieces} birds available`,
    }));

  const inputCls =
    'w-full min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[20px] p-5 bg-[#A9C8FA] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Birds in Stock
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] font-black tracking-tight leading-none font-mono">
              {formatNumber(totalStockPieces)} birds
            </div>
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              In {batches.filter((b) => !b.isClosed).length} active lots (oldest sold first)
            </p>
          </div>
        </div>

        <div className="rounded-[20px] p-5 bg-[#92E2B3] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Total Stock Worth
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] font-black tracking-tight leading-none font-mono">
              {formatPKR(totalStockValue)}
            </div>
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              Purchase + truck cost of remaining birds
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 shadow-xs flex flex-col justify-between min-h-[145px]">
          <div>
            <span className="text-[11px] font-extrabold text-[#636B76] dark:text-[#8A929C] uppercase tracking-[0.08em]">
              Manual Count Fix
            </span>
            <div className="text-xs font-semibold text-[#14161A] dark:text-[#F2F4F5] mt-1">
              Update bird counts for dead birds or cage recount
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const firstActive = batches.find((b) => !b.isClosed);
              if (firstActive) setAdjustBatchId(String(firstActive.id));
              setIsAdjustOpen(true);
            }}
            className="w-full min-h-[42px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs cursor-pointer"
          >
            Update Bird Count
          </button>
        </div>
      </div>

      {/* Sub-navigation: Vertical list on mobile, pill bar on sm+ */}
      <div className="sm:hidden bg-white dark:bg-[#181B1F] rounded-[18px] border border-[#E3E6E8] dark:border-[#2A2F35] divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] overflow-hidden shadow-xs">
        {[
          { id: 'batches' as const, label: 'Stock Lots', icon: Boxes },
          { id: 'calculator' as const, label: 'Price & Profit Checker', icon: Calculator },
          { id: 'movements' as const, label: 'Stock History', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-4 py-3 text-xs flex items-center justify-between transition cursor-pointer ${
                active
                  ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] font-bold'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </span>
              {active && <Check className="w-3.5 h-3.5 text-[#14161A] dark:text-[#D4F56B]" />}
            </button>
          );
        })}
      </div>

      <div className="hidden sm:inline-flex items-center gap-0.5 bg-white dark:bg-[#181B1F] p-1 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] w-fit shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 text-xs font-bold rounded-full transition focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'batches'
              ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
              : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Stock Lots</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className={`px-4 py-2 text-xs font-bold rounded-full transition focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'calculator'
              ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
              : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Price & Profit Checker</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 text-xs font-bold rounded-full transition focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'movements'
              ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
              : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Stock History</span>
        </button>
      </div>

      {/* TAB 1: BATCHES */}
      {activeTab === 'batches' && (
        <DataTable
          tableId="inventory-batches"
          data={filteredBatches}
          columns={batchColumns}
          keyExtractor={(b) => b.id}
          loading={loading && !initialized}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
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

      {/* TAB 2: MARGIN CALCULATOR */}
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
                  <span className="font-mono font-medium">{formatPKR(selectedBatch.purchaseAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Truck Costs:</span>
                  <span className="font-mono font-medium">{formatPKR(selectedBatch.totalLoadExpenses)}</span>
                </div>
                <div className="flex justify-between border-t border-[#E3E6E8] dark:border-[#2A2F35] pt-2">
                  <span className="font-semibold">Total Paid:</span>
                  <span className="font-mono font-bold">{formatPKR(selectedBatch.totalLandedCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Healthy Birds:</span>
                  <span className="font-mono font-medium">{selectedBatch.originalSaleablePieces} birds</span>
                </div>
                <div className="flex justify-between border-t border-[#E3E6E8] dark:border-[#2A2F35] pt-2.5 bg-[#92E2B3]/20 -mx-4 -mb-4 p-4 rounded-b-[16px]">
                  <span className="font-bold text-emerald-950 dark:text-[#92E2B3]">Cost Per Bird:</span>
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

      {/* TAB 3: STOCK MOVEMENTS */}
      {activeTab === 'movements' && (
        <DataTable
          tableId="inventory-movements"
          title="Stock History"
          subtitle="Every truck arrival, walk-in sale, other shop delivery, and count fix"
          data={filteredMovements}
          columns={movementColumns}
          keyExtractor={(m) => m.id}
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
            <span className={`font-mono font-bold text-xs ${m.quantity > 0 ? 'text-[#2FB67C]' : 'text-rose-500'}`}>
              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
            </span>
          )}
        />
      )}

      {/* MODAL: UPDATE STOCK COUNT */}
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
              onClick={() => setIsAdjustOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] cursor-pointer"
            >
              Update Count
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

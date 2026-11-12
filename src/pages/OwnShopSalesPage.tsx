import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react';
import { Sale } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { formatPKR, formatSignedPKR, formatNumber, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';

interface OwnShopSalesPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
  initialOpenSaleModal?: boolean;
}

export const OwnShopSalesPage: React.FC<OwnShopSalesPageProps> = ({
  onShowToast,
}) => {
  const allSales = useAppStore((s) => s.sales);
  const batches = useAppStore((s) => s.batches);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const createOwnShopSale = useAppStore((s) => s.createOwnShopSale);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL');

  const [saleDate, setSaleDate] = useState(() => getLocalPakistanDate());
  const [quantityPieces, setQuantityPieces] = useState('');
  const [totalSaleAmount, setTotalSaleAmount] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const availableStock = useMemo(
    () =>
      batches
        .filter((b) => !b.isClosed)
        .reduce((sum, b) => sum + Number(b.remainingPieces || 0), 0),
    [batches]
  );

  const salesList = useMemo(
    () => allSales.filter((s) => s.saleType === 'OWN_SHOP'),
    [allSales]
  );

  const todayStr = getLocalPakistanDate();

  const filteredSales = useMemo(() => {
    return salesList.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q));
      const matchesDate =
        dateFilter === 'ALL' ||
        (dateFilter === 'TODAY' && s.saleDate === todayStr) ||
        (dateFilter === 'MONTH' && s.saleDate.startsWith(todayStr.slice(0, 7)));
      return matchesSearch && matchesDate;
    });
  }, [salesList, searchQuery, dateFilter, todayStr]);

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const pieces = parseInt(quantityPieces, 10);
    const amount = parseFloat(totalSaleAmount);

    if (isNaN(pieces) || pieces <= 0 || isNaN(amount) || amount <= 0) {
      onShowToast('Please enter valid bird count and cash amount', 'error');
      return;
    }

    if (pieces > availableStock) {
      onShowToast(
        `Only ${availableStock} birds in stock right now!`,
        'error'
      );
      return;
    }

    const notesCopy = saleNotes;
    setQuantityPieces('');
    setTotalSaleAmount('');
    setSaleNotes('');

    try {
      await createOwnShopSale({
        saleDate,
        quantityPieces: pieces,
        totalSaleAmount: amount,
        notes: notesCopy || undefined,
      });
    } catch {
      // handled by store
    }
  };

  const livePieces = parseInt(quantityPieces || '0', 10);
  const liveAmount = parseFloat(totalSaleAmount || '0');
  const livePricePerPiece =
    livePieces > 0 && liveAmount > 0 ? Number((liveAmount / livePieces).toFixed(2)) : 0;

  const columns: DataTableColumn<Sale>[] = [
    {
      key: 'invoiceNumber',
      header: 'Bill #',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (s) => <span className="font-normal tabular-nums text-[#7B848F] dark:text-[#8A929C]">{s.invoiceNumber}</span>,
    },
    {
      key: 'saleDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (s) => <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">{formatDate(s.saleDate)}</span>,
    },
    {
      key: 'totalPieces',
      header: 'Birds Sold',
      align: 'right',
      sortable: true,
      hideOnMobileDefault: true,
      render: (s) => <span className="font-normal tabular-nums">{formatNumber(s.totalPieces)} birds</span>,
    },
    {
      key: 'sellingPricePerPiece',
      header: 'Price / Bird',
      align: 'right',
      defaultVisible: false,
      sortable: true,
      sortValue: (s) => Number(s.sellingPricePerPiece),
      render: (s) => <span className="font-normal tabular-nums">{formatPKR(s.sellingPricePerPiece)}</span>,
    },
    {
      key: 'costPerPiece',
      header: 'Cost / Bird',
      align: 'right',
      defaultVisible: false,
      sortable: true,
      sortValue: (s) => Number(s.costPerPiece),
      render: (s) => <span className="font-normal tabular-nums text-[#7B848F] dark:text-[#8A929C]">{formatPKR(s.costPerPiece)}</span>,
    },
    {
      key: 'profitPerPiece',
      header: 'Profit / Bird',
      align: 'right',
      defaultVisible: false,
      sortable: true,
      sortValue: (s) => Number(s.profitPerPiece),
      render: (s) => (
        <span
          className={`font-normal tabular-nums ${
            Number(s.profitPerPiece) >= 0 ? 'text-[#2FB67C]' : 'text-[#D95C5C] dark:text-[#FF8585]'
          }`}
        >
          {formatSignedPKR(s.profitPerPiece)}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total Cash',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      sortValue: (s) => Number(s.totalAmount),
      render: (s) => <span className="font-normal tabular-nums">{formatPKR(s.totalAmount)}</span>,
    },
    {
      key: 'totalProfit',
      header: 'Total Profit',
      align: 'right',
      sortable: true,
      hideOnMobileDefault: true,
      sortValue: (s) => Number(s.totalProfit),
      render: (s) => (
        <span
          className={`font-normal tabular-nums ${
            Number(s.totalProfit) >= 0 ? 'text-[#2FB67C]' : 'text-[#D95C5C] dark:text-[#FF8585]'
          }`}
        >
          {formatSignedPKR(s.totalProfit)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Details',
      align: 'right',
      render: (s) => (
        <button
          type="button"
          onClick={() => setSelectedSale(s)}
          className="px-3 py-1.5 text-[11px] font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] cursor-pointer"
        >
          View
        </button>
      ),
    },
  ];

  const inputCls =
    'w-full min-h-[42px] px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Fast Sales Entry Card */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-4 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between pb-3.5 border-b border-[#E3E6E8] dark:border-[#2A2F35] gap-3">
          <div>
            <h2 className="text-base sm:text-lg leading-tight font-bold text-[#14161A] dark:text-[#F2F4F5] flex items-center">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-[#14161A] dark:text-[#D4F56B]" />
              New Walk-in Sale
            </h2>
            <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
              Enter birds sold and cash received — oldest stock is subtracted automatically
            </p>
          </div>

          <div className="hidden xl:flex items-center space-x-2 bg-[#A9C8FA] text-[#14161A] px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs">
            <span>Available Stock:</span>
            <span className="font-mono font-black text-sm">{formatNumber(availableStock)} birds</span>
          </div>
        </div>

        <form onSubmit={handleCreateSale} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Sale Date *
              </label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
                className={`${inputCls} font-mono`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Birds Sold *
              </label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={quantityPieces}
                onChange={(e) => setQuantityPieces(e.target.value)}
                required
                min="1"
                max={availableStock > 0 ? availableStock : 1}
                className={`${inputCls} text-sm font-bold font-mono`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Total Cash (PKR) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 92500"
                  value={totalSaleAmount}
                  onChange={(e) => setTotalSaleAmount(e.target.value)}
                  required
                  min="1"
                  className={`${inputCls} text-sm font-bold font-mono pr-12`}
                />
                <span className="absolute right-4 top-3 text-xs text-[#636B76] font-bold">PKR</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3] mb-1.5">
                Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Morning walk-in sales"
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="bg-[#F8F9FA] dark:bg-[#20242A] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] px-4 min-h-[42px] text-xs flex items-center justify-between sm:mt-6">
              <span className="text-[#636B76] dark:text-[#8A929C] font-semibold">Price / Bird:</span>
              <span className="font-mono font-black text-[#14161A] dark:text-[#D4F56B] text-sm">
                {livePricePerPiece > 0 ? formatPKR(livePricePerPiece) : '-'}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={availableStock <= 0}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-6 py-2.5 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs disabled:opacity-50 gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Sale</span>
            </button>
          </div>
        </form>
      </div>

      {/* Sales History DataTable */}
      <DataTable
        tableId="own-shop-sales"
        title="Walk-in Sales History"
        subtitle="All bills from your main shop"
        data={filteredSales}
        columns={columns}
        keyExtractor={(s) => s.id}
        loading={loading && !initialized}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search bill # or notes..."
        defaultSortKey="saleDate"
        defaultSortDir="desc"
        filters={[
          {
            key: 'date',
            label: 'When',
            value: dateFilter,
            onChange: setDateFilter,
            options: [
              { value: 'ALL', label: 'All Dates' },
              { value: 'TODAY', label: 'Today Only' },
              { value: 'MONTH', label: 'This Month' },
            ],
          },
        ]}
        mobileCardTitle={(s) => s.invoiceNumber}
        mobileCardSubtitle={(s) => `${formatDate(s.saleDate)} · ${s.totalPieces} birds`}
        mobileCardBadge={(s) => (
          <span
            className={`font-mono font-bold text-xs ${
              Number(s.totalProfit) >= 0 ? 'text-[#2FB67C]' : 'text-[#D95C5C] dark:text-[#FF8585]'
            }`}
          >
            {formatSignedPKR(s.totalProfit)}
          </span>
        )}
      />

      {/* SALE DETAIL MODAL */}
      {selectedSale && (
        <Modal
          isOpen={Boolean(selectedSale)}
          onClose={() => setSelectedSale(null)}
          title={`Bill Details: ${selectedSale.invoiceNumber}`}
          subtitle="Sale breakdown and profit"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-[#F8F9FA] dark:bg-[#20242A] p-4 rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35] space-y-2">
              <div className="flex justify-between">
                <span className="text-[#636B76] dark:text-[#8A929C]">Date:</span>
                <span className="font-semibold">{formatDate(selectedSale.saleDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#636B76] dark:text-[#8A929C]">Birds Sold:</span>
                <span className="font-mono font-bold">{selectedSale.totalPieces} birds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#636B76] dark:text-[#8A929C]">Sale Cash:</span>
                <span className="font-mono font-bold">{formatPKR(selectedSale.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#636B76] dark:text-[#8A929C]">Bird Cost:</span>
                <span className="font-mono">{formatPKR(selectedSale.totalCost)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E3E6E8] dark:border-[#2A2F35] pt-2">
                <span className="font-bold">Profit:</span>
                <span
                  className={`font-mono font-bold ${
                    Number(selectedSale.totalProfit) >= 0
                      ? 'text-[#2FB67C]'
                      : 'text-[#D95C5C] dark:text-[#FF8585]'
                  }`}
                >
                  {formatSignedPKR(selectedSale.totalProfit)}
                </span>
              </div>
              {selectedSale.notes && (
                <div className="flex justify-between pt-1">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Notes:</span>
                  <span>{selectedSale.notes}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="min-h-[42px] px-5 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] cursor-pointer"
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

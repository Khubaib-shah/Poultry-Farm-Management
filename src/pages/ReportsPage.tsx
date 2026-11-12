import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Filter,
  ShoppingBag,
  Truck,
  Receipt,
  Users,
  DollarSign,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatPKR, formatSignedPKR, formatNumber, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { computeReportFromCollections, getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import {
  Sale,
  PurchaseLoad,
  BusinessExpense,
  WorkerPayment,
  DealerTransaction,
} from '../types/index.ts';

interface ReportsPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onShowToast }) => {
  const sales = useAppStore((s) => s.sales);
  const purchases = useAppStore((s) => s.purchases);
  const batches = useAppStore((s) => s.batches);
  const expenses = useAppStore((s) => s.expenses);
  const workerPayments = useAppStore((s) => s.workerPayments);
  const dealerTransactions = useAppStore((s) => s.dealerTransactions);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);

  const todayStr = getLocalPakistanDate();
  const [rangeType, setRangeType] = useState<'today' | 'yesterday' | 'weekly' | 'monthly' | 'all' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(`${todayStr.substring(0, 7)}-01`);
  const [endDate, setEndDate] = useState(todayStr);
  const [activeDetailTab, setActiveDetailTab] = useState<
    'sales' | 'purchases' | 'expenses' | 'wages' | 'dealers'
  >('sales');
  const [saleTypeFilter, setSaleTypeFilter] = useState('ALL');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('ALL');

  const handleSelectPreset = (type: 'today' | 'yesterday' | 'weekly' | 'monthly' | 'all') => {
    setRangeType(type);
    const now = new Date();
    let s = todayStr;
    let e = todayStr;

    if (type === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      s = getLocalPakistanDate(y);
      e = s;
    } else if (type === 'weekly') {
      const w = new Date(now);
      w.setDate(w.getDate() - 6);
      s = getLocalPakistanDate(w);
      e = todayStr;
    } else if (type === 'monthly') {
      s = `${todayStr.substring(0, 7)}-01`;
      e = todayStr;
    } else if (type === 'all') {
      s = '2020-01-01';
      e = '2099-12-31';
    }

    setStartDate(s);
    setEndDate(e);
  };

  const data = useMemo(
    () =>
      computeReportFromCollections({
        startDate,
        endDate,
        sales,
        purchases,
        batches,
        expenses,
        workerPayments,
        dealerTransactions,
      }),
    [startDate, endDate, sales, purchases, batches, expenses, workerPayments, dealerTransactions]
  );

  const sum = data.summary;

  const filteredSales = useMemo(
    () =>
      (data.sales || []).filter(
        (s) => saleTypeFilter === 'ALL' || s.saleType === saleTypeFilter
      ),
    [data.sales, saleTypeFilter]
  );

  const filteredExpenses = useMemo(
    () =>
      (data.generalExpenses || []).filter(
        (e) => expenseCategoryFilter === 'ALL' || e.category === expenseCategoryFilter
      ),
    [data.generalExpenses, expenseCategoryFilter]
  );

  const expenseCategoryOptions = useMemo(() => {
    const cats = Array.from(new Set((data.generalExpenses || []).map((e) => e.category)));
    return [{ value: 'ALL', label: 'All Categories' }, ...cats.map((c) => ({ value: c, label: c }))];
  }, [data.generalExpenses]);

  const handleExportExcel = () => {
    const summaryRows = [
      ['AL-MADINA POULTRY TRADERS - PROFIT & LOSS REPORT'],
      ['Period', `${formatDate(data.startDate)} to ${formatDate(data.endDate)}`],
      ['Generated On', new Date().toLocaleString('en-PK')],
      [''],
      ['ITEM', 'AMOUNT (PKR)', 'NOTES'],
      ['Shop Counter Sales', sum.ownShopRevenue, 'Direct retail counter'],
      ['Wholesale Shop Sales', sum.wholesaleRevenue, 'Delivered to local chicken shops'],
      ['TOTAL SALES', sum.totalRevenue, '100%'],
      ['Cost of Birds Sold', sum.cogs, 'Oldest stock batch first'],
      ['PROFIT ON SALES', sum.grossProfit, `${sum.grossMarginPercent}% margin`],
      ['Daily Shop Expenses', sum.generalExpenses, 'Electricity, rent, food, tea, cleaning'],
      ['Staff Wages Paid', sum.workerPayments, 'Salaries and daily wages'],
      ['FINAL NET PROFIT', sum.netProfit, `${sum.netMarginPercent}% net margin`],
      [''],
      ['STOCK & PURCHASES', ''],
      ['Total Birds Sold', sum.totalPiecesSold],
      ['Truck Weight Purchased (KG)', sum.totalPurchasesWeight],
      ['Total Truck Bird Bills (PKR)', sum.totalPurchasesAmount],
      ['Total Truck Transit Costs (PKR)', sum.totalLoadExpenses],
      ['Current Birds in Stock', data.stockValuation?.totalPieces || 0],
      ['Current Stock Value (PKR)', data.stockValuation?.totalValue || 0],
    ];

    const salesRows = [
      ['BILL #', 'DATE', 'CHANNEL', 'CUSTOMER', 'BIRDS', 'RATE/BIRD', 'BIRD COST', 'TOTAL SALE', 'PROFIT'],
      ...(data.sales || []).map((s) => [
        s.invoiceNumber,
        s.saleDate,
        s.saleType === 'OWN_SHOP' ? 'Counter' : 'Wholesale',
        s.shopName || 'Shop Counter',
        s.totalPieces,
        Number(s.sellingPricePerPiece),
        Number(s.totalCost),
        Number(s.totalAmount),
        Number(s.totalProfit),
      ]),
    ];

    const purchaseRows = [
      ['LOAD #', 'DATE', 'SUPPLIER', 'WEIGHT (KG)', 'BIRD BILL (PKR)', 'TRUCK COSTS (PKR)', 'TOTAL COST (PKR)', 'STATUS'],
      ...(data.purchases || []).map((p) => [
        p.loadNumber,
        p.purchaseDate,
        p.supplierName,
        Number(p.totalWeightKg),
        Number(p.purchaseAmount),
        Number(p.totalExpenses || 0),
        Number(p.totalLandedCost || p.purchaseAmount),
        p.status === 'RECEIVED' ? 'Received' : 'Pending',
      ]),
    ];

    const expRows = [
      ['DATE', 'CATEGORY', 'METHOD', 'DESCRIPTION', 'AMOUNT (PKR)'],
      ...(data.generalExpenses || []).map((e) => [
        e.expenseDate,
        e.category,
        e.paymentMethod,
        e.description || '-',
        Number(e.amount),
      ]),
    ];

    const wageRows = [
      ['DATE', 'STAFF NAME', 'METHOD', 'NOTES', 'AMOUNT (PKR)'],
      ...(data.workerPayments || []).map((w) => [
        w.paymentDate,
        w.workerName || `Worker #${w.workerId}`,
        w.paymentMethod,
        w.description || '-',
        Number(w.amount),
      ]),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Profit & Loss');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salesRows), 'Sales');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(purchaseRows), 'Truck Purchases');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), 'Shop Expenses');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wageRows), 'Staff Wages');

    const fileName = `AlMadina_PnL_${data.startDate}_to_${data.endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    onShowToast(`Saved Excel file: ${fileName}`, 'success');
  };

  // Detailed Table Columns
  const salesColumns: DataTableColumn<Sale>[] = [
    {
      key: 'invoiceNumber',
      header: 'Bill #',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (s) => (
        <span className="font-mono font-bold text-[#14161A] dark:text-white">{s.invoiceNumber}</span>
      ),
    },
    {
      key: 'saleDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (s) => <span className="text-[#4A515B] dark:text-[#A3AAB3]">{formatDate(s.saleDate)}</span>,
    },
    {
      key: 'channel',
      header: 'Sold To',
      sortable: true,
      hideOnMobileDefault: true,
      sortValue: (s) => (s.saleType === 'OWN_SHOP' ? 'Walk-in Shop' : s.shopName || 'Other Shop'),
      render: (s) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            s.saleType === 'OWN_SHOP'
              ? 'bg-[#C9C3F5] text-[#14161A]'
              : 'bg-[#A9C8FA] text-[#14161A]'
          }`}
        >
          {s.saleType === 'OWN_SHOP' ? 'Walk-in Shop' : s.shopName || 'Other Shop'}
        </span>
      ),
    },
    {
      key: 'totalPieces',
      header: 'Birds',
      align: 'right',
      sortable: true,
      render: (s) => <span className="font-mono font-semibold">{formatNumber(s.totalPieces)}</span>,
    },
    {
      key: 'sellingPricePerPiece',
      header: 'Price / Bird',
      align: 'right',
      sortable: true,
      defaultVisible: false,
      sortValue: (s) => Number(s.sellingPricePerPiece),
      render: (s) => <span className="font-mono">{formatPKR(s.sellingPricePerPiece)}</span>,
    },
    {
      key: 'totalCost',
      header: 'Bird Cost',
      align: 'right',
      sortable: true,
      sortValue: (s) => Number(s.totalCost),
      render: (s) => <span className="font-mono text-[#636B76] dark:text-[#8A929C]">{formatPKR(s.totalCost)}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Sale Cash',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      sortValue: (s) => Number(s.totalAmount),
      render: (s) => (
        <span className="font-mono font-bold text-[#14161A] dark:text-white">{formatPKR(s.totalAmount)}</span>
      ),
    },
    {
      key: 'totalProfit',
      header: 'Profit',
      align: 'right',
      sortable: true,
      hideOnMobileDefault: true,
      sortValue: (s) => Number(s.totalProfit),
      render: (s) => (
        <span
          className={`font-mono font-bold ${
            Number(s.totalProfit) >= 0 ? 'text-[#2FB67C]' : 'text-[#D95C5C] dark:text-[#FF8585]'
          }`}
        >
          {formatSignedPKR(s.totalProfit)}
        </span>
      ),
    },
  ];

  const purchaseColumns: DataTableColumn<PurchaseLoad>[] = [
    {
      key: 'loadNumber',
      header: 'Load #',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (p) => <span className="font-mono font-bold">{p.loadNumber}</span>,
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      sortable: true,
      hideOnMobileDefault: true,
      render: (p) => (
        <div>
          <div className="font-semibold text-[#14161A] dark:text-white">{p.supplierName}</div>
          {p.vehicleNumber && (
            <div className="text-[10px] text-[#636B76] font-mono">{p.vehicleNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'purchaseDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (p) => formatDate(p.purchaseDate),
    },
    {
      key: 'totalWeightKg',
      header: 'Weight (KG)',
      align: 'right',
      sortable: true,
      sortValue: (p) => Number(p.totalWeightKg),
      render: (p) => <span className="font-mono">{formatNumber(p.totalWeightKg)} KG</span>,
    },
    {
      key: 'purchaseAmount',
      header: 'Bird Bill',
      align: 'right',
      sortable: true,
      defaultVisible: false,
      sortValue: (p) => Number(p.purchaseAmount),
      render: (p) => <span className="font-mono">{formatPKR(p.purchaseAmount)}</span>,
    },
    {
      key: 'totalExpenses',
      header: 'Truck Costs',
      align: 'right',
      sortable: true,
      sortValue: (p) => Number(p.totalExpenses || 0),
      render: (p) => <span className="font-mono text-[#F5B544]">{formatPKR(p.totalExpenses || 0)}</span>,
    },
    {
      key: 'totalLandedCost',
      header: 'Total Cost',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      sortValue: (p) => Number(p.totalLandedCost || p.purchaseAmount),
      render: (p) => (
        <span className="font-mono font-bold text-[#14161A] dark:text-[#D4F56B]">
          {formatPKR(p.totalLandedCost || p.purchaseAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      sortable: true,
      render: (p) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            p.status === 'RECEIVED'
              ? 'bg-[#92E2B3]/30 text-emerald-800 dark:text-[#92E2B3]'
              : 'bg-[#F6E7A1]/40 text-amber-900 dark:text-[#F6E7A1]'
          }`}
        >
          {p.status === 'RECEIVED' ? 'Received' : 'Pending'}
        </span>
      ),
    },
  ];

  const expenseColumns: DataTableColumn<BusinessExpense>[] = [
    {
      key: 'expenseDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (e) => <span className="font-mono">{formatDate(e.expenseDate)}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (e) => (
        <span className="px-2 py-0.5 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] font-bold text-[11px]">
          {e.category}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Paid Via',
      sortable: true,
      defaultVisible: false,
      render: (e) => <span className="font-mono text-[11px]">{e.paymentMethod}</span>,
    },
    {
      key: 'description',
      header: 'Details',
      hideOnMobileDefault: true,
      render: (e) => (
        <span className="text-[#4A515B] dark:text-[#A3AAB3]">{e.description || '-'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      sortValue: (e) => Number(e.amount),
      render: (e) => <span className="font-mono font-bold">{formatPKR(e.amount)}</span>,
    },
  ];

  const wageColumns: DataTableColumn<WorkerPayment>[] = [
    {
      key: 'paymentDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (w) => <span className="font-mono">{formatDate(w.paymentDate)}</span>,
    },
    {
      key: 'workerName',
      header: 'Staff Member',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (w) => <span className="font-bold">{w.workerName || `Worker #${w.workerId}`}</span>,
    },
    {
      key: 'paymentMethod',
      header: 'Method',
      sortable: true,
      defaultVisible: false,
      render: (w) => <span className="font-mono text-[11px]">{w.paymentMethod}</span>,
    },
    {
      key: 'description',
      header: 'Notes',
      hideOnMobileDefault: true,
      render: (w) => <span className="text-[#4A515B] dark:text-[#A3AAB3]">{w.description || '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Paid Amount',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      sortValue: (w) => Number(w.amount),
      render: (w) => <span className="font-mono font-bold">{formatPKR(w.amount)}</span>,
    },
  ];

  const dealerPmtColumns: DataTableColumn<DealerTransaction>[] = [
    {
      key: 'transactionDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (t) => <span className="font-mono">{formatDate(t.transactionDate)}</span>,
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (t) => <span className="font-bold">{t.supplierName || 'Supplier'}</span>,
    },
    {
      key: 'paymentMethod',
      header: 'Method',
      sortable: true,
      hideOnMobileDefault: true,
      render: (t) => <span className="font-mono text-[11px]">{t.paymentMethod || 'CASH'}</span>,
    },
    {
      key: 'notes',
      header: 'Slip / Notes',
      defaultVisible: false,
      render: (t) => <span>{t.notes || '-'}</span>,
    },
    {
      key: 'creditAmount',
      header: 'Amount Paid',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      sortValue: (t) => Number(t.creditAmount),
      render: (t) => (
        <span className="font-mono font-bold text-[#2FB67C]">{formatPKR(t.creditAmount)}</span>
      ),
    },
  ];

  const expenseCategories = Object.entries(data.expensesByCategory || {}).sort((a, b) => b[1] - a[1]);

  const periodPresets = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'weekly', label: 'Last 7 Days' },
    { id: 'monthly', label: 'This Month' },
    { id: 'all', label: 'All Time' },
  ] as const;

  const detailTabs = [
    { id: 'sales', label: 'Sales', count: (data.sales || []).length, icon: ShoppingBag },
    { id: 'purchases', label: 'Trucks', count: (data.purchases || []).length, icon: Truck },
    { id: 'expenses', label: 'Shop Bills', count: (data.generalExpenses || []).length, icon: Receipt },
    { id: 'wages', label: 'Staff Pay', count: (data.workerPayments || []).length, icon: Users },
    { id: 'dealers', label: 'Paid to Dealers', count: (data.dealerPayments || []).length, icon: DollarSign },
  ] as const;

  const ownShopCount = (data.sales || []).filter((s) => s.saleType === 'OWN_SHOP').length;
  const wholesaleCount = (data.sales || []).filter((s) => s.saleType === 'WHOLESALE').length;
  const ownShopPct = sum.totalRevenue > 0 ? Math.round((sum.ownShopRevenue / sum.totalRevenue) * 100) : 0;
  const wholesalePct = sum.totalRevenue > 0 ? Math.max(0, 100 - ownShopPct) : 0;
  const dealerPaidTotal = (data.dealerPayments || []).reduce((s, p) => s + Number(p.creditAmount || 0), 0);

  return (
    <div className="w-full space-y-4 sm:space-y-6 print:p-0">
      {/* Top Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 print:hidden">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Profit & Loss Report
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Simple summary of money coming in, bird costs, shop bills, and final profit
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 w-full xl:w-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Save Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition cursor-pointer"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Print
          </button>
        </div>
      </div>

      {/* Period Filter Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs print:hidden">
        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-4 h-4 text-[#636B76] dark:text-[#8A929C]" />
            <span className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5]">Period:</span>
          </div>

          {/* Mobile: Vertical List (no pill overflow) */}
          <div className="md:hidden w-full rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F8F9FA] dark:bg-[#1F2328] divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] overflow-hidden">
            {periodPresets.map((btn) => {
              const active = rangeType === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handleSelectPreset(btn.id)}
                  className={`w-full px-3.5 py-2.5 text-xs flex items-center justify-between transition cursor-pointer ${
                    active
                      ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] font-bold'
                      : 'text-[#4A515B] dark:text-[#A3AAB3] font-medium'
                  }`}
                >
                  <span>{btn.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-[#14161A] dark:text-[#D4F56B]" />}
                </button>
              );
            })}
          </div>

          {/* Tablet / Desktop: Single-row Pills */}
          <div className="hidden md:inline-flex items-center gap-0.5 p-1 rounded-full bg-[#F8F9FA] dark:bg-[#1F2328] border border-[#E3E6E8] dark:border-[#2A2F35]">
            {periodPresets.map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleSelectPreset(btn.id)}
                className={`px-3 py-1.5 text-[11px] rounded-full font-bold transition focus:outline-none cursor-pointer whitespace-nowrap ${
                  rangeType === btn.id
                    ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
                    : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2 w-full lg:w-auto">
          <span className="text-xs text-[#636B76] dark:text-[#8A929C] font-semibold shrink-0">
            Dates:
          </span>
          <div className="grid grid-cols-2 md:flex md:items-center gap-2 w-full md:w-auto">
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setRangeType('custom');
              }}
              className="w-full md:w-auto min-h-[38px] px-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[12px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5]"
            />
            <span className="hidden md:inline text-[#636B76] dark:text-[#8A929C] text-xs">to</span>
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setRangeType('custom');
              }}
              className="w-full md:w-auto min-h-[38px] px-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[12px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5]"
            />
          </div>
        </div>
      </div>

      {/* KPI SUMMARY STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="rounded-[18px] p-4 bg-[#C9C3F5] text-[#14161A]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">Money From Sales</div>
          <div className="text-lg font-black font-mono mt-1">{formatPKR(sum.totalRevenue)}</div>
          <div className="text-[11px] font-semibold mt-1">{formatNumber(sum.totalPiecesSold)} birds sold</div>
        </div>

        <div className="rounded-[18px] p-4 bg-[#A9C8FA] text-[#14161A]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">What Sold Birds Cost</div>
          <div className="text-lg font-black font-mono mt-1">{formatPKR(sum.cogs)}</div>
          <div className="text-[11px] font-semibold mt-1">Purchase + truck costs</div>
        </div>

        <div className="rounded-[18px] p-4 bg-[#92E2B3] text-[#14161A]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">Profit Before Bills</div>
          <div className="text-lg font-black font-mono mt-1">{formatPKR(sum.grossProfit)}</div>
          <div className="text-[11px] font-semibold mt-1">{sum.grossMarginPercent}% profit</div>
        </div>

        <div className="rounded-[18px] p-4 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#636B76] dark:text-[#8A929C]">
            Shop Bills & Staff Pay
          </div>
          <div className="text-lg font-black font-mono mt-1 text-[#14161A] dark:text-white">
            {formatPKR(sum.generalExpenses + sum.workerPayments)}
          </div>
          <div className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-1">
            Bills: {formatPKR(sum.generalExpenses)} · Staff: {formatPKR(sum.workerPayments)}
          </div>
        </div>

        <div className="rounded-[18px] p-4 bg-[#F6E7A1] text-[#14161A]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">Final Profit In Hand</div>
          <div className="text-lg font-black font-mono mt-1">{formatPKR(sum.netProfit)}</div>
          <div className="text-[11px] font-semibold mt-1">{sum.netMarginPercent}% left over</div>
        </div>

        <div className="rounded-[18px] p-4 bg-[#ECF8B5] dark:bg-[#222B18] text-[#14161A] dark:text-[#F2F4F5] border border-[#D4F56B]/70 dark:border-[#D4F56B]/30">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#14161A]/75 dark:text-[#A3AAB3]">
            Birds Still In Shop
          </div>
          <div className="text-lg font-black font-mono text-[#14161A] dark:text-[#D4F56B] mt-1">
            {formatPKR(data.stockValuation?.totalValue || 0)}
          </div>
          <div className="text-[11px] font-semibold text-[#14161A]/80 dark:text-[#A3AAB3] mt-1">
            {formatNumber(data.stockValuation?.totalPieces || 0)} birds left
          </div>
        </div>
      </div>

      {/* COMPACT UNIQUE BREAKDOWN (No repeating KPI totals) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Sales Split */}
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#14161A] dark:text-[#F2F4F5]">
            Where Sales Came From
          </h4>
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-[#14161A] dark:text-[#F2F4F5]">
                  Walk-in Shop ({ownShopCount})
                </span>
                <span className="font-mono font-bold">
                  {formatPKR(sum.ownShopRevenue)} ({ownShopPct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#F3F5F6] dark:bg-[#20242A] overflow-hidden">
                <div
                  style={{ width: `${Math.max(ownShopRevenueBar(ownShopPct), 0)}%` }}
                  className="h-full rounded-full bg-[#C9C3F5]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-[#14161A] dark:text-[#F2F4F5]">
                  Other Shops ({wholesaleCount})
                </span>
                <span className="font-mono font-bold">
                  {formatPKR(sum.wholesaleRevenue)} ({wholesalePct}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#F3F5F6] dark:bg-[#20242A] overflow-hidden">
                <div
                  style={{ width: `${Math.max(ownShopRevenueBar(wholesalePct), 0)}%` }}
                  className="h-full rounded-full bg-[#A9C8FA]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Shop Expenses by Type */}
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#14161A] dark:text-[#F2F4F5]">
            Shop Bills by Type
          </h4>
          {expenseCategories.length === 0 ? (
            <p className="text-xs text-[#636B76] dark:text-[#8A929C] py-2">
              No shop bills in this period.
            </p>
          ) : (
            <div className="space-y-2.5">
              {expenseCategories.map(([cat, amt]) => {
                const pct =
                  sum.generalExpenses > 0 ? Math.round((amt / sum.generalExpenses) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#14161A] dark:text-[#F2F4F5]">{cat}</span>
                      <span className="font-mono font-bold">
                        {formatPKR(amt)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F3F5F6] dark:bg-[#20242A] overflow-hidden">
                      <div
                        style={{ width: `${Math.max(4, pct)}%` }}
                        className="h-full rounded-full bg-[#D4F56B]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 3: Trucks & Dealers */}
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#14161A] dark:text-[#F2F4F5]">
            Trucks & Dealers
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
              <span className="text-[#636B76] dark:text-[#8A929C]">Weight Bought:</span>
              <span className="font-mono font-bold">{formatNumber(sum.totalPurchasesWeight)} KG</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
              <span className="text-[#636B76] dark:text-[#8A929C]">Truck Bird Bills:</span>
              <span className="font-mono font-bold">{formatPKR(sum.totalPurchasesAmount)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
              <span className="text-[#636B76] dark:text-[#8A929C]">Diesel & Driver Pay:</span>
              <span className="font-mono font-bold">{formatPKR(sum.totalLoadExpenses)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-[#636B76] dark:text-[#8A929C]">Paid to Dealers:</span>
              <span className="font-mono font-bold text-[#2FB67C]">{formatPKR(dealerPaidTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED ITEMIZED TABLES WITH COLUMN PICKER & FILTERS */}
      <div className="space-y-4">
        {/* Mobile: Vertical List (no overflowing pills) */}
        <div className="md:hidden bg-white dark:bg-[#181B1F] rounded-[18px] border border-[#E3E6E8] dark:border-[#2A2F35] divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] overflow-hidden shadow-xs print:hidden">
          {detailTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeDetailTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDetailTab(tab.id)}
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
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/80 dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35]">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop / Tablet: Single-row Pill Tabs */}
        <div className="hidden md:inline-flex items-center gap-0.5 bg-white dark:bg-[#181B1F] p-1 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] w-fit shadow-xs print:hidden">
          {detailTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeDetailTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDetailTab(tab.id)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold transition focus:outline-none flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
                    : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>
                  {tab.label} ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {activeDetailTab === 'sales' && (
          <DataTable
            tableId="report-sales"
            title="Sales"
            data={filteredSales}
            columns={salesColumns}
            keyExtractor={(s) => s.id}
            loading={loading && !initialized}
            searchPlaceholder="Search bill # or shop..."
            defaultSortKey="saleDate"
            defaultSortDir="desc"
            filters={[
              {
                key: 'channel',
                label: 'Sale Type',
                value: saleTypeFilter,
                onChange: setSaleTypeFilter,
                options: [
                  { value: 'ALL', label: 'All Sales' },
                  { value: 'OWN_SHOP', label: 'Walk-in Shop' },
                  { value: 'WHOLESALE', label: 'Other Shops' },
                ],
              },
            ]}
            mobileCardTitle={(s) => s.invoiceNumber}
            mobileCardSubtitle={(s) =>
              `${formatDate(s.saleDate)} · ${s.saleType === 'OWN_SHOP' ? 'Walk-in Shop' : s.shopName || 'Other Shop'}`
            }
            mobileCardBadge={(s) => (
              <span
                className={`font-mono font-bold text-xs ${
                  Number(s.totalProfit) >= 0
                    ? 'text-[#2FB67C]'
                    : 'text-[#D95C5C] dark:text-[#FF8585]'
                }`}
              >
                {formatSignedPKR(s.totalProfit)}
              </span>
            )}
          />
        )}

        {activeDetailTab === 'purchases' && (
          <DataTable
            tableId="report-purchases"
            title="Trucks"
            data={data.purchases || []}
            columns={purchaseColumns}
            keyExtractor={(p) => p.id}
            searchPlaceholder="Search load # or supplier..."
            defaultSortKey="purchaseDate"
            defaultSortDir="desc"
            mobileCardTitle={(p) => p.loadNumber}
            mobileCardSubtitle={(p) => `${p.supplierName} · ${formatDate(p.purchaseDate)}`}
            mobileCardBadge={(p) => (
              <span className="font-mono font-bold text-xs">{formatPKR(p.totalLandedCost || p.purchaseAmount)}</span>
            )}
          />
        )}

        {activeDetailTab === 'expenses' && (
          <DataTable
            tableId="report-expenses"
            title="Shop Bills"
            data={filteredExpenses}
            columns={expenseColumns}
            keyExtractor={(e) => e.id}
            searchPlaceholder="Search expense note..."
            defaultSortKey="expenseDate"
            defaultSortDir="desc"
            filters={[
              {
                key: 'category',
                label: 'Category',
                value: expenseCategoryFilter,
                onChange: setExpenseCategoryFilter,
                options: expenseCategoryOptions,
              },
            ]}
            mobileCardTitle={(e) => e.category}
            mobileCardSubtitle={(e) => `${formatDate(e.expenseDate)} · ${e.description || e.paymentMethod}`}
            mobileCardBadge={(e) => <span className="font-mono font-bold text-xs">{formatPKR(e.amount)}</span>}
          />
        )}

        {activeDetailTab === 'wages' && (
          <DataTable
            tableId="report-wages"
            title="Staff Pay"
            data={data.workerPayments || []}
            columns={wageColumns}
            keyExtractor={(w) => w.id}
            searchPlaceholder="Search staff member or note..."
            defaultSortKey="paymentDate"
            defaultSortDir="desc"
            mobileCardTitle={(w) => w.workerName || `Worker #${w.workerId}`}
            mobileCardSubtitle={(w) => `${formatDate(w.paymentDate)} · ${w.description || w.paymentMethod}`}
            mobileCardBadge={(w) => <span className="font-mono font-bold text-xs">{formatPKR(w.amount)}</span>}
          />
        )}

        {activeDetailTab === 'dealers' && (
          <DataTable
            tableId="report-dealer-payments"
            title="Paid to Dealers"
            data={data.dealerPayments || []}
            columns={dealerPmtColumns}
            keyExtractor={(t) => t.id}
            searchPlaceholder="Search supplier or slip..."
            defaultSortKey="transactionDate"
            defaultSortDir="desc"
            mobileCardTitle={(t) => t.supplierName || 'Supplier'}
            mobileCardSubtitle={(t) => `${formatDate(t.transactionDate)} · ${t.paymentMethod || 'CASH'}`}
            mobileCardBadge={(t) => (
              <span className="font-mono font-bold text-xs text-[#2FB67C]">{formatPKR(t.creditAmount)}</span>
            )}
          />
        )}
      </div>
    </div>
  );
};

function ownShopRevenueBar(pct: number): number {
  return pct > 0 ? Math.max(4, pct) : 0;
}

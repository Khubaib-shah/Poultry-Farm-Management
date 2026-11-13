import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  DollarSign,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import { DealerTransaction } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { formatPKR, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

interface DealerLedgerPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
  selectedSupplierId?: number;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer (HBL / Meezan)' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Bank Cheque' },
  { value: 'OTHER', label: 'Other' },
];

export const DealerLedgerPage: React.FC<DealerLedgerPageProps> = ({
  onShowToast,
  selectedSupplierId: initialSupplierId,
}) => {
  const transactions = useAppStore((s) => s.dealerTransactions);
  const suppliers = useAppStore((s) => s.suppliers);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const recordSupplierPayment = useAppStore((s) => s.recordSupplierPayment);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initialSupplierId ? String(initialSupplierId) : 'ALL'
  );
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentSupplierId, setPaymentSupplierId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => getLocalPakistanDate());
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentNotes, setPaymentNotes] = useState('');
  const { isSubmitting: isSavingPayment, runOptimistic: runSavePayment } = useThrottledSubmit();

  useEffect(() => {
    if (suppliers.length > 0 && !paymentSupplierId) {
      setPaymentSupplierId(String(suppliers[0].id));
    }
  }, [suppliers, paymentSupplierId]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = searchQuery.toLowerCase();
      const matchesSup =
        selectedSupplierId === 'ALL' || String(t.supplierId) === selectedSupplierId;
      const matchesType = txTypeFilter === 'ALL' || t.transactionType === txTypeFilter;
      const matchesSearch =
        !q ||
        (t.supplierName && t.supplierName.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q));
      return matchesSup && matchesType && matchesSearch;
    });
  }, [transactions, selectedSupplierId, txTypeFilter, searchQuery]);

  const { totalDebits, totalCredits } = useMemo(() => {
    let d = 0;
    let c = 0;
    filteredTransactions.forEach((t) => {
      d += Number(t.debitAmount || 0);
      c += Number(t.creditAmount || 0);
    });
    return { totalDebits: d, totalCredits: c };
  }, [filteredTransactions]);

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: String(s.id),
        label: s.name,
        sublabel: `Owed: ${formatPKR(s.currentBalance)}`,
      })),
    [suppliers]
  );

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const supId = parseInt(paymentSupplierId, 10);
    const amt = parseFloat(paymentAmount);
    if (!paymentSupplierId || !Number.isFinite(supId) || !Number.isFinite(amt) || amt <= 0) {
      onShowToast('Please choose a supplier and enter amount', 'error');
      return;
    }

    const notesVal = paymentNotes || 'Supplier payment';

    await runSavePayment((onOptimistic) =>
      recordSupplierPayment(
        {
          supplierId: supId,
          amount: amt,
          transactionDate: paymentDate,
          paymentMethod,
          notes: notesVal,
        },
        {
          onOptimistic: () => {
            setIsPaymentOpen(false);
            setPaymentAmount('');
            setPaymentNotes('');
            onOptimistic();
          },
        }
      )
    );
  };

  const columns: DataTableColumn<DealerTransaction>[] = [
    {
      key: 'transactionDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (t) => <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">{formatDate(t.transactionDate)}</span>,
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (t) => <span className="font-normal text-[#636B76] dark:text-[#A3AAB3]">{t.supplierName}</span>,
    },
    {
      key: 'transactionType',
      header: 'Type',
      sortable: true,
      render: (t) => (
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-normal ${
            t.transactionType === 'PURCHASE_DEBIT'
              ? 'bg-[#F6E7A1]/40 text-amber-900 dark:text-[#F6E7A1]'
              : 'bg-[#92E2B3]/30 text-emerald-800 dark:text-[#92E2B3]'
          }`}
        >
          {t.transactionType === 'PURCHASE_DEBIT' ? 'Truck Bill' : 'Payment'}
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'Details',
      hideOnMobileDefault: true,
      render: (t) => (
        <span className="text-[#7B848F] dark:text-[#8A929C] truncate max-w-[240px] block">
          {t.notes || t.referenceType}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Paid Via',
      defaultVisible: false,
      sortable: true,
      render: (t) => <span className="font-normal text-[11px]">{t.paymentMethod || '-'}</span>,
    },
    {
      key: 'debitAmount',
      header: 'Bill (+)',
      align: 'right',
      sortable: true,
      sortValue: (t) => Number(t.debitAmount),
      render: (t) => (
        <span className="font-normal tabular-nums">
          {Number(t.debitAmount) > 0 ? formatPKR(t.debitAmount) : '-'}
        </span>
      ),
    },
    {
      key: 'creditAmount',
      header: 'Paid (-)',
      align: 'right',
      sortable: true,
      sortValue: (t) => Number(t.creditAmount),
      render: (t) => (
        <span className="font-normal tabular-nums text-[#2FB67C]">
          {Number(t.creditAmount) > 0 ? formatPKR(t.creditAmount) : '-'}
        </span>
      ),
    },
    {
      key: 'balanceAfter',
      header: 'Balance',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      sortValue: (t) => Number(t.balanceAfter),
      render: (t) => <span className="font-normal tabular-nums text-[#636B76] dark:text-[#A3AAB3]">{formatPKR(t.balanceAfter)}</span>,
    },
  ];

  const inputCls =
    'w-full min-w-0 max-w-full block min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Dealer Accounts
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            See truck bills and cash payments sent to chicken dealers
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPaymentOpen(true)}
          className="w-full sm:w-auto xl:ml-auto min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Record Supplier Payment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-[20px] p-5 bg-[#C9C3F5] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Total Bills
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] font-black leading-none font-mono">
              {formatPKR(totalDebits)}
            </div>
            <p className="text-xs font-semibold opacity-85 mt-2">Total live chicken truck bills</p>
          </div>
        </div>

        <div className="rounded-[20px] p-5 bg-[#92E2B3] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Total Paid
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] font-black leading-none font-mono">
              {formatPKR(totalCredits)}
            </div>
            <p className="text-xs font-semibold opacity-85 mt-2">Cash & bank payments sent</p>
          </div>
        </div>

        <div className="rounded-[20px] p-5 bg-[#F6E7A1] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Still Owed
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] font-black leading-none font-mono">
              {formatPKR(totalDebits - totalCredits)}
            </div>
            <p className="text-xs font-semibold opacity-85 mt-2">Money still left to pay</p>
          </div>
        </div>
      </div>

      {/* Ledger DataTable */}
      <DataTable
        tableId="dealer-ledger"
        data={filteredTransactions}
        columns={columns}
        keyExtractor={(t) => t.id}
        loading={loading && !initialized}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search supplier or slip notes..."
        defaultSortKey="transactionDate"
        defaultSortDir="desc"
        filters={[
          {
            key: 'supplier',
            label: 'Supplier',
            value: selectedSupplierId,
            onChange: setSelectedSupplierId,
            options: [{ value: 'ALL', label: 'All Suppliers' }, ...supplierOptions],
          },
          {
            key: 'type',
            label: 'Type',
            value: txTypeFilter,
            onChange: setTxTypeFilter,
            options: [
              { value: 'ALL', label: 'Bills & Payments' },
              { value: 'PURCHASE_DEBIT', label: 'Truck Bills Only' },
              { value: 'PAYMENT_CREDIT', label: 'Payments Only' },
            ],
          },
        ]}
        mobileCardTitle={(t) => t.supplierName || 'Supplier'}
        mobileCardSubtitle={(t) => `${formatDate(t.transactionDate)} · ${t.notes || t.referenceType}`}
        mobileCardBadge={(t) => (
          <span
            className={`font-mono font-bold text-xs ${
              Number(t.creditAmount) > 0 ? 'text-[#2FB67C]' : ''
            }`}
          >
            {Number(t.debitAmount) > 0
              ? `+${formatPKR(t.debitAmount)}`
              : `-${formatPKR(t.creditAmount)}`}
          </span>
        )}
      />

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title="Record Supplier Payment"
        subtitle="Subtracts payment from what you owe the dealer"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">Pick Supplier *</label>
            <Select
              value={paymentSupplierId}
              onChange={setPaymentSupplierId}
              options={supplierOptions}
              placeholder="Choose supplier"
              searchable
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="block text-xs font-bold mb-1.5">Payment Date *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className={inputCls}
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-bold mb-1.5">Amount (PKR) *</label>
              <input
                type="number"
                placeholder="e.g. 500000"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
                min="1"
                className={`${inputCls} font-mono font-bold`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Paid Via *</label>
            <Select
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={PAYMENT_METHOD_OPTIONS}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Bank Slip / Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Online transfer ref #902188"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isSavingPayment}
              onClick={() => setIsPaymentOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingPayment}
              aria-busy={isSavingPayment}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingPayment ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

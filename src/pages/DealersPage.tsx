import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Phone,
  MapPin,
  DollarSign,
  Receipt,
  CheckCircle2,
  X,
} from 'lucide-react';
import { DealerTransaction } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { ConfirmDeleteButton } from '../components/common/ConfirmDeleteButton.tsx';
import { formatPKR, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

interface DealersPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
  initialSupplierId?: number;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer (HBL / Meezan)' },
  { value: 'CASH', label: 'Cash Payment' },
  { value: 'CHEQUE', label: 'Bank Cheque' },
  { value: 'OTHER', label: 'Other' },
];

export const DealersPage: React.FC<DealersPageProps> = ({
  onShowToast,
  initialSupplierId,
}) => {
  const suppliers = useAppStore((s) => s.suppliers);
  const transactions = useAppStore((s) => s.dealerTransactions);
  const resolvedIdMap = useAppStore((s) => s.resolvedIdMap);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const isInitialLoading = loading && !initialized;

  const createSupplier = useAppStore((s) => s.createSupplier);
  const recordSupplierPayment = useAppStore((s) => s.recordSupplierPayment);
  const deleteSupplier = useAppStore((s) => s.deleteSupplier);
  const deleteDealerTransaction = useAppStore((s) => s.deleteDealerTransaction);

  // Dynamic supplier selection (drives KPI cards + Ledger table together!)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initialSupplierId ? String(initialSupplierId) : 'ALL'
  );
  const [supplierSearch, setSupplierSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('ALL');
  const [txTypeFilter, setTxTypeFilter] = useState('ALL');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Add Supplier Modal
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [notes, setNotes] = useState('');

  // Record Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentSupplierId, setPaymentSupplierId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => getLocalPakistanDate());
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentNotes, setPaymentNotes] = useState('');

  const { isSubmitting: isSavingSupplier, runOptimistic: runSaveSupplier } = useThrottledSubmit();
  const { isSubmitting: isSavingPayment, runOptimistic: runSavePayment } = useThrottledSubmit();

  useEffect(() => {
    if (initialSupplierId) {
      setSelectedSupplierId(String(initialSupplierId));
    }
  }, [initialSupplierId]);

  useEffect(() => {
    if (suppliers.length > 0 && !paymentSupplierId) {
      setPaymentSupplierId(String(suppliers[0].id));
    }
  }, [suppliers, paymentSupplierId]);

  const selectedSupplier = useMemo(() => {
    if (selectedSupplierId === 'ALL') return null;
    const idNum = Number(selectedSupplierId);
    return (
      suppliers.find(
        (s) => String(s.id) === selectedSupplierId || s.id === resolvedIdMap[idNum]
      ) || null
    );
  }, [suppliers, selectedSupplierId, resolvedIdMap]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = supplierSearch.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q));
      const bal = Number(s.currentBalance ?? s.openingBalance ?? 0);
      const matchesBal =
        balanceFilter === 'ALL' ||
        (balanceFilter === 'OWED' && bal > 0) ||
        (balanceFilter === 'SETTLED' && bal <= 0);
      return matchesSearch && matchesBal;
    });
  }, [suppliers, supplierSearch, balanceFilter]);

  const scopedTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedSupplierId === 'ALL') return true;
      return (
        String(t.supplierId) === selectedSupplierId ||
        (selectedSupplier && t.supplierId === selectedSupplier.id)
      );
    });
  }, [transactions, selectedSupplierId, selectedSupplier]);

  const filteredTransactions = useMemo(() => {
    return scopedTransactions.filter((t) => {
      const q = ledgerSearch.toLowerCase();
      const matchesType = txTypeFilter === 'ALL' || t.transactionType === txTypeFilter;
      const matchesSearch =
        !q ||
        (t.supplierName && t.supplierName.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [scopedTransactions, txTypeFilter, ledgerSearch]);

  // Dynamic KPIs scoped to All Dealers OR Selected Dealer
  const { totalDebits, totalCredits, totalStillOwed } = useMemo(() => {
    let debits = 0;
    let credits = 0;
    scopedTransactions.forEach((t) => {
      debits += Number(t.debitAmount || 0);
      credits += Number(t.creditAmount || 0);
    });

    const owed = selectedSupplier
      ? Number(selectedSupplier.currentBalance ?? selectedSupplier.openingBalance ?? 0)
      : suppliers.reduce(
          (sum, s) => sum + Number(s.currentBalance ?? s.openingBalance ?? 0),
          0
        );

    return { totalDebits: debits, totalCredits: credits, totalStillOwed: owed };
  }, [scopedTransactions, selectedSupplier, suppliers]);

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: String(s.id),
        label: s.name,
        sublabel: `Owed: ${formatPKR(s.currentBalance ?? s.openingBalance ?? 0)}`,
      })),
    [suppliers]
  );

  const openPaymentModal = (supId?: number) => {
    if (supId) {
      setPaymentSupplierId(String(supId));
    } else if (selectedSupplier) {
      setPaymentSupplierId(String(selectedSupplier.id));
    } else if (suppliers.length > 0 && !paymentSupplierId) {
      setPaymentSupplierId(String(suppliers[0].id));
    }
    setPaymentDate(getLocalPakistanDate());
    setIsPaymentOpen(true);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('Please enter supplier name', 'error');
      return;
    }

    const parsedBal = parseFloat(openingBalance || '0');
    const safeBal = Number.isFinite(parsedBal) ? parsedBal : 0;

    const payload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      openingBalance: safeBal.toFixed(2),
      notes: notes.trim() || undefined,
    };

    await runSaveSupplier((onOptimistic) =>
      createSupplier(payload, {
        onOptimistic: () => {
          setIsNewSupplierOpen(false);
          setName('');
          setPhone('');
          setAddress('');
          setOpeningBalance('0');
          setNotes('');
          onOptimistic();
        },
      })
    );
  };

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
      render: (t) => (
        <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">
          {formatDate(t.transactionDate)}
        </span>
      ),
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (t) => (
        <span className="font-normal text-[#636B76] dark:text-[#A3AAB3]">{t.supplierName}</span>
      ),
    },
    {
      key: 'transactionType',
      header: 'Type',
      sortable: true,
      render: (t) => (
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-normal whitespace-nowrap ${
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
      render: (t) => (
        <span className="font-normal tabular-nums text-[#636B76] dark:text-[#A3AAB3]">
          {formatPKR(t.balanceAfter)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Remove',
      align: 'right',
      alwaysVisible: true,
      render: (t) => (
        <ConfirmDeleteButton
          ariaLabel={`Delete ledger entry ${t.supplierName || t.id}`}
          onConfirm={() => deleteDealerTransaction(t.id)}
        />
      ),
    },
  ];

  const inputCls =
    'w-full min-w-0 max-w-full block min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Dealers & Accounts
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Select any chicken supplier to see their balance, truck bills, and payment history together
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 w-full xl:w-auto xl:ml-auto">
          <button
            type="button"
            onClick={() => setIsNewSupplierOpen(true)}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            + Add Supplier
          </button>
          <button
            type="button"
            onClick={() => openPaymentModal()}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Dynamic KPI Strip (scoped to Selected Dealer or All Dealers) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-[20px] p-4 sm:p-5 bg-[#C9C3F5] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[132px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              {selectedSupplier ? 'Dealer Truck Bills' : 'Total Truck Bills'}
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-32 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black leading-none font-mono tabular-nums">
                {formatPKR(totalDebits)}
              </div>
            )}
            <p className="text-xs font-semibold opacity-85 mt-2 truncate">
              {selectedSupplier
                ? selectedSupplier.name
                : `Across ${suppliers.length} farm ${suppliers.length === 1 ? 'dealer' : 'dealers'}`}
            </p>
          </div>
        </div>

        <div className="rounded-[20px] p-4 sm:p-5 bg-[#92E2B3] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[132px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Total Paid
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-32 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black leading-none font-mono tabular-nums">
                {formatPKR(totalCredits)}
              </div>
            )}
            <p className="text-xs font-semibold opacity-85 mt-2">Cash & bank transfers sent</p>
          </div>
        </div>

        <div className="rounded-[20px] p-4 sm:p-5 bg-[#F6E7A1] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[132px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Still Owed
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-32 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black leading-none font-mono tabular-nums">
                {formatPKR(totalStillOwed)}
              </div>
            )}
            <p className="text-xs font-semibold opacity-85 mt-2">
              {selectedSupplier ? 'Remaining dealer balance' : 'Total owed to all dealers'}
            </p>
          </div>
        </div>
      </div>

      {/* Supplier Filter + Directory */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#636B76] dark:text-[#8A929C]" />
            <input
              type="text"
              placeholder="Search supplier name, phone, or city..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="w-full min-h-[40px] pl-9 pr-3.5 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              size="sm"
              value={balanceFilter}
              onChange={setBalanceFilter}
              options={[
                { value: 'ALL', label: 'All Balances' },
                { value: 'OWED', label: 'Money Still Owed' },
                { value: 'SETTLED', label: 'Paid Up / Zero' },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3">
          {selectedSupplier && (
            <button
              type="button"
              onClick={() => setSelectedSupplierId('ALL')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>All Dealers</span>
            </button>
          )}
          <span className="text-xs text-[#636B76] dark:text-[#8A929C] font-mono">
            {isInitialLoading
              ? '...'
              : `${filteredSuppliers.length} of ${suppliers.length} ${
                  suppliers.length === 1 ? 'dealer' : 'dealers'
                }`}
          </span>
        </div>
      </div>

      {/* Interactive Dealer Cards (click to dynamically inspect & filter ledger) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isInitialLoading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs"
            >
              <div className="h-4 w-40 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
              <div className="h-3 w-28 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
              <div className="h-12 w-full rounded-[14px] bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
            </div>
          ))
        ) : filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-[#636B76]">
            No suppliers match your search.
          </div>
        ) : (
          filteredSuppliers.map((sup) => {
            const isSelected =
              selectedSupplierId === String(sup.id) ||
              selectedSupplier?.id === sup.id;
            const bal = Number(sup.currentBalance ?? sup.openingBalance ?? 0);

            return (
              <div
                key={sup.id}
                onClick={() =>
                  setSelectedSupplierId(isSelected ? 'ALL' : String(sup.id))
                }
                className={`bg-white dark:bg-[#181B1F] rounded-[20px] p-4 sm:p-5 space-y-3 shadow-xs flex flex-col justify-between transition cursor-pointer ${
                  isSelected
                    ? 'border-2 border-[#14161A] dark:border-[#D4F56B] ring-2 ring-[#D4F56B]/30'
                    : 'border border-[#E3E6E8] dark:border-[#2A2F35] hover:border-black/25 dark:hover:border-white/25'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#14161A] dark:text-[#F2F4F5] text-sm leading-tight truncate">
                        {sup.name}
                      </h3>
                      {sup.notes && (
                        <p className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-0.5 truncate">
                          {sup.notes}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-[#D4F56B] text-[#14161A]'
                          : 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#4A515B] dark:text-[#A3AAB3]'
                      }`}
                    >
                      {isSelected
                        ? 'Selected'
                        : `${sup.purchaseCount} ${sup.purchaseCount === 1 ? 'truck' : 'trucks'}`}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4A515B] dark:text-[#A3AAB3]">
                    {sup.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-[#8A929C]" />
                        {sup.phone}
                      </span>
                    )}
                    {sup.address && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <MapPin className="w-3 h-3 text-[#8A929C] shrink-0" />
                        <span className="truncate">{sup.address}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-[#636B76] dark:text-[#8A929C]">
                      Still Owed
                    </div>
                    <div
                      className={`text-sm font-mono font-black tabular-nums ${
                        bal > 0 ? 'text-[#F5B544]' : 'text-[#2FB67C]'
                      }`}
                    >
                      {formatPKR(bal)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <ConfirmDeleteButton
                      compactSlot
                      ariaLabel={`Delete dealer ${sup.name}`}
                      onConfirm={() => {
                        if (selectedSupplierId === String(sup.id)) {
                          setSelectedSupplierId('ALL');
                        }
                        return deleteSupplier(sup.id);
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSupplierId(isSelected ? 'ALL' : String(sup.id));
                      }}
                      className="min-h-[34px] px-3 py-1 text-[11px] font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition cursor-pointer"
                    >
                      {isSelected ? 'All Dealers' : 'Ledger'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPaymentModal(sup.id);
                      }}
                      className="min-h-[34px] px-3.5 py-1 text-[11px] font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition cursor-pointer"
                    >
                      Pay
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Dealer Ledger DataTable */}
      <DataTable
        tableId="dealer-ledger"
        paginationEndpoint="/api/dealer-ledger"
        paginationParams={{
          ...(selectedSupplierId !== 'ALL' ? { supplierId: selectedSupplierId } : {}),
          ...(txTypeFilter !== 'ALL' ? { type: txTypeFilter } : {}),
        }}
        title={
          selectedSupplier
            ? `${selectedSupplier.name} — Account Ledger`
            : 'All Dealer Account Entries'
        }
        subtitle="Truck purchase bills and cash/bank payments sent to dealers"
        data={filteredTransactions}
        columns={columns}
        keyExtractor={(t) => t.id}
        loading={isInitialLoading}
        searchValue={ledgerSearch}
        onSearchChange={setLedgerSearch}
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
        mobileCardSubtitle={(t) =>
          `${formatDate(t.transactionDate)} · ${t.notes || t.referenceType}`
        }
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

      {/* MODAL 1: ADD SUPPLIER */}
      <Modal
        isOpen={isNewSupplierOpen}
        onClose={() => setIsNewSupplierOpen(false)}
        title="Add New Supplier"
        subtitle="Register a chicken dealer or farm"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">Supplier / Farm Name *</label>
            <input
              type="text"
              placeholder="e.g. Chaudhry Poultry Farms"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 0300-8451234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Farm City / Address</label>
            <input
              type="text"
              placeholder="e.g. Chak #42, Sargodha Road, Faisalabad"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Previous Balance Owed (PKR)</label>
            <input
              type="number"
              step="1"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Notes</label>
            <input
              type="text"
              placeholder="e.g. Main supplier for heavy broilers"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isSavingSupplier}
              onClick={() => setIsNewSupplierOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingSupplier}
              aria-busy={isSavingSupplier}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingSupplier ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: RECORD SUPPLIER PAYMENT */}
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

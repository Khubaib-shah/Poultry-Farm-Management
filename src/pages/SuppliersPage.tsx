import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  DollarSign,
} from 'lucide-react';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { formatPKR, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

interface SuppliersPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
  onOpenLedgerTab?: (supplierId?: number) => void;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer (HBL / Meezan)' },
  { value: 'CASH', label: 'Cash Payment' },
  { value: 'CHEQUE', label: 'Bank Cheque' },
  { value: 'OTHER', label: 'Other' },
];

export const SuppliersPage: React.FC<SuppliersPageProps> = ({
  onShowToast,
  onOpenLedgerTab,
}) => {
  const suppliers = useAppStore((s) => s.suppliers);
  const dealerTransactions = useAppStore((s) => s.dealerTransactions);
  const resolvedIdMap = useAppStore((s) => s.resolvedIdMap);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const isInitialLoading = loading && !initialized;
  const createSupplier = useAppStore((s) => s.createSupplier);
  const recordSupplierPayment = useAppStore((s) => s.recordSupplierPayment);

  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('ALL');

  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [notes, setNotes] = useState('');

  const [accountModalSupplierId, setAccountModalSupplierId] = useState<number | null>(null);
  const [payModalSupplierId, setPayModalSupplierId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => getLocalPakistanDate());
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentNotes, setPaymentNotes] = useState('');

  const { isSubmitting: isSavingSupplier, runOptimistic: runSaveSupplier } = useThrottledSubmit();
  const { isSubmitting: isSavingPayment, runOptimistic: runSavePayment } = useThrottledSubmit();

  const accountSupplier = useMemo(
    () =>
      accountModalSupplierId
        ? suppliers.find(
            (s) => s.id === accountModalSupplierId || s.id === resolvedIdMap[accountModalSupplierId]
          ) || null
        : null,
    [suppliers, accountModalSupplierId, resolvedIdMap]
  );

  const paySupplier = useMemo(
    () =>
      payModalSupplierId
        ? suppliers.find(
            (s) => s.id === payModalSupplierId || s.id === resolvedIdMap[payModalSupplierId]
          ) || null
        : null,
    [suppliers, payModalSupplierId, resolvedIdMap]
  );

  const supplierLedger = useMemo(() => {
    if (!accountSupplier) return { ledger: [], totalDebit: 0, totalCredit: 0 };
    const txs = dealerTransactions.filter(
      (t) =>
        t.supplierId === accountSupplier.id ||
        t.supplierId === accountModalSupplierId
    );
    const totalDebit = txs.reduce((s, t) => s + Number(t.debitAmount || 0), 0);
    const totalCredit = txs.reduce((s, t) => s + Number(t.creditAmount || 0), 0);
    return { ledger: txs, totalDebit, totalCredit };
  }, [dealerTransactions, accountSupplier, accountModalSupplierId]);

  const closePayModal = () => {
    setPayModalSupplierId(null);
    setPaymentAmount('');
    setPaymentNotes('');
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
    const targetSupplierId = paySupplier?.id ?? payModalSupplierId;
    const amt = parseFloat(paymentAmount);
    if (!targetSupplierId || !Number.isFinite(amt) || amt <= 0) {
      onShowToast('Please enter a valid payment amount', 'error');
      return;
    }

    const notesVal = paymentNotes || 'Supplier payment';

    await runSavePayment((onOptimistic) =>
      recordSupplierPayment(
        {
          supplierId: targetSupplierId,
          amount: amt,
          transactionDate: paymentDate,
          paymentMethod,
          notes: notesVal,
        },
        {
          onOptimistic: () => {
            closePayModal();
            onOptimistic();
          },
        }
      )
    );
  };

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q));
      const bal = Number(s.currentBalance || 0);
      const matchesBal =
        balanceFilter === 'ALL' ||
        (balanceFilter === 'OWED' && bal > 0) ||
        (balanceFilter === 'SETTLED' && bal <= 0);
      return matchesSearch && matchesBal;
    });
  }, [suppliers, searchQuery, balanceFilter]);

  const totalOwedAll = suppliers.reduce((sum, s) => sum + Number(s.currentBalance || 0), 0);

  const inputCls =
    'w-full min-w-0 max-w-full block min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Suppliers & Balances
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Track farm dealers you buy chickens from and how much money is owed to each
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 w-full xl:w-auto">
          {onOpenLedgerTab && (
            <button
              type="button"
              onClick={() => onOpenLedgerTab()}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-full bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] text-[#14161A] dark:text-[#F2F4F5] transition shadow-xs cursor-pointer text-center"
            >
              Dealer Accounts
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsNewSupplierOpen(true)}
            className={`min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs cursor-pointer ${
              onOpenLedgerTab ? '' : 'col-span-2'
            }`}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-[20px] p-5 bg-[#A9C8FA] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[126px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Total Suppliers
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-12 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[26px] font-black leading-none font-mono">{suppliers.length}</div>
            )}
            <p className="text-xs font-semibold opacity-85 mt-2">Active poultry farm dealers</p>
          </div>
        </div>

        <div className="rounded-[20px] p-5 bg-[#F6E7A1] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[126px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Total Owed to Dealers
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-36 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[26px] font-black leading-none font-mono">
                {formatPKR(totalOwedAll)}
              </div>
            )}
            <p className="text-xs font-semibold opacity-85 mt-2">Remaining unpaid supplier bills</p>
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#636B76] dark:text-[#8A929C]" />
            <input
              type="text"
              placeholder="Search supplier name or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[40px] pl-9 pr-3.5 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
            />
          </div>

          <div className="w-full sm:w-48">
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

        <span className="text-xs text-[#636B76] dark:text-[#8A929C] font-mono">
          {isInitialLoading ? '...' : `${filtered.length} of ${suppliers.length} suppliers`}
        </span>
      </div>

      {/* Supplier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isInitialLoading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                <div className="h-3 w-28 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                <div className="h-3 w-36 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
              </div>
              <div className="bg-[#F8F9FA] dark:bg-[#20242A] p-3 rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] space-y-2">
                <div className="h-3 w-full rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                <div className="h-3.5 w-3/4 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-9 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                <div className="w-16 h-9 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-[#636B76]">
            No suppliers match your search.
          </div>
        ) : (
          filtered.map((sup) => (
            <div
              key={sup.id}
              className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-[#14161A] dark:text-[#F2F4F5] text-sm leading-tight">
                      {sup.name}
                    </h3>
                    {sup.notes && (
                      <p className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-0.5">
                        {sup.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] font-mono font-bold shrink-0">
                    #{sup.id}
                  </span>
                </div>

                {sup.phone && (
                  <div className="text-xs text-[#4A515B] dark:text-[#A3AAB3] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#8A929C]" />
                    <span>{sup.phone}</span>
                  </div>
                )}

                {sup.address && (
                  <div className="text-xs text-[#4A515B] dark:text-[#A3AAB3] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#8A929C] shrink-0" />
                    <span className="truncate">{sup.address}</span>
                  </div>
                )}
              </div>

              <div className="bg-[#F8F9FA] dark:bg-[#20242A] p-3 rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Total Bought:</span>
                  <span className="font-mono font-medium">
                    {sup.purchaseCount} trucks ({formatPKR(sup.totalPurchasesAmount)})
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#E3E6E8] dark:border-[#2A2F35] pt-1.5">
                  <span className="font-semibold">Still Owed:</span>
                  <span className="font-mono font-black text-[#F5B544]">
                    {formatPKR(sup.currentBalance)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPayModalSupplierId(null);
                    setAccountModalSupplierId(sup.id);
                  }}
                  className="flex-1 min-h-[38px] py-1.5 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition cursor-pointer"
                >
                  View Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountModalSupplierId(null);
                    setPayModalSupplierId(sup.id);
                  }}
                  className="min-h-[38px] px-4 py-1.5 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition cursor-pointer"
                >
                  Pay
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="block text-xs font-bold mb-1.5">Old Balance (PKR)</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className={`${inputCls} font-mono`}
              />
              <p className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-1">
                Previous unpaid balance if any
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">City / Farm Location</label>
            <input
              type="text"
              placeholder="e.g. Kamoke, Gujranwala"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Pay within 3 days"
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

      {/* MODAL 2: SUPPLIER ACCOUNT HISTORY */}
      {accountSupplier && !paySupplier && (
        <Modal
          isOpen={Boolean(accountSupplier && !paySupplier)}
          onClose={() => setAccountModalSupplierId(null)}
          title={`Account: ${accountSupplier.name}`}
          subtitle="Bills, payments sent, and remaining balance"
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8F9FA] dark:bg-[#20242A] p-4 rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35]">
              <div>
                <span className="text-[10px] text-[#636B76] uppercase font-bold">Old Balance</span>
                <div className="font-bold font-mono mt-0.5">
                  {formatPKR(accountSupplier.openingBalance)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[#636B76] uppercase font-bold">Total Billed</span>
                <div className="font-bold font-mono mt-0.5">
                  {formatPKR(supplierLedger.totalDebit)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[#636B76] uppercase font-bold">Total Paid</span>
                <div className="font-bold font-mono text-[#2FB67C] mt-0.5">
                  {formatPKR(supplierLedger.totalCredit)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-[#636B76] uppercase font-bold">Owed Now</span>
                <div className="font-black font-mono text-[#F5B544] text-sm mt-0.5">
                  {formatPKR(accountSupplier.currentBalance)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-bold uppercase tracking-wider text-[11px]">
                Recent Entries
              </span>
              <button
                type="button"
                onClick={() => setPayModalSupplierId(accountSupplier.id)}
                className="px-4 py-1.5 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] cursor-pointer"
              >
                + Record Payment
              </button>
            </div>

            <div className="border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[16px] max-h-64 overflow-y-auto divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
              {supplierLedger.ledger.length === 0 ? (
                <div className="p-6 text-center text-[#636B76]">No entries yet.</div>
              ) : (
                supplierLedger.ledger.map((t) => (
                  <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {t.transactionType === 'PURCHASE_DEBIT' ? 'Truck Bill' : 'Payment Sent'} ·{' '}
                        <span className="font-mono font-normal text-[#636B76]">
                          {formatDate(t.transactionDate)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#636B76] truncate">
                        {t.notes || t.referenceType}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono font-bold ${
                          Number(t.creditAmount) > 0 ? 'text-[#2FB67C]' : ''
                        }`}
                      >
                        {Number(t.debitAmount) > 0
                          ? `+${formatPKR(t.debitAmount)}`
                          : `-${formatPKR(t.creditAmount)}`}
                      </div>
                      <div className="text-[10px] text-[#636B76] font-mono">
                        Bal: {formatPKR(t.balanceAfter)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAccountModalSupplierId(null)}
                className="min-h-[40px] px-5 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: RECORD SUPPLIER PAYMENT */}
      <Modal
        isOpen={Boolean(paySupplier)}
        onClose={closePayModal}
        title={`Pay ${paySupplier?.name || 'Supplier'}`}
        subtitle="Subtracts payment from what you owe this dealer"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
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

          <div>
            <label className="block text-xs font-bold mb-1.5">Amount Paid (PKR) *</label>
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

          <div>
            <label className="block text-xs font-bold mb-1.5">Paid By *</label>
            <Select
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={PAYMENT_METHOD_OPTIONS}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Slip # / Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. HBL Slip #88921"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isSavingPayment}
              onClick={closePayModal}
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

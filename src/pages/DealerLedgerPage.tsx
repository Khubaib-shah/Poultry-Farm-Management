import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import { DealerTransaction, Supplier } from '../types/index.ts';
import { api } from '../services/api.ts';
import { Modal } from '../components/common/Modal.tsx';
import { formatPKR, formatNumber, formatDate, formatDateTime } from '../utils/formatters.ts';

interface DealerLedgerPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
  selectedSupplierId?: number;
}

export const DealerLedgerPage: React.FC<DealerLedgerPageProps> = ({
  onShowToast,
  selectedSupplierId: initialSupplierId,
}) => {
  const [transactions, setTransactions] = useState<DealerTransaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initialSupplierId ? String(initialSupplierId) : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentSupplierId, setPaymentSupplierId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const supId = selectedSupplierId !== 'ALL' ? parseInt(selectedSupplierId, 10) : undefined;
      const [txs, sups] = await Promise.all([
        api.getDealerTransactions(supId),
        api.getSuppliers(),
      ]);
      setTransactions(txs);
      setSuppliers(sups);
      if (sups.length > 0 && !paymentSupplierId) {
        setPaymentSupplierId(String(sups[0].id));
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to fetch dealer ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSupplierId]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupplierId || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      onShowToast('Please select supplier and enter valid amount', 'error');
      return;
    }

    try {
      setSubmittingPayment(true);
      await api.recordSupplierPayment({
        supplierId: parseInt(paymentSupplierId, 10),
        amount: parseFloat(paymentAmount),
        transactionDate: paymentDate,
        paymentMethod,
        notes: paymentNotes || 'Supplier payment credit',
      });

      onShowToast('Payment to supplier recorded in dealer ledger!', 'success');
      setIsPaymentOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      await fetchData();
    } catch (err: any) {
      onShowToast(err.message || 'Payment recording failed', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Compute totals
  let totalDebits = 0;
  let totalCredits = 0;
  transactions.forEach((t) => {
    totalDebits += Number(t.debitAmount);
    totalCredits += Number(t.creditAmount);
  });

  const filtered = transactions.filter(
    (t) =>
      (t.supplierName && t.supplierName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Dealer Debit & Credit Ledger
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Official credit and debit statement for poultry dealers in Punjab. No double counting of expenses.
          </p>
        </div>

        <button
          onClick={() => setIsPaymentOpen(true)}
          className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Record Supplier Payment
        </button>
      </div>

      {/* Summary KPI Cards - Pastel Island Trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Pastel Lavender */}
        <div className="rounded-[20px] p-5 bg-[#C9C3F5] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Total Purchase Debits
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none font-mono">
              {formatPKR(totalDebits)}
            </div>
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              Amounts owed from live chicken loads
            </p>
          </div>
        </div>

        {/* Card 2: Pastel Mint */}
        <div className="rounded-[20px] p-5 bg-[#92E2B3] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Total Payments Credited
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none font-mono">
              {formatPKR(totalCredits)}
            </div>
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              Cash and bank transfers paid to suppliers
            </p>
          </div>
        </div>

        {/* Card 3: Pastel Butter */}
        <div className="rounded-[20px] p-5 bg-[#F6E7A1] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Net Outstanding Balance
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none font-mono">
              {formatPKR(totalDebits - totalCredits)}
            </div>
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              Debits minus credits across selection
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5]">Supplier:</span>
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="px-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
          >
            <option value="ALL">All Punjab Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (Balance: {formatPKR(s.currentBalance)})
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#636B76] dark:text-[#8A929C]" />
          <input
            type="text"
            placeholder="Search notes or references..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
          />
        </div>
      </div>

      {/* Transactions Table Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35] text-[#4A515B] dark:text-[#A3AAB3] font-bold uppercase text-[11px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Supplier Name</th>
                <th className="py-2.5 px-3">Transaction Type</th>
                <th className="py-2.5 px-3">Description / Reference</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3 text-right">Debit (+)</th>
                <th className="py-2.5 px-3 text-right">Credit (-)</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading dealer ledger...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No transactions found for the selected supplier.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-600 font-mono">
                      {formatDate(t.transactionDate)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {t.supplierName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.transactionType === 'PURCHASE_DEBIT'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {t.transactionType === 'PURCHASE_DEBIT' ? 'Purchase (Debit)' : 'Payment (Credit)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[240px] truncate">
                      {t.notes || t.referenceType}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {t.paymentMethod || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(t.debitAmount) > 0 ? formatPKR(t.debitAmount) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {Number(t.creditAmount) > 0 ? formatPKR(t.creditAmount) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatPKR(t.balanceAfter)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title="Record Supplier Payment"
        subtitle="Credits the supplier ledger and reduces outstanding balance"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Supplier *
            </label>
            <select
              value={paymentSupplierId}
              onChange={(e) => setPaymentSupplierId(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Current Balance: {formatPKR(s.currentBalance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Amount (PKR) *
            </label>
            <input
              type="number"
              placeholder="e.g. 500000"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              min="1"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            >
              <option value="BANK_TRANSFER">Bank Online Transfer (HBL / Meezan)</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Bank Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reference / Bank Slip Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Online transfer ref #902188"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsPaymentOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingPayment}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submittingPayment ? 'Saving...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

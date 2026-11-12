import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  BookOpen,
  DollarSign,
  FileText,
  Truck,
  CreditCard,
} from 'lucide-react';
import { Supplier, DealerTransaction, PurchaseLoad } from '../types/index.ts';
import { api } from '../services/api.ts';
import { Modal } from '../components/common/Modal.tsx';
import { formatPKR, formatNumber, formatDate } from '../utils/formatters.ts';

interface SuppliersPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
  onOpenLedgerTab?: (supplierId?: number) => void;
}

export const SuppliersPage: React.FC<SuppliersPageProps> = ({
  onShowToast,
  onOpenLedgerTab,
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Supplier Details Modal
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [supplierDetails, setSupplierDetails] = useState<{
    supplier: Supplier;
    currentBalance: number;
    totalDebit: number;
    totalCredit: number;
    ledger: DealerTransaction[];
    purchaseLoads: PurchaseLoad[];
  } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Quick Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.getSuppliers();
      setSuppliers(res);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to fetch suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openSupplierDetails = async (id: number) => {
    try {
      setSelectedSupplierId(id);
      setDetailsLoading(true);
      const res = await api.getSupplier(id);
      setSupplierDetails(res);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to fetch supplier details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('Supplier name is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const created = await api.createSupplier({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        openingBalance: parseFloat(openingBalance || '0').toFixed(2),
        notes: notes.trim() || undefined,
      });

      onShowToast(`Supplier "${created.name}" created successfully!`, 'success');
      setIsNewSupplierOpen(false);
      setName('');
      setPhone('');
      setAddress('');
      setOpeningBalance('0');
      setNotes('');
      await fetchSuppliers();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to create supplier', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      onShowToast('Please enter a valid payment amount', 'error');
      return;
    }

    try {
      setSubmittingPayment(true);
      await api.recordSupplierPayment({
        supplierId: selectedSupplierId,
        amount: parseFloat(paymentAmount),
        transactionDate: paymentDate,
        paymentMethod,
        notes: paymentNotes || 'Partial bank payment',
      });

      onShowToast('Payment to supplier recorded in dealer ledger!', 'success');
      setIsPaymentOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      await fetchSuppliers();
      if (selectedSupplierId) {
        openSupplierDetails(selectedSupplierId);
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalOwedAll = suppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Supplier Directory & Balances
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Manage Punjab farm suppliers, monitor total purchases, and track running credit/debit balances
          </p>
        </div>

        <button
          onClick={() => setIsNewSupplierOpen(true)}
          className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add New Supplier
        </button>
      </div>

      {/* Summary KPI Strip - Pastel Island Trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Pastel Sky */}
        <div className="rounded-[20px] p-5 bg-[#A9C8FA] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Total Active Suppliers
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none font-mono">
              {suppliers.length}
            </div>
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">Punjab poultry farms & hatcheries</p>
          </div>
        </div>

        {/* Card 2: Pastel Butter */}
        <div className="rounded-[20px] p-5 bg-[#F6E7A1] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Total Balance Owed to Dealers
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none font-mono">
              {formatPKR(totalOwedAll)}
            </div>
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">Sum of all outstanding supplier payables</p>
          </div>
        </div>

        {/* Card 3: Floating Island Action */}
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 shadow-xs flex flex-col justify-between h-[150px]">
          <div>
            <span className="text-[11px] font-extrabold text-[#636B76] dark:text-[#8A929C] uppercase tracking-[0.08em]">
              Supplier Ledger
            </span>
            <div className="text-xs font-semibold text-[#14161A] dark:text-[#F2F4F5] mt-1">
              View complete debit/credit transaction history
            </div>
          </div>
          {onOpenLedgerTab && (
            <button
              onClick={() => onOpenLedgerTab()}
              className="w-full inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A] transition shadow-xs"
            >
              Open Dealer Ledger
            </button>
          )}
        </div>
      </div>

      {/* Search Bar Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#636B76] dark:text-[#8A929C]" />
          <input
            type="text"
            placeholder="Search supplier name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
          />
        </div>
        <span className="text-xs text-[#636B76] dark:text-[#8A929C] font-mono">
          Showing {filtered.length} of {suppliers.length} suppliers
        </span>
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-8 text-center text-[#636B76] dark:text-[#8A929C] text-xs">
            Loading suppliers...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-8 text-center text-[#636B76] dark:text-[#8A929C] text-xs">
            No suppliers found. Click "Add New Supplier" to create one.
          </div>
        ) : (
          filtered.map((sup) => (
            <div
              key={sup.id}
              className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 hover:border-black/20 dark:hover:border-white/20 transition shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{sup.name}</h3>
                    {sup.notes && <p className="text-[11px] text-slate-500 mt-0.5">{sup.notes}</p>}
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold">
                    ID #{sup.id}
                  </span>
                </div>

                {sup.phone && (
                  <div className="text-xs text-slate-600 flex items-center">
                    <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    <span>{sup.phone}</span>
                  </div>
                )}

                {sup.address && (
                  <div className="text-xs text-slate-600 flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                    <span className="truncate">{sup.address}</span>
                  </div>
                )}
              </div>

              {/* Financial Box */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Purchases:</span>
                  <span className="font-mono font-medium text-slate-800">
                    {sup.purchaseCount} loads ({formatPKR(sup.totalPurchasesAmount)})
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="font-semibold text-slate-700">Outstanding Balance:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {formatPKR(sup.currentBalance)}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => openSupplierDetails(sup.id)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition text-center"
                >
                  View Details & Ledger
                </button>
                <button
                  onClick={() => {
                    setSelectedSupplierId(sup.id);
                    setIsPaymentOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  Pay
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: ADD NEW SUPPLIER */}
      <Modal
        isOpen={isNewSupplierOpen}
        onClose={() => setIsNewSupplierOpen(false)}
        title="Add New Supplier"
        subtitle="Register live chicken supplier from Punjab"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier / Farm Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Chaudhry Poultry Farms"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. 0300-8451234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Opening Balance (PKR)
              </label>
              <input
                type="number"
                placeholder="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Farm / City Address
            </label>
            <input
              type="text"
              placeholder="e.g. Kamoke G.T. Road, Gujranwala, Punjab"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Heavy bird supplier, payment terms 3 days"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewSupplierOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: SUPPLIER DETAILS & LEDGER VIEW */}
      {selectedSupplierId && supplierDetails && (
        <Modal
          isOpen={Boolean(selectedSupplierId && !isPaymentOpen)}
          onClose={() => {
            setSelectedSupplierId(null);
            setSupplierDetails(null);
          }}
          title={`Supplier Details: ${supplierDetails.supplier.name}`}
          subtitle="Complete debit & credit ledger, purchases, and balance"
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Opening Balance
                </span>
                <div className="font-bold text-slate-800 font-mono">
                  {formatPKR(supplierDetails.supplier.openingBalance)}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Total Debits (Purchases)
                </span>
                <div className="font-bold text-slate-900 font-mono">
                  {formatPKR(supplierDetails.totalDebit)}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Total Credits (Payments)
                </span>
                <div className="font-bold text-emerald-700 font-mono">
                  {formatPKR(supplierDetails.totalCredit)}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Current Balance Owed
                </span>
                <div className="font-bold text-amber-700 font-mono text-sm">
                  {formatPKR(supplierDetails.currentBalance)}
                </div>
              </div>
            </div>

            {/* Actions Strip */}
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Debit & Credit Transaction Ledger
              </span>
              <button
                onClick={() => setIsPaymentOpen(true)}
                className="px-3 py-1 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Record Payment
              </button>
            </div>

            {/* Ledger Table */}
            <div className="border border-slate-200 rounded max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Debit (+)</th>
                    <th className="py-2 px-3 text-right">Credit (-)</th>
                    <th className="py-2 px-3 text-right font-bold text-slate-900">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierDetails.ledger.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-600 font-mono">{formatDate(t.transactionDate)}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{t.transactionType}</td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[180px]">
                        {t.notes || t.referenceType}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-900">
                        {Number(t.debitAmount) > 0 ? formatPKR(t.debitAmount) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                        {Number(t.creditAmount) > 0 ? formatPKR(t.creditAmount) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatPKR(t.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setSelectedSupplierId(null);
                  setSupplierDetails(null);
                }}
                className="px-4 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: RECORD SUPPLIER PAYMENT */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title="Record Supplier Payment"
        subtitle="Credits the supplier ledger and reduces balance owed"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
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
              <option value="CASH">Cash Payment</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reference / Bank Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. HBL Slip #88921"
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
              {submittingPayment ? 'Processing...' : 'Confirm Supplier Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

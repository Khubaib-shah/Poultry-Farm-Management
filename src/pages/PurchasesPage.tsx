import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Package,
  Trash2,
  Receipt,
  Scale,
} from 'lucide-react';
import { PurchaseLoad, Supplier, Vehicle, LoadExpense } from '../types/index.ts';
import { api } from '../services/api.ts';
import { Modal } from '../components/common/Modal.tsx';
import { formatPKR, formatNumber, formatDate } from '../utils/formatters.ts';
import {
  calculatePurchaseRate,
  calculateSaleablePieces,
  calculateLandedCost,
  calculateCostPerPiece,
} from '../utils/poultryMath.ts';

interface PurchasesPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
  initialOpenNewModal?: boolean;
}

export const PurchasesPage: React.FC<PurchasesPageProps> = ({
  onShowToast,
  initialOpenNewModal = false,
}) => {
  const [loads, setLoads] = useState<PurchaseLoad[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isNewLoadOpen, setIsNewLoadOpen] = useState(initialOpenNewModal);
  const [selectedLoadId, setSelectedLoadId] = useState<number | null>(null);
  const [loadDetails, setLoadDetails] = useState<PurchaseLoad | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Receiving Modal
  const [isReceivingOpen, setIsReceivingOpen] = useState(false);
  const [receivingLoad, setReceivingLoad] = useState<PurchaseLoad | null>(null);

  // Form states for New Load
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [totalWeightKg, setTotalWeightKg] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states for Add Expense
  const [expenseCategory, setExpenseCategory] = useState('Fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [addingExpense, setAddingExpense] = useState(false);

  // Form states for Receiving
  const [recvDate, setRecvDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receivedPieces, setReceivedPieces] = useState('');
  const [deadPieces, setDeadPieces] = useState('0');
  const [damagedPieces, setDamagedPieces] = useState('0');
  const [receivingNotes, setReceivingNotes] = useState('');
  const [receivingSubmitting, setReceivingSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [loadsRes, supsRes, vehsRes] = await Promise.all([
        api.getPurchases(),
        api.getSuppliers(),
        api.getVehicles(),
      ]);
      setLoads(loadsRes);
      setSuppliersList(supsRes);
      setVehiclesList(vehsRes);
      if (supsRes.length > 0 && !supplierId) {
        setSupplierId(String(supsRes[0].id));
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to fetch purchases', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openLoadDetails = async (id: number) => {
    try {
      setSelectedLoadId(id);
      setDetailsLoading(true);
      const res = await api.getPurchase(id);
      setLoadDetails(res);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to fetch load details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCreateLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !totalWeightKg || !purchaseAmount) {
      onShowToast('Please fill all required purchase load fields', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const created = await api.createPurchase({
        supplierId: parseInt(supplierId, 10),
        purchaseDate,
        totalWeightKg: parseFloat(totalWeightKg),
        purchaseAmount: parseFloat(purchaseAmount),
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
        notes: notes || undefined,
      });

      onShowToast(`Purchase Load ${created.loadNumber} created successfully!`, 'success');
      setIsNewLoadOpen(false);
      // Reset
      setTotalWeightKg('');
      setPurchaseAmount('');
      setVehicleNumber('');
      setDriverName('');
      setNotes('');
      await fetchData();
      openLoadDetails(created.id);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to create purchase load', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLoadExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoadId || !expenseAmount || parseFloat(expenseAmount) <= 0) {
      onShowToast('Please enter a valid expense amount', 'error');
      return;
    }

    try {
      setAddingExpense(true);
      await api.addLoadExpense(selectedLoadId, {
        category: expenseCategory,
        amount: parseFloat(expenseAmount),
        expenseDate,
        description: expenseDesc || undefined,
      });
      onShowToast('Load expense added successfully', 'success');
      setExpenseAmount('');
      setExpenseDesc('');
      // Reload details and list
      const updated = await api.getPurchase(selectedLoadId);
      setLoadDetails(updated);
      fetchData();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to add load expense', 'error');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!selectedLoadId) return;
    if (!confirm('Are you sure you want to remove this expense?')) return;
    try {
      await api.deleteLoadExpense(selectedLoadId, expenseId);
      onShowToast('Expense removed', 'success');
      const updated = await api.getPurchase(selectedLoadId);
      setLoadDetails(updated);
      fetchData();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to delete expense', 'error');
    }
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
      onShowToast('Please enter the actual received pieces counted', 'error');
      return;
    }

    try {
      setReceivingSubmitting(true);
      const batch = await api.receiveStock(receivingLoad.id, {
        receivingDate: recvDate,
        receivedPieces: pieces,
        deadPieces: parseInt(deadPieces || '0', 10),
        damagedPieces: parseInt(damagedPieces || '0', 10),
        notes: receivingNotes || undefined,
      });

      onShowToast(
        `Stock Batch ${batch.batchNumber} generated! ${batch.originalSaleablePieces} saleable pieces in inventory.`,
        'success'
      );
      setIsReceivingOpen(false);
      await fetchData();
      if (selectedLoadId === receivingLoad.id) {
        openLoadDetails(receivingLoad.id);
      }
    } catch (err: any) {
      onShowToast(err.message || 'Stock receiving failed', 'error');
    } finally {
      setReceivingSubmitting(false);
    }
  };

  // Filtered loads
  const filteredLoads = loads.filter((load) => {
    const matchesSearch =
      load.loadNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      load.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (load.vehicleNumber && load.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || load.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate live preview rate for new load
  const liveRatePerKg =
    parseFloat(totalWeightKg) > 0 && parseFloat(purchaseAmount) > 0
      ? calculatePurchaseRate(parseFloat(purchaseAmount), parseFloat(totalWeightKg))
      : 0;

  // Calculate live saleable pieces for receiving
  const liveReceived = parseInt(receivedPieces || '0', 10);
  const liveDead = parseInt(deadPieces || '0', 10);
  const liveDamaged = parseInt(damagedPieces || '0', 10);
  const liveSaleable = calculateSaleablePieces(liveReceived, liveDead, liveDamaged);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Purchases & Loads Management
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Record live broiler weight from Punjab, track vehicle transit expenses, and receive inventory batches
          </p>
        </div>

        <button
          onClick={() => setIsNewLoadOpen(true)}
          className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Purchase Load
        </button>
      </div>

      {/* Filter and Search Bar Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#636B76] dark:text-[#8A929C]" />
            <input
              type="text"
              placeholder="Search load #, supplier, vehicle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
            />
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-xs">
          <span className="font-semibold text-[#636B76] dark:text-[#8A929C] mr-1">Status:</span>
          {['ALL', 'PENDING_RECEIVING', 'RECEIVED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider transition ${
                statusFilter === s
                  ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
                  : 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
              }`}
            >
              {s === 'ALL' ? 'ALL' : s === 'PENDING_RECEIVING' ? 'PENDING RECEIVING' : 'RECEIVED'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35] text-[#4A515B] dark:text-[#A3AAB3] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Load Number</th>
                <th className="py-2.5 px-3">Supplier</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Weight (KG)</th>
                <th className="py-2.5 px-3 text-right">Rate / KG</th>
                <th className="py-2.5 px-3 text-right">Purchase Amount</th>
                <th className="py-2.5 px-3 text-right">Load Expenses</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-800">Landed Cost</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[#636B76] dark:text-[#8A929C]">
                    Loading purchase loads...
                  </td>
                </tr>
              ) : filteredLoads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[#636B76] dark:text-[#8A929C]">
                    No purchase loads found. Click "New Purchase Load" to record your first vehicle arrival.
                  </td>
                </tr>
              ) : (
                filteredLoads.map((load) => (
                  <tr key={load.id} className="hover:bg-[#F8F9FA] dark:hover:bg-[#20242A]/60 transition">
                    <td className="py-3 px-3 font-bold text-[#14161A] dark:text-[#F2F4F5] font-mono">
                      {load.loadNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#14161A] dark:text-[#F2F4F5]">{load.supplierName}</div>
                      {load.vehicleNumber && (
                        <div className="text-[10px] text-[#636B76] dark:text-[#8A929C] font-mono">
                          {load.vehicleNumber} {load.driverName ? `(${load.driverName})` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#4A515B] dark:text-[#A3AAB3]">{formatDate(load.purchaseDate)}</td>
                    <td className="py-3 px-3 text-right font-mono text-[#14161A] dark:text-[#F2F4F5]">
                      {formatNumber(load.totalWeightKg)} KG
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#4A515B] dark:text-[#A3AAB3]">
                      {formatPKR(load.purchaseRatePerKg)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#14161A] dark:text-[#F2F4F5] font-mono">
                      {formatPKR(load.purchaseAmount)}
                    </td>
                    <td className="py-3 px-3 text-right text-[#4A515B] dark:text-[#A3AAB3] font-mono">
                      {formatPKR(load.totalExpenses || 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-[#14161A] dark:text-[#D4F56B] font-mono">
                      {formatPKR(load.totalLandedCost || load.purchaseAmount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                          load.status === 'RECEIVED'
                            ? 'bg-[#92E2B3]/25 text-emerald-800 dark:text-[#92E2B3] border border-[#92E2B3]/40'
                            : 'bg-[#F6E7A1]/30 text-amber-900 dark:text-[#F6E7A1] border border-[#F6E7A1]/50'
                        }`}
                      >
                        {load.status === 'RECEIVED' ? 'STOCK RECEIVED' : 'PENDING COUNT'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      {load.status !== 'RECEIVED' && (
                        <button
                          onClick={() => openReceivingForm(load)}
                          className="px-3 py-1 text-[11px] font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs"
                        >
                          Receive Stock
                        </button>
                      )}
                      <button
                        onClick={() => openLoadDetails(load.id)}
                        className="px-3 py-1 text-[11px] font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition"
                      >
                        Details & Expenses
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: NEW PURCHASE LOAD */}
      <Modal
        isOpen={isNewLoadOpen}
        onClose={() => setIsNewLoadOpen(false)}
        title="Record New Purchase Load"
        subtitle="Live chicken purchase recorded in KG directly from Punjab supplier"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLoad} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier (Punjab Dealer) *
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {suppliersList.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name} {sup.phone ? `(${sup.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purchase Date *
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Weight in KG *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 4500"
                  value={totalWeightKg}
                  onChange={(e) => setTotalWeightKg(e.target.value)}
                  required
                  className="w-full pl-3 pr-8 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono"
                />
                <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-bold">
                  KG
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Total weight of live birds on vehicle scale
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Purchase Amount (PKR) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  placeholder="e.g. 1350000"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  required
                  className="w-full pl-3 pr-10 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold">
                  PKR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Total PKR owed to supplier for this load
              </p>
            </div>
          </div>

          {/* Auto Calculation Preview */}
          <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-600 font-medium">
              Calculated Rate per KG:
            </span>
            <span className="text-sm font-bold text-emerald-700 font-mono">
              {liveRatePerKg > 0 ? formatPKR(liveRatePerKg) + ' / KG' : 'Enter weight & amount'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vehicle Number
              </label>
              <input
                type="text"
                placeholder="e.g. LES-4921"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 uppercase font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Driver Name
              </label>
              <input
                type="text"
                placeholder="e.g. Muhammad Aslam"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Heavy broiler batch from Gujranwala farm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewLoadOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Saving Load...' : 'Save Purchase Load'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: STOCK RECEIVING FORM */}
      <Modal
        isOpen={isReceivingOpen}
        onClose={() => setIsReceivingOpen(false)}
        title={`Receive Stock Count: ${receivingLoad?.loadNumber || ''}`}
        subtitle="Count actual live pieces on arrival to establish saleable inventory pieces"
        maxWidth="md"
      >
        <form onSubmit={handleReceiveStock} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Supplier:</span>
              <span className="font-semibold text-slate-800">{receivingLoad?.supplierName}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Billed Weight:</span>
              <span className="font-mono font-medium text-slate-800">
                {receivingLoad ? formatNumber(receivingLoad.totalWeightKg) : 0} KG
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Purchase Amount:</span>
              <span className="font-mono font-bold text-slate-900">
                {receivingLoad ? formatPKR(receivingLoad.purchaseAmount) : 0}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receiving Date *
            </label>
            <input
              type="date"
              value={recvDate}
              onChange={(e) => setRecvDate(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Total Received Pieces Counted *
            </label>
            <input
              type="number"
              placeholder="e.g. 900"
              value={receivedPieces}
              onChange={(e) => setReceivedPieces(e.target.value)}
              required
              min="1"
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono font-bold"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">
              Physical piece count unloaded from the vehicle cages
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dead Pieces (Mortality)
              </label>
              <input
                type="number"
                value={deadPieces}
                onChange={(e) => setDeadPieces(e.target.value)}
                min="0"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Damaged / Bruised Pieces
              </label>
              <input
                type="number"
                value={damagedPieces}
                onChange={(e) => setDamagedPieces(e.target.value)}
                min="0"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono"
              />
            </div>
          </div>

          {/* Automatic Calculation of Saleable Pieces */}
          <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-900">
                Calculated Saleable Pieces:
              </span>
              <span className="text-base font-bold text-emerald-800 font-mono">
                {liveSaleable} pieces
              </span>
            </div>
            <p className="text-[10px] text-emerald-700 mt-0.5">
              Formula: Received ({liveReceived}) - Dead ({liveDead}) - Damaged ({liveDamaged})
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receiving Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Good health, average piece size 2.1 KG"
              value={receivingNotes}
              onChange={(e) => setReceivingNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsReceivingOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={receivingSubmitting || liveSaleable <= 0}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {receivingSubmitting ? 'Creating Batch...' : 'Confirm Stock Receiving'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: LOAD DETAILS & EXPENSES DRAWER */}
      {selectedLoadId && (
        <Modal
          isOpen={Boolean(selectedLoadId)}
          onClose={() => {
            setSelectedLoadId(null);
            setLoadDetails(null);
          }}
          title={`Load Details: ${loadDetails?.loadNumber || 'Loading...'}`}
          subtitle="Full landed cost breakdown, transport expenses, and batch status"
          maxWidth="2xl"
        >
          {detailsLoading || !loadDetails ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading details...</div>
          ) : (
            <div className="space-y-5 text-xs">
              {/* Load Top Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded border border-slate-200">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Supplier</div>
                  <div className="font-bold text-slate-900 truncate">{loadDetails.supplierName}</div>
                  <div className="text-[10px] text-slate-500">{loadDetails.supplierPhone || '-'}</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Billed Weight</div>
                  <div className="font-bold text-slate-900 font-mono">
                    {formatNumber(loadDetails.totalWeightKg)} KG
                  </div>
                  <div className="text-[10px] text-slate-500">
                    @ {formatPKR(loadDetails.purchaseRatePerKg)} / KG
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Purchase Cost</div>
                  <div className="font-bold text-slate-900 font-mono">
                    {formatPKR(loadDetails.purchaseAmount)}
                  </div>
                  <div className="text-[10px] text-slate-500">Date: {formatDate(loadDetails.purchaseDate)}</div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Vehicle & Driver</div>
                  <div className="font-bold text-slate-900 font-mono">
                    {loadDetails.vehicleNumber || 'No vehicle'}
                  </div>
                  <div className="text-[10px] text-slate-500">{loadDetails.driverName || 'No driver'}</div>
                </div>
              </div>

              {/* Stock Receiving Status Banner */}
              <div
                className={`p-3 rounded border flex items-center justify-between ${
                  loadDetails.stockBatch
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center">
                    {loadDetails.stockBatch ? (
                      <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mr-1 text-amber-600" />
                    )}
                    {loadDetails.stockBatch
                      ? `Batch Created: ${loadDetails.stockBatch.batchNumber}`
                      : 'Stock Not Received Yet'}
                  </div>
                  {loadDetails.stockBatch && (
                    <div className="text-[11px] text-emerald-800 mt-0.5">
                      Received: {loadDetails.stockBatch.receivedPieces} pcs | Dead:{' '}
                      {loadDetails.stockBatch.deadPieces} | Damaged:{' '}
                      {loadDetails.stockBatch.damagedPieces} |{' '}
                      <strong>Saleable: {loadDetails.stockBatch.originalSaleablePieces} pcs</strong> (
                      {loadDetails.stockBatch.remainingPieces} remaining)
                    </div>
                  )}
                </div>

                {!loadDetails.stockBatch && (
                  <button
                    onClick={() => openReceivingForm(loadDetails)}
                    className="px-3 py-1 bg-emerald-600 text-white font-bold rounded text-xs hover:bg-emerald-700 shadow-xs"
                  >
                    Receive Stock Now
                  </button>
                )}
              </div>

              {/* Financial Landed Cost Box */}
              <div className="bg-[#14161A] text-[#F2F4F5] p-5 rounded-[18px] border border-[#2A2F35] shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8A929C] tracking-wider">
                      Total Purchase (PKR)
                    </span>
                    <div className="text-lg font-black text-white font-mono mt-0.5">
                      {formatPKR(loadDetails.purchaseAmount)}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8A929C] tracking-wider">
                      Total Load Expenses (+)
                    </span>
                    <div className="text-lg font-black text-[#F6E7A1] font-mono mt-0.5">
                      {formatPKR(loadDetails.totalExpenses || 0)}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8A929C] tracking-wider">
                      Total Landed Cost (=)
                    </span>
                    <div className="text-lg font-black text-[#D4F56B] font-mono mt-0.5">
                      {formatPKR(loadDetails.totalLandedCost || loadDetails.purchaseAmount)}
                    </div>
                  </div>
                </div>

                {loadDetails.stockBatch && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-[#8A929C]">
                      Cost Per Saleable Piece (Landed Cost ÷ {loadDetails.stockBatch.originalSaleablePieces} pcs):
                    </span>
                    <span className="text-sm font-black text-[#D4F56B] font-mono">
                      {formatPKR(loadDetails.stockBatch.costPerPiece)} / piece
                    </span>
                  </div>
                )}
              </div>

              {/* Load Expenses Section */}
              <div className="border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[18px] overflow-hidden">
                <div className="px-4 py-3 bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between">
                  <span className="font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider text-[11px]">
                    Vehicle & Transit Expenses
                  </span>
                  <span className="text-xs font-mono font-black text-[#14161A] dark:text-[#D4F56B]">
                    Total: {formatPKR(loadDetails.totalExpenses || 0)}
                  </span>
                </div>

                {/* Expenses Table */}
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(loadDetails.expenses || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          No transit expenses recorded yet. Use the form below to add fuel, driver bhatta, etc.
                        </td>
                      </tr>
                    ) : (
                      (loadDetails.expenses || []).map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {exp.category}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{formatDate(exp.expenseDate)}</td>
                          <td className="py-2 px-3 text-slate-500">{exp.description || '-'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatPKR(exp.amount)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Delete expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Add Expense Mini-Form */}
                <form
                  onSubmit={handleAddLoadExpense}
                  className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center gap-2"
                >
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
                  >
                    <option value="Fuel">Fuel (Diesel)</option>
                    <option value="Transportation">Transportation Fare</option>
                    <option value="Loading">Farm Loading</option>
                    <option value="Unloading">Shop Unloading</option>
                    <option value="Driver Expense">Driver Bhatta & Food</option>
                    <option value="Other">Other Expense</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Amount PKR"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-28 px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono"
                    required
                    min="1"
                  />

                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
                  />

                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="flex-1 min-w-[120px] px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
                  />

                  <button
                    type="submit"
                    disabled={addingExpense}
                    className="px-3 py-1.5 text-xs font-bold rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {addingExpense ? 'Adding...' : 'Add Expense'}
                  </button>
                </form>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLoadId(null);
                    setLoadDetails(null);
                  }}
                  className="px-4 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

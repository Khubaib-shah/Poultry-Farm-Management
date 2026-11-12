import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Search,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Sale, StockBatch } from '../types/index.ts';
import { api } from '../services/api.ts';
import { Modal } from '../components/common/Modal.tsx';
import { formatPKR, formatNumber, formatDate } from '../utils/formatters.ts';

interface OwnShopSalesPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
  initialOpenSaleModal?: boolean;
}

export const OwnShopSalesPage: React.FC<OwnShopSalesPageProps> = ({
  onShowToast,
  initialOpenSaleModal = false,
}) => {
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [availableStock, setAvailableStock] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states (ONLY 4 fields as required)
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [quantityPieces, setQuantityPieces] = useState('');
  const [totalSaleAmount, setTotalSaleAmount] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Success summary modal
  const [lastSaleSummary, setLastSaleSummary] = useState<any | null>(null);

  // Sale detail view
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [salesRes, batchesRes] = await Promise.all([
        api.getSales({ type: 'OWN_SHOP' }),
        api.getBatches(),
      ]);
      setSalesList(salesRes);
      const totalStock = batchesRes
        .filter((b) => !b.isClosed)
        .reduce((sum, b) => sum + b.remainingPieces, 0);
      setAvailableStock(totalStock);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to fetch sales', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const pieces = parseInt(quantityPieces, 10);
    const amount = parseFloat(totalSaleAmount);

    if (isNaN(pieces) || pieces <= 0 || isNaN(amount) || amount <= 0) {
      onShowToast('Please enter a valid piece quantity and total amount in PKR', 'error');
      return;
    }

    if (pieces > availableStock) {
      onShowToast(
        `Insufficient inventory! Requested: ${pieces} pcs, Available: ${availableStock} pcs`,
        'error'
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createOwnShopSale({
        saleDate,
        quantityPieces: pieces,
        totalSaleAmount: amount,
        notes: saleNotes || undefined,
      });

      onShowToast(`Sale ${res.sale.invoiceNumber} recorded successfully!`, 'success');
      setLastSaleSummary(res.summary);
      setQuantityPieces('');
      setTotalSaleAmount('');
      setSaleNotes('');
      await fetchData();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to record sale', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openSaleDetails = async (id: number) => {
    try {
      setDetailsLoading(true);
      const res = await api.getSale(id);
      setSelectedSale(res);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to load sale details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Live calculations for form preview
  const livePieces = parseInt(quantityPieces || '0', 10);
  const liveAmount = parseFloat(totalSaleAmount || '0');
  const livePricePerPiece =
    livePieces > 0 && liveAmount > 0 ? Number((liveAmount / livePieces).toFixed(2)) : 0;

  const filteredSales = salesList.filter((s) =>
    s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header and Fast Sales Entry Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#E3E6E8] dark:border-[#2A2F35] gap-3">
          <div>
            <h2 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5] flex items-center">
              <ShoppingBag className="w-6 h-6 mr-2.5 text-[#14161A] dark:text-[#D4F56B]" />
              Own Shop Counter Sales
            </h2>
            <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
              Quick piece-based counter sale entry with automated FIFO batch deduction
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-[#A9C8FA] text-[#14161A] px-3.5 py-1.5 rounded-full border border-black/5 text-xs font-semibold shadow-xs">
            <span>Live Stock Available:</span>
            <span className="font-mono font-black text-sm">
              {formatNumber(availableStock)} pieces
            </span>
          </div>
        </div>

        {/* ULTRA SIMPLE NEW SALE FORM */}
        <form onSubmit={handleCreateSale} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Field 1: Sale Date */}
            <div>
              <label className="block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-1">
                Sale Date *
              </label>
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
                className="w-full px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] font-mono focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              />
            </div>

            {/* Field 2: Quantity in Pieces */}
            <div>
              <label className="block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-1">
                Quantity in Pieces *
              </label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={quantityPieces}
                onChange={(e) => setQuantityPieces(e.target.value)}
                required
                min="1"
                max={availableStock > 0 ? availableStock : 1}
                className="w-full px-4 py-2 text-sm font-bold border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] font-mono focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              />
              <p className="text-[10px] text-[#636B76] dark:text-[#8A929C] mt-1">
                Number of whole chickens sold
              </p>
            </div>

            {/* Field 3: Total Sale Amount in PKR */}
            <div>
              <label className="block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-1">
                Total Sale Amount (PKR) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 92500"
                  value={totalSaleAmount}
                  onChange={(e) => setTotalSaleAmount(e.target.value)}
                  required
                  min="1"
                  className="w-full pl-4 pr-12 py-2 text-sm font-bold border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] font-mono focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
                />
                <span className="absolute right-4 top-2.5 text-xs text-[#636B76] dark:text-[#8A929C] font-bold">
                  PKR
                </span>
              </div>
              <p className="text-[10px] text-[#636B76] dark:text-[#8A929C] mt-1">
                Total cash collected from counter
              </p>
            </div>
          </div>

          {/* Field 4: Optional Notes & Live Preview Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3] mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Morning walk-in counter retail"
                value={saleNotes}
                onChange={(e) => setSaleNotes(e.target.value)}
                className="w-full px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              />
            </div>

            <div className="bg-[#F8F9FA] dark:bg-[#20242A] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full px-4 py-2 text-xs flex items-center justify-between">
              <span className="text-[#636B76] dark:text-[#8A929C] font-semibold">Auto Rate / Piece:</span>
              <span className="font-mono font-black text-[#14161A] dark:text-[#D4F56B] text-sm">
                {livePricePerPiece > 0 ? formatPKR(livePricePerPiece) : 'Enter values'}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting || availableStock <= 0}
              className="inline-flex items-center px-6 py-2.5 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs disabled:opacity-50 space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Recording Sale...' : 'Save & Deduct Inventory'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* RECENT SALES FLOATING ISLAND */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
            Own Shop Sales History
          </h3>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E3E6E8] dark:border-[#2A2F35] text-[#4A515B] dark:text-[#A3AAB3] font-bold uppercase text-[11px] bg-[#F8F9FA] dark:bg-[#20242A]">
                <th className="py-2.5 px-3">Invoice Number</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Selling Price / pc</th>
                <th className="py-2.5 px-3 text-right">FIFO Cost / pc</th>
                <th className="py-2.5 px-3 text-right">Profit / pc</th>
                <th className="py-2.5 px-3 text-right font-bold text-[#14161A] dark:text-[#F2F4F5]">Total Sale</th>
                <th className="py-2.5 px-3 text-right font-bold text-emerald-800 dark:text-[#92E2B3]">Total Profit</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-[#636B76] dark:text-[#8A929C]">
                    Loading sales records...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-[#636B76] dark:text-[#8A929C]">
                    No own shop sales recorded yet.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-[#F8F9FA] dark:hover:bg-[#20242A]/60 transition">
                    <td className="py-3 px-3 font-bold font-mono text-[#14161A] dark:text-[#F2F4F5]">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 text-[#4A515B] dark:text-[#A3AAB3]">{formatDate(sale.saleDate)}</td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-[#14161A] dark:text-[#F2F4F5]">
                      {formatNumber(sale.totalPieces)} pcs
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#4A515B] dark:text-[#A3AAB3]">
                      {formatPKR(sale.sellingPricePerPiece)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#636B76] dark:text-[#8A929C]">
                      {formatPKR(sale.costPerPiece)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-700 dark:text-[#92E2B3] font-bold">
                      +{formatPKR(sale.profitPerPiece)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#14161A] dark:text-[#F2F4F5]">
                      {formatPKR(sale.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-800 dark:text-[#92E2B3]">
                      {formatPKR(sale.totalProfit)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => openSaleDetails(sale.id)}
                        className="px-3 py-1 text-[11px] font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition"
                      >
                        Batches
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POST-SALE SUMMARY MODAL */}
      {lastSaleSummary && (
        <Modal
          isOpen={Boolean(lastSaleSummary)}
          onClose={() => setLastSaleSummary(null)}
          title="Sale Confirmed & Inventory Deducted"
          subtitle="FIFO batch breakdown and profit calculation"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded p-4 text-center">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                Invoice Number
              </span>
              <div className="text-lg font-bold text-emerald-950 font-mono mt-0.5">
                {lastSaleSummary.invoiceNumber}
              </div>
              <div className="text-xl font-bold text-emerald-700 font-mono mt-2">
                {formatPKR(lastSaleSummary.totalAmount)}
              </div>
              <div className="text-xs text-emerald-800 mt-0.5">
                {lastSaleSummary.pieces} pieces @ {formatPKR(lastSaleSummary.sellingPricePerPiece)} / piece
              </div>
            </div>

            <div className="bg-slate-50 rounded border border-slate-200 p-3.5 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Revenue:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatPKR(lastSaleSummary.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">COGS (FIFO Cost):</span>
                <span className="font-mono text-slate-700">
                  {formatPKR(lastSaleSummary.totalCost)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-bold text-slate-900">Total Profit:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  +{formatPKR(lastSaleSummary.totalProfit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Profit Per Piece:</span>
                <span className="font-mono font-semibold text-emerald-700">
                  +{formatPKR(lastSaleSummary.profitPerPiece)}
                </span>
              </div>
            </div>

            {/* Consumed Batches */}
            <div>
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Batches Consumed (FIFO Order)
              </span>
              <div className="mt-1 divide-y divide-slate-100 border border-slate-200 rounded">
                {(lastSaleSummary.batchesConsumed || []).map((b: any) => (
                  <div key={b.batchId} className="p-2 flex justify-between text-xs">
                    <span className="font-mono font-medium text-slate-800">{b.batchNumber}</span>
                    <span className="text-slate-600 font-mono">
                      {b.quantity} pcs @ PKR {b.unitCost}/pc = {formatPKR(b.totalCost)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setLastSaleSummary(null)}
                className="px-4 py-1.5 text-xs font-bold rounded bg-slate-900 text-white hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* SALE DETAIL VIEW MODAL */}
      {selectedSale && (
        <Modal
          isOpen={Boolean(selectedSale)}
          onClose={() => setSelectedSale(null)}
          title={`Sale Details: ${selectedSale.invoiceNumber}`}
          subtitle="FIFO items and batch cost trace"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium text-slate-800">{formatDate(selectedSale.saleDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Pieces:</span>
                <span className="font-mono font-bold text-slate-900">{selectedSale.totalPieces} pcs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Revenue:</span>
                <span className="font-mono font-bold text-slate-900">{formatPKR(selectedSale.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">FIFO Cost:</span>
                <span className="font-mono text-slate-700">{formatPKR(selectedSale.totalCost)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="font-bold text-slate-800">Profit:</span>
                <span className="font-mono font-bold text-emerald-700">{formatPKR(selectedSale.totalProfit)}</span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Inventory Batches Deducted
              </span>
              <div className="mt-1 divide-y divide-slate-100 border border-slate-200 rounded">
                {(selectedSale.items || []).map((item) => (
                  <div key={item.id} className="p-2 flex justify-between text-xs">
                    <span className="font-mono font-medium text-slate-800">{item.batchNumber}</span>
                    <span className="font-mono text-slate-600">
                      {item.quantity} pcs @ PKR {item.unitCost} = {formatPKR(item.totalCost)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-50"
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

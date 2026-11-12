import React, { useState, useEffect } from 'react';
import {
  Store,
  Plus,
  Search,
  ShoppingCart,
  Phone,
  MapPin,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { Shop, Sale } from '../types/index.ts';
import { api } from '../services/api.ts';
import { Modal } from '../components/common/Modal.tsx';
import { formatPKR, formatNumber, formatDate } from '../utils/formatters.ts';

interface WholesalePageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
}

export const WholesalePage: React.FC<WholesalePageProps> = ({ onShowToast }) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [wholesaleSales, setWholesaleSales] = useState<Sale[]>([]);
  const [availableStock, setAvailableStock] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // New Wholesale Sale Modal
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [quantityPieces, setQuantityPieces] = useState('');
  const [totalSaleAmount, setTotalSaleAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingSale, setSubmittingSale] = useState(false);

  // New Shop Modal
  const [isNewShopOpen, setIsNewShopOpen] = useState(false);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [shopNotes, setShopNotes] = useState('');
  const [submittingShop, setSubmittingShop] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [shopsRes, salesRes, batchesRes] = await Promise.all([
        api.getShops(),
        api.getSales({ type: 'WHOLESALE' }),
        api.getBatches(),
      ]);
      setShops(shopsRes);
      setWholesaleSales(salesRes);
      const totalStock = batchesRes
        .filter((b) => !b.isClosed)
        .reduce((sum, b) => sum + b.remainingPieces, 0);
      setAvailableStock(totalStock);

      if (shopsRes.length > 0 && !selectedShopId) {
        setSelectedShopId(String(shopsRes[0].id));
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to fetch wholesale data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      onShowToast('Shop name is required', 'error');
      return;
    }

    try {
      setSubmittingShop(true);
      const created = await api.createShop({
        shopName: shopName.trim(),
        ownerName: ownerName.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        notes: shopNotes.trim() || undefined,
      });

      onShowToast(`Shop "${created.shopName}" registered successfully!`, 'success');
      setIsNewShopOpen(false);
      setShopName('');
      setOwnerName('');
      setPhone('');
      setAddress('');
      setShopNotes('');
      await fetchData();
      setSelectedShopId(String(created.id));
    } catch (err: any) {
      onShowToast(err.message || 'Failed to create shop', 'error');
    } finally {
      setSubmittingShop(false);
    }
  };

  const handleCreateWholesaleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const pieces = parseInt(quantityPieces, 10);
    const amount = parseFloat(totalSaleAmount);

    if (!selectedShopId || isNaN(pieces) || pieces <= 0 || isNaN(amount) || amount <= 0) {
      onShowToast('Please provide valid shop, pieces and total amount', 'error');
      return;
    }

    if (pieces > availableStock) {
      onShowToast(
        `Insufficient stock! Requested: ${pieces} pcs, Available: ${availableStock} pcs`,
        'error'
      );
      return;
    }

    try {
      setSubmittingSale(true);
      const res = await api.createWholesaleSale({
        shopId: parseInt(selectedShopId, 10),
        saleDate,
        quantityPieces: pieces,
        totalSaleAmount: amount,
        notes: notes || undefined,
      });

      onShowToast(
        `Wholesale invoice ${res.sale.invoiceNumber} recorded! Stock deducted via FIFO.`,
        'success'
      );
      setIsNewSaleOpen(false);
      setQuantityPieces('');
      setTotalSaleAmount('');
      setNotes('');
      await fetchData();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to create wholesale distribution', 'error');
    } finally {
      setSubmittingSale(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Wholesale Shops & Distribution
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Distribute bulk chicken pieces to local shops and butcher retailers with automated FIFO deduction
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsNewShopOpen(true)}
            className="px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition"
          >
            Add New Shop
          </button>
          <button
            onClick={() => setIsNewSaleOpen(true)}
            className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Distribution Delivery
          </button>
        </div>
      </div>

      {/* Registered Shops Cards */}
      <div>
        <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-3">
          Registered Wholesale Retailers
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map((shop) => (
            <div key={shop.id} className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-[#14161A] dark:text-[#F2F4F5] text-sm">{shop.shopName}</h4>
                  <div className="text-xs text-[#636B76] dark:text-[#8A929C] font-medium">{shop.ownerName || 'Owner'}</div>
                </div>
                <span className="w-8 h-8 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] flex items-center justify-center text-[#14161A] dark:text-[#F2F4F5]">
                  <Store className="w-4 h-4" />
                </span>
              </div>

              {shop.phone && (
                <div className="text-xs text-[#636B76] dark:text-[#8A929C] flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-1.5 text-[#8A929C]" />
                  {shop.phone}
                </div>
              )}

              {shop.address && (
                <div className="text-xs text-[#636B76] dark:text-[#8A929C] flex items-center truncate">
                  <MapPin className="w-3.5 h-3.5 mr-1.5 text-[#8A929C] shrink-0" />
                  <span className="truncate">{shop.address}</span>
                </div>
              )}

              <div className="pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex justify-between text-xs text-[#4A515B] dark:text-[#A3AAB3]">
                <span>Total Delivered:</span>
                <span className="font-mono font-bold text-[#14161A] dark:text-[#F2F4F5]">
                  {formatNumber(shop.totalPiecesDelivered || 0)} pieces
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distribution Deliveries Table */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35]">
          <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
            Wholesale Distribution Invoices
          </h3>
          <p className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-0.5">
            Bulk deliveries dispatched with FIFO cost recognition
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] bg-slate-50/50">
                <th className="py-2.5 px-3">Invoice Number</th>
                <th className="py-2.5 px-3">Shop Destination</th>
                <th className="py-2.5 px-3">Delivery Date</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Rate / pc</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900">Total Billed</th>
                <th className="py-2.5 px-3 text-right font-bold text-emerald-700">Gross Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wholesaleSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No wholesale distribution records found.
                  </td>
                </tr>
              ) : (
                wholesaleSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold font-mono text-slate-900">
                      {sale.invoiceNumber}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {sale.shopName || 'Retail Shop'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{formatDate(sale.saleDate)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">
                      {formatNumber(sale.totalPieces)} pcs
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {formatPKR(sale.sellingPricePerPiece)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatPKR(sale.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatPKR(sale.totalProfit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REGISTER NEW SHOP */}
      <Modal
        isOpen={isNewShopOpen}
        onClose={() => setIsNewShopOpen(false)}
        title="Register Wholesale Retail Shop"
        subtitle="Add a shop that receives chicken deliveries"
        maxWidth="md"
      >
        <form onSubmit={handleCreateShop} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Shop Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Al-Raziq Chicken Point"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Owner / Contact Person
            </label>
            <input
              type="text"
              placeholder="e.g. Haji Bashir"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              placeholder="e.g. 0321-4455667"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Address / Market Location
            </label>
            <input
              type="text"
              placeholder="e.g. Shop #14, Main Market, Lahore"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewShopOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingShop}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submittingShop ? 'Saving...' : 'Register Shop'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: NEW WHOLESALE DISTRIBUTION */}
      <Modal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        title="New Wholesale Distribution Delivery"
        subtitle="Deliver chicken pieces to retail shop with automatic FIFO stock deduction"
        maxWidth="md"
      >
        <form onSubmit={handleCreateWholesaleSale} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Shop *
            </label>
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shopName} {s.ownerName ? `(${s.ownerName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Delivery Date *
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity in Pieces *
              </label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={quantityPieces}
                onChange={(e) => setQuantityPieces(e.target.value)}
                required
                min="1"
                max={availableStock > 0 ? availableStock : 1}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500">
                Avail: {availableStock} pcs
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Billed Amount (PKR) *
              </label>
              <input
                type="number"
                placeholder="e.g. 180000"
                value={totalSaleAmount}
                onChange={(e) => setTotalSaleAmount(e.target.value)}
                required
                min="1"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Delivery Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Morning delivery via Suzuki pick-up"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewSaleOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingSale || availableStock <= 0}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submittingSale ? 'Processing...' : 'Save Wholesale Invoice'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

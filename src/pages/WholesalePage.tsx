import React, { useState, useMemo, useEffect } from 'react';
import {
  Store,
  Plus,
  Phone,
  MapPin,
} from 'lucide-react';
import { Sale } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { formatPKR, formatSignedPKR, formatNumber, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';

interface WholesalePageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const WholesalePage: React.FC<WholesalePageProps> = ({ onShowToast }) => {
  const shops = useAppStore((s) => s.shops);
  const allSales = useAppStore((s) => s.sales);
  const batches = useAppStore((s) => s.batches);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const createShop = useAppStore((s) => s.createShop);
  const createWholesaleSale = useAppStore((s) => s.createWholesaleSale);

  const [searchQuery, setSearchQuery] = useState('');
  const [shopFilter, setShopFilter] = useState('ALL');

  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [saleDate, setSaleDate] = useState(() => getLocalPakistanDate());
  const [quantityPieces, setQuantityPieces] = useState('');
  const [totalSaleAmount, setTotalSaleAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [isNewShopOpen, setIsNewShopOpen] = useState(false);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (shops.length > 0 && !selectedShopId) {
      setSelectedShopId(String(shops[0].id));
    }
  }, [shops, selectedShopId]);

  const availableStock = useMemo(
    () =>
      batches
        .filter((b) => !b.isClosed)
        .reduce((sum, b) => sum + Number(b.remainingPieces || 0), 0),
    [batches]
  );

  const wholesaleSales = useMemo(
    () => allSales.filter((s) => s.saleType === 'WHOLESALE'),
    [allSales]
  );

  const filteredSales = useMemo(() => {
    return wholesaleSales.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.shopName && s.shopName.toLowerCase().includes(q));
      const matchesShop = shopFilter === 'ALL' || String(s.shopId) === shopFilter;
      return matchesSearch && matchesShop;
    });
  }, [wholesaleSales, searchQuery, shopFilter]);

  const shopOptions = useMemo(
    () =>
      shops.map((s) => ({
        value: String(s.id),
        label: s.shopName,
        sublabel: s.ownerName || undefined,
      })),
    [shops]
  );

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      onShowToast('Please enter a shop name', 'error');
      return;
    }

    const nameVal = shopName.trim();
    const ownerVal = ownerName.trim() || undefined;
    const phoneVal = phone.trim() || undefined;
    const addrVal = address.trim() || undefined;

    setIsNewShopOpen(false);
    setShopName('');
    setOwnerName('');
    setPhone('');
    setAddress('');

    try {
      const created = await createShop({
        shopName: nameVal,
        ownerName: ownerVal,
        phone: phoneVal,
        address: addrVal,
      });
      setSelectedShopId(String(created.id));
    } catch {
      // handled by store
    }
  };

  const handleCreateWholesaleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const pieces = parseInt(quantityPieces, 10);
    const amount = parseFloat(totalSaleAmount);

    if (!selectedShopId || isNaN(pieces) || pieces <= 0 || isNaN(amount) || amount <= 0) {
      onShowToast('Please fill shop, birds, and bill amount', 'error');
      return;
    }

    if (pieces > availableStock) {
      onShowToast(`Only ${availableStock} birds available in stock!`, 'error');
      return;
    }

    const sId = parseInt(selectedShopId, 10);
    const notesCopy = notes;
    setIsNewSaleOpen(false);
    setQuantityPieces('');
    setTotalSaleAmount('');
    setNotes('');

    try {
      await createWholesaleSale({
        shopId: sId,
        saleDate,
        quantityPieces: pieces,
        totalSaleAmount: amount,
        notes: notesCopy || undefined,
      });
    } catch {
      // handled by store
    }
  };

  const columns: DataTableColumn<Sale>[] = [
    {
      key: 'invoiceNumber',
      header: 'Bill #',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (s) => <span className="font-mono font-bold">{s.invoiceNumber}</span>,
    },
    {
      key: 'shopName',
      header: 'Shop Name',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (s) => <span className="font-semibold">{s.shopName || 'Retail Shop'}</span>,
    },
    {
      key: 'saleDate',
      header: 'Delivery Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (s) => <span className="text-[#4A515B] dark:text-[#A3AAB3]">{formatDate(s.saleDate)}</span>,
    },
    {
      key: 'totalPieces',
      header: 'Birds',
      align: 'right',
      sortable: true,
      render: (s) => <span className="font-mono font-semibold">{formatNumber(s.totalPieces)} birds</span>,
    },
    {
      key: 'sellingPricePerPiece',
      header: 'Price / Bird',
      align: 'right',
      defaultVisible: false,
      sortable: true,
      sortValue: (s) => Number(s.sellingPricePerPiece),
      render: (s) => <span className="font-mono">{formatPKR(s.sellingPricePerPiece)}</span>,
    },
    {
      key: 'totalCost',
      header: 'Bird Cost',
      align: 'right',
      defaultVisible: false,
      sortable: true,
      sortValue: (s) => Number(s.totalCost),
      render: (s) => <span className="font-mono text-[#636B76]">{formatPKR(s.totalCost)}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Total Bill',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      sortValue: (s) => Number(s.totalAmount),
      render: (s) => <span className="font-mono font-bold">{formatPKR(s.totalAmount)}</span>,
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

  const inputCls =
    'w-full min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Other Chicken Shops & Deliveries
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Send bulk chicken orders to other meat shops and update bird stock automatically
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 w-full xl:w-auto xl:ml-auto">
          <button
            type="button"
            onClick={() => setIsNewShopOpen(true)}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition cursor-pointer"
          >
            + Add Shop
          </button>
          <button
            type="button"
            onClick={() => setIsNewSaleOpen(true)}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Delivery
          </button>
        </div>
      </div>

      {/* Shops Cards */}
      <div>
        <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-3">
          Regular Buyer Shops ({shops.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shops.map((shop) => (
            <div
              key={shop.id}
              className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-[#14161A] dark:text-[#F2F4F5] text-sm">
                      {shop.shopName}
                    </h4>
                    <div className="text-xs text-[#636B76] dark:text-[#8A929C] font-medium">
                      {shop.ownerName || 'Shop Owner'}
                    </div>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] flex items-center justify-center">
                    <Store className="w-4 h-4" />
                  </span>
                </div>

                {shop.phone && (
                  <div className="text-xs text-[#636B76] dark:text-[#8A929C] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{shop.phone}</span>
                  </div>
                )}

                {shop.address && (
                  <div className="text-xs text-[#636B76] dark:text-[#8A929C] flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{shop.address}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between text-xs">
                <span className="text-[#4A515B] dark:text-[#A3AAB3]">Total Delivered:</span>
                <span className="font-mono font-bold">
                  {formatNumber(shop.totalPiecesDelivered || 0)} birds
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deliveries Table */}
      <DataTable
        tableId="wholesale-sales"
        title="Other Shop Delivery Bills"
        subtitle="Bulk orders sent to other chicken shops"
        data={filteredSales}
        columns={columns}
        keyExtractor={(s) => s.id}
        loading={loading && !initialized}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search bill # or shop..."
        defaultSortKey="saleDate"
        defaultSortDir="desc"
        filters={[
          {
            key: 'shop',
            label: 'Shop',
            value: shopFilter,
            onChange: setShopFilter,
            options: [{ value: 'ALL', label: 'All Shops' }, ...shopOptions],
          },
        ]}
        mobileCardTitle={(s) => s.shopName || 'Wholesale Shop'}
        mobileCardSubtitle={(s) => `${s.invoiceNumber} · ${formatDate(s.saleDate)}`}
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

      {/* MODAL: ADD SHOP */}
      <Modal
        isOpen={isNewShopOpen}
        onClose={() => setIsNewShopOpen(false)}
        title="Add Buyer Shop"
        subtitle="Save a shop that buys chickens in bulk"
        maxWidth="md"
      >
        <form onSubmit={handleCreateShop} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">Shop Name *</label>
            <input
              type="text"
              placeholder="e.g. Al-Raziq Chicken Point"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Owner Name</label>
            <input
              type="text"
              placeholder="e.g. Haji Bashir"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 0321-4455667"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Market / Address</label>
            <input
              type="text"
              placeholder="e.g. Shop #14, Main Market, Lahore"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              onClick={() => setIsNewShopOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] cursor-pointer"
            >
              Save Shop
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: NEW DELIVERY */}
      <Modal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        title="New Delivery to Other Shop"
        subtitle="Send birds to a buyer shop and update stock automatically"
        maxWidth="md"
      >
        <form onSubmit={handleCreateWholesaleSale} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">Pick Shop *</label>
            <Select
              value={selectedShopId}
              onChange={setSelectedShopId}
              options={shopOptions}
              placeholder="Choose shop"
              searchable
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Delivery Date *</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1.5">Birds Sent *</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={quantityPieces}
                onChange={(e) => setQuantityPieces(e.target.value)}
                required
                min="1"
                max={availableStock > 0 ? availableStock : 1}
                className={`${inputCls} font-mono font-bold`}
              />
              <span className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-1 block">
                In stock: {availableStock} birds
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5">Total Bill (PKR) *</label>
              <input
                type="number"
                placeholder="e.g. 180000"
                value={totalSaleAmount}
                onChange={(e) => setTotalSaleAmount(e.target.value)}
                required
                min="1"
                className={`${inputCls} font-mono font-bold`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Morning delivery via Suzuki van"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              onClick={() => setIsNewSaleOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={availableStock <= 0}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 cursor-pointer"
            >
              Save Delivery
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

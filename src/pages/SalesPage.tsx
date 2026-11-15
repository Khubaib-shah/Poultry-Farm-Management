import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag,
  Store,
  ListChecks,
  CheckCircle2,
  Plus,
  Phone,
  MapPin,
  Package,
  Check,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Sale } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { formatPKR, formatSignedPKR, formatNumber, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

export type SalesSubTab = 'walk-in' | 'other-shops' | 'all';

interface SalesPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
  initialSubTab?: SalesSubTab;
}

export const SalesPage: React.FC<SalesPageProps> = ({
  onShowToast,
  initialSubTab = 'walk-in',
}) => {
  const shops = useAppStore((s) => s.shops);
  const allSales = useAppStore((s) => s.sales);
  const batches = useAppStore((s) => s.batches);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const isInitialLoading = loading && !initialized;

  const createOwnShopSale = useAppStore((s) => s.createOwnShopSale);
  const createShop = useAppStore((s) => s.createShop);
  const createWholesaleSale = useAppStore((s) => s.createWholesaleSale);

  const [activeTab, setActiveTab] = useState<SalesSubTab>(initialSubTab);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [shopFilter, setShopFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');

  // Walk-in counter quick sale state
  const [saleDate, setSaleDate] = useState(() => getLocalPakistanDate());
  const [quantityPieces, setQuantityPieces] = useState('');
  const [totalSaleAmount, setTotalSaleAmount] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Wholesale delivery modal state
  const [isNewDeliveryOpen, setIsNewDeliveryOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => getLocalPakistanDate());
  const [deliveryPieces, setDeliveryPieces] = useState('');
  const [deliveryAmount, setDeliveryAmount] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Add buyer shop modal state
  const [isNewShopOpen, setIsNewShopOpen] = useState(false);
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Inline quick add buyer state inside "New Delivery to Other Shop" modal
  const [isQuickBuyerOpen, setIsQuickBuyerOpen] = useState(false);
  const [quickBuyerName, setQuickBuyerName] = useState('');
  const [quickBuyerOwner, setQuickBuyerOwner] = useState('');
  const [quickBuyerPhone, setQuickBuyerPhone] = useState('');
  const [isSavingQuickBuyer, setIsSavingQuickBuyer] = useState(false);

  // Bill detail modal
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { isSubmitting: isSavingSale, runOptimistic: runSaveSale } = useThrottledSubmit();
  const { isSubmitting: isSavingShop, runOptimistic: runSaveShop } = useThrottledSubmit();
  const { isSubmitting: isSavingDelivery, runOptimistic: runSaveDelivery } = useThrottledSubmit();

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);

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

  const walkInSales = useMemo(
    () => allSales.filter((s) => s.saleType === 'OWN_SHOP'),
    [allSales]
  );

  const wholesaleSales = useMemo(
    () => allSales.filter((s) => s.saleType === 'WHOLESALE'),
    [allSales]
  );

  const walkInSummary = useMemo(
    () => ({
      amount: walkInSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0),
      birds: walkInSales.reduce((sum, s) => sum + Number(s.totalPieces || 0), 0),
    }),
    [walkInSales]
  );

  const wholesaleSummary = useMemo(
    () => ({
      amount: wholesaleSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0),
      birds: wholesaleSales.reduce((sum, s) => sum + Number(s.totalPieces || 0), 0),
    }),
    [wholesaleSales]
  );

  const todayStr = getLocalPakistanDate();

  const filteredWalkIn = useMemo(() => {
    return walkInSales.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q));
      const matchesDate =
        dateFilter === 'ALL' ||
        (dateFilter === 'TODAY' && s.saleDate === todayStr) ||
        (dateFilter === 'MONTH' && s.saleDate.startsWith(todayStr.slice(0, 7)));
      return matchesSearch && matchesDate;
    });
  }, [walkInSales, searchQuery, dateFilter, todayStr]);

  const filteredWholesale = useMemo(() => {
    return wholesaleSales.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.shopName && s.shopName.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q));
      const matchesShop = shopFilter === 'ALL' || String(s.shopId) === shopFilter;
      return matchesSearch && matchesShop;
    });
  }, [wholesaleSales, searchQuery, shopFilter]);

  const filteredAllSales = useMemo(() => {
    return allSales.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesChannel = channelFilter === 'ALL' || s.saleType === channelFilter;
      const matchesDate =
        dateFilter === 'ALL' ||
        (dateFilter === 'TODAY' && s.saleDate === todayStr) ||
        (dateFilter === 'MONTH' && s.saleDate.startsWith(todayStr.slice(0, 7)));
      const matchesSearch =
        !q ||
        s.invoiceNumber.toLowerCase().includes(q) ||
        (s.shopName && s.shopName.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q));
      return matchesChannel && matchesDate && matchesSearch;
    });
  }, [allSales, channelFilter, dateFilter, searchQuery, todayStr]);

  const shopOptions = useMemo(
    () =>
      shops.map((s) => ({
        value: String(s.id),
        label: s.shopName,
        sublabel: s.ownerName || undefined,
      })),
    [shops]
  );

  // Handlers
  const handleCreateWalkInSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const pieces = parseInt(quantityPieces, 10);
    const amount = parseFloat(totalSaleAmount);

    if (isNaN(pieces) || pieces <= 0 || isNaN(amount) || amount <= 0) {
      onShowToast('Please enter valid bird count and cash amount', 'error');
      return;
    }

    if (pieces > availableStock) {
      onShowToast(`Only ${availableStock} birds in stock right now!`, 'error');
      return;
    }

    const notesCopy = saleNotes;

    await runSaveSale((onOptimistic) =>
      createOwnShopSale(
        {
          saleDate,
          quantityPieces: pieces,
          totalSaleAmount: amount,
          notes: notesCopy || undefined,
        },
        {
          onOptimistic: () => {
            setQuantityPieces('');
            setTotalSaleAmount('');
            setSaleNotes('');
            onOptimistic();
          },
        }
      )
    );
  };

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
    let optimisticId: number | null = null;

    await runSaveShop((onOptimistic) =>
      createShop(
        {
          shopName: nameVal,
          ownerName: ownerVal,
          phone: phoneVal,
          address: addrVal,
        },
        {
          onOptimistic: (optShop) => {
            optimisticId = optShop.id;
            setSelectedShopId(String(optShop.id));
            setIsNewShopOpen(false);
            setShopName('');
            setOwnerName('');
            setPhone('');
            setAddress('');
            onOptimistic();
          },
          onSynced: (createdShop) => {
            setSelectedShopId((prev) =>
              prev === String(optimisticId) ? String(createdShop.id) : prev
            );
          },
          onRollback: () => {
            setSelectedShopId((prev) => {
              if (prev !== String(optimisticId)) return prev;
              const fallback = useAppStore.getState().shops[0];
              return fallback ? String(fallback.id) : '';
            });
          },
        }
      )
    );
  };

  const handleCreateWholesaleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const pieces = parseInt(deliveryPieces, 10);
    const amount = parseFloat(deliveryAmount);

    if (!selectedShopId || isNaN(pieces) || pieces <= 0 || isNaN(amount) || amount <= 0) {
      onShowToast('Please fill shop, birds, and bill amount', 'error');
      return;
    }

    if (pieces > availableStock) {
      onShowToast(`Only ${availableStock} birds available in stock!`, 'error');
      return;
    }

    const sId = parseInt(selectedShopId, 10);
    const notesCopy = deliveryNotes;

    await runSaveDelivery((onOptimistic) =>
      createWholesaleSale(
        {
          shopId: sId,
          saleDate: deliveryDate,
          quantityPieces: pieces,
          totalSaleAmount: amount,
          notes: notesCopy || undefined,
        },
        {
          onOptimistic: () => {
            setIsNewDeliveryOpen(false);
            setDeliveryPieces('');
            setDeliveryAmount('');
            setDeliveryNotes('');
            onOptimistic();
          },
        }
      )
    );
  };

  const handleQuickAddBuyer = async () => {
    if (isSavingQuickBuyer) return;
    if (!quickBuyerName.trim()) {
      onShowToast('Please enter buyer shop name', 'error');
      return;
    }

    const nameVal = quickBuyerName.trim();
    const ownerVal = quickBuyerOwner.trim() || undefined;
    const phoneVal = quickBuyerPhone.trim() || undefined;
    let optimisticId: number | null = null;
    setIsSavingQuickBuyer(true);

    try {
      await createShop(
        {
          shopName: nameVal,
          ownerName: ownerVal,
          phone: phoneVal,
        },
        {
          onOptimistic: (optShop) => {
            optimisticId = optShop.id;
            setSelectedShopId(String(optShop.id));
            setIsQuickBuyerOpen(false);
            setQuickBuyerName('');
            setQuickBuyerOwner('');
            setQuickBuyerPhone('');
          },
          onSynced: (createdShop) => {
            setSelectedShopId((prev) =>
              prev === String(optimisticId) ? String(createdShop.id) : prev
            );
          },
          onRollback: () => {
            setSelectedShopId((prev) => {
              if (prev !== String(optimisticId)) return prev;
              const fallback = useAppStore.getState().shops[0];
              return fallback ? String(fallback.id) : '';
            });
          },
        }
      );
    } catch {
      // toast handled by store
    } finally {
      setIsSavingQuickBuyer(false);
    }
  };

  const openDeliveryModalForShop = (shopId?: number) => {
    if (shopId) {
      setSelectedShopId(String(shopId));
    } else if (shopFilter !== 'ALL') {
      setSelectedShopId(shopFilter);
    }
    setDeliveryDate(getLocalPakistanDate());
    setIsQuickBuyerOpen(false);
    setQuickBuyerName('');
    setQuickBuyerOwner('');
    setQuickBuyerPhone('');
    setIsNewDeliveryOpen(true);
  };

  const livePieces = parseInt(quantityPieces || '0', 10);
  const liveAmount = parseFloat(totalSaleAmount || '0');
  const livePricePerPiece =
    livePieces > 0 && liveAmount > 0 ? Number((liveAmount / livePieces).toFixed(2)) : 0;

  // Shared Table Columns Builders
  const buildSaleColumns = (showSoldTo: boolean): DataTableColumn<Sale>[] => {
    const cols: DataTableColumn<Sale>[] = [
      {
        key: 'invoiceNumber',
        header: 'Bill #',
        sortable: true,
        alwaysVisible: true,
        hideOnMobileDefault: true,
        render: (s) => (
          <span className="font-normal tabular-nums text-[#7B848F] dark:text-[#8A929C]">
            {s.invoiceNumber}
          </span>
        ),
      },
    ];

    if (showSoldTo) {
      cols.push({
        key: 'shopName',
        header: 'Sold To',
        sortable: true,
        alwaysVisible: true,
        hideOnMobileDefault: true,
        render: (s) => (
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-normal text-white whitespace-nowrap ${
              s.saleType === 'OWN_SHOP' ? 'bg-[#6358C8]' : 'bg-[#2B6CB0]'
            }`}
          >
            {s.saleType === 'OWN_SHOP' ? 'Walk-in Shop' : s.shopName || 'Other Shop'}
          </span>
        ),
      });
    }

    cols.push(
      {
        key: 'saleDate',
        header: 'Date',
        sortable: true,
        hideOnMobileDefault: true,
        render: (s) => (
          <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">
            {formatDate(s.saleDate)}
          </span>
        ),
      },
      {
        key: 'totalPieces',
        header: 'Birds Sold',
        align: 'right',
        sortable: true,
        hideOnMobileDefault: true,
        render: (s) => (
          <span className="font-normal tabular-nums">{formatNumber(s.totalPieces)} birds</span>
        ),
      },
      {
        key: 'sellingPricePerPiece',
        header: 'Price / Bird',
        align: 'right',
        defaultVisible: false,
        sortable: true,
        sortValue: (s) => Number(s.sellingPricePerPiece),
        render: (s) => (
          <span className="font-normal tabular-nums">{formatPKR(s.sellingPricePerPiece)}</span>
        ),
      },
      {
        key: 'costPerPiece',
        header: 'Cost / Bird',
        align: 'right',
        defaultVisible: false,
        sortable: true,
        sortValue: (s) => Number(s.costPerPiece),
        render: (s) => (
          <span className="font-normal tabular-nums text-[#7B848F] dark:text-[#8A929C]">
            {formatPKR(s.costPerPiece)}
          </span>
        ),
      },
      {
        key: 'totalAmount',
        header: 'Total Cash',
        align: 'right',
        sortable: true,
        alwaysVisible: true,
        sortValue: (s) => Number(s.totalAmount),
        render: (s) => (
          <span className="font-normal tabular-nums">{formatPKR(s.totalAmount)}</span>
        ),
      },
      {
        key: 'totalProfit',
        header: 'Total Profit',
        align: 'right',
        sortable: true,
        hideOnMobileDefault: true,
        sortValue: (s) => Number(s.totalProfit),
        render: (s) => (
          <span
            className={`font-normal tabular-nums ${
              Number(s.totalProfit) >= 0 ? 'text-[#2FB67C]' : 'text-[#D95C5C] dark:text-[#FF8585]'
            }`}
          >
            {formatSignedPKR(s.totalProfit)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Details',
        align: 'right',
        alwaysVisible: true,
        render: (s) => (
          <button
            type="button"
            onClick={() => setSelectedSale(s)}
            className="px-3 py-1.5 text-[11px] font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] cursor-pointer"
          >
            View
          </button>
        ),
      }
    );

    return cols;
  };

  const walkInColumns = useMemo(() => buildSaleColumns(false), []);
  const wholesaleColumns = useMemo(() => buildSaleColumns(true), []);

  const subTabs: Array<{
    id: SalesSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'walk-in', label: 'Walk-in Shop', icon: ShoppingBag },
    { id: 'other-shops', label: `Other Shops (${shops.length})`, icon: Store },
    { id: 'all', label: 'All Sales', icon: ListChecks },
  ];

  const inputCls =
    'w-full min-w-0 max-w-full block min-h-[42px] px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Shop & Delivery Sales
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Record walk-in counter sales and bulk deliveries to other chicken shops in one place
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 w-full xl:w-auto xl:ml-auto">
          <button
            type="button"
            onClick={() => setIsNewShopOpen(true)}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            + Add Buyer Shop
          </button>
          <button
            type="button"
            onClick={() => openDeliveryModalForShop()}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Shop Delivery
          </button>
        </div>
      </div>

      {/* Unified Channel KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('walk-in')}
          className="text-left rounded-[20px] p-4 sm:p-5 bg-[#C9C3F5] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[128px] transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Walk-in Shop
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-32 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none font-mono tabular-nums">
                {formatPKR(walkInSummary.amount)}
              </div>
            )}
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              {formatNumber(walkInSummary.birds)}{' '}
              {walkInSummary.birds === 1 ? 'bird' : 'birds'} across {walkInSales.length}{' '}
              {walkInSales.length === 1 ? 'bill' : 'bills'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('other-shops')}
          className="text-left rounded-[20px] p-4 sm:p-5 bg-[#A9C8FA] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[128px] transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Other Chicken Shops
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-32 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none font-mono tabular-nums">
                {formatPKR(wholesaleSummary.amount)}
              </div>
            )}
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              {formatNumber(wholesaleSummary.birds)}{' '}
              {wholesaleSummary.birds === 1 ? 'bird' : 'birds'} across {wholesaleSales.length}{' '}
              {wholesaleSales.length === 1 ? 'delivery' : 'deliveries'}
            </p>
          </div>
        </button>

        <div className="rounded-[20px] p-4 sm:p-5 bg-[#92E2B3] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[128px]">
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Birds Ready to Sell
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-28 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none font-mono tabular-nums">
                {formatNumber(availableStock)} {availableStock === 1 ? 'bird' : 'birds'}
              </div>
            )}
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              Available right now (oldest sold first)
            </p>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="sm:hidden bg-white dark:bg-[#181B1F] rounded-[18px] border border-[#E3E6E8] dark:border-[#2A2F35] divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] overflow-hidden shadow-xs">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-4 py-3 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                active
                  ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
                  : 'text-[#4A515B] dark:text-[#A3AAB3]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </span>
              {active && <Check className="w-3.5 h-3.5 text-[#14161A] dark:text-[#D4F56B]" />}
            </button>
          );
        })}
      </div>

      <div className="hidden sm:inline-flex items-center gap-0.5 bg-white dark:bg-[#181B1F] p-1 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] w-fit shadow-xs">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 text-xs font-semibold rounded-full transition-colors focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'text-[#14161A] dark:text-[#F2F4F5]'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="salesTabPill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] z-0"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: WALK-IN SHOP */}
      {activeTab === 'walk-in' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-4 sm:p-6 shadow-xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[#E3E6E8] dark:border-[#2A2F35] gap-2.5 sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg leading-tight font-bold text-[#14161A] dark:text-[#F2F4F5] flex items-center">
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0 text-[#14161A] dark:text-[#D4F56B]" />
                  <span className="truncate">New Walk-in Sale</span>
                </h3>
                <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
                  Enter birds sold and cash received — oldest stock is subtracted automatically
                </p>
              </div>
              <div className="text-xs font-mono font-bold text-[#4A515B] dark:text-[#A3AAB3] shrink-0">
                Stock: <span className="text-[#14161A] dark:text-[#D4F56B]">{formatNumber(availableStock)} birds</span>
              </div>
            </div>

            <form onSubmit={handleCreateWalkInSale} className="mt-4 sm:mt-5 space-y-3.5 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                    Sale Date *
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    required
                    className={`${inputCls} font-mono`}
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                    Birds Sold *
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={quantityPieces}
                    onChange={(e) => setQuantityPieces(e.target.value)}
                    required
                    min="1"
                    max={availableStock > 0 ? availableStock : 1}
                    className={`${inputCls} sm:text-sm font-bold font-mono`}
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                    Total Cash (PKR) *
                  </label>
                  <div className="relative min-w-0">
                    <input
                      type="number"
                      placeholder="e.g. 92500"
                      value={totalSaleAmount}
                      onChange={(e) => setTotalSaleAmount(e.target.value)}
                      required
                      min="1"
                      className={`${inputCls} sm:text-sm font-bold font-mono pr-12`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#636B76] font-bold pointer-events-none">
                      PKR
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 items-center">
                <div className="sm:col-span-2 min-w-0">
                  <label className="block text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3] mb-1.5">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning walk-in sales"
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="min-w-0 bg-[#F8F9FA] dark:bg-[#20242A] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] px-4 min-h-[42px] text-xs flex items-center justify-between gap-2 sm:mt-6">
                  <span className="text-[#636B76] dark:text-[#8A929C] font-semibold">
                    Price / Bird:
                  </span>
                  <span className="font-mono font-black text-[#14161A] dark:text-[#D4F56B] text-sm">
                    {livePricePerPiece > 0 ? formatPKR(livePricePerPiece) : '-'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSavingSale || availableStock <= 0}
                  aria-busy={isSavingSale}
                  className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-6 py-2.5 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingSale ? 'Saving...' : 'Save Sale'}</span>
                </button>
              </div>
            </form>
          </div>

          <DataTable
            tableId="own-shop-sales"
            paginationEndpoint="/api/sales"
            paginationParams={{
              type: 'OWN_SHOP',
              ...(dateFilter !== 'ALL' ? { datePreset: dateFilter } : {}),
            }}
            title="Walk-in Sales History"
            subtitle="All bills from your main shop"
            data={filteredWalkIn}
            columns={walkInColumns}
            keyExtractor={(s) => s.id}
            loading={isInitialLoading}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search bill # or notes..."
            defaultSortKey="saleDate"
            defaultSortDir="desc"
            filters={[
              {
                key: 'date',
                label: 'When',
                value: dateFilter,
                onChange: setDateFilter,
                options: [
                  { value: 'ALL', label: 'All Dates' },
                  { value: 'TODAY', label: 'Today Only' },
                  { value: 'MONTH', label: 'This Month' },
                ],
              },
            ]}
            mobileCardTitle={(s) => s.invoiceNumber}
            mobileCardSubtitle={(s) => `${formatDate(s.saleDate)} · ${s.totalPieces} birds`}
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
        </div>
      )}

      {/* TAB 2: OTHER CHICKEN SHOPS */}
      {activeTab === 'other-shops' && (
        <div className="space-y-4 sm:space-y-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
                Regular Buyer Shops ({shops.length}) — Click a shop to filter deliveries
              </h3>
              {shopFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setShopFilter('ALL')}
                  className="text-xs font-bold text-[#17807D] dark:text-[#D4F56B] hover:underline cursor-pointer"
                >
                  Show All Shops
                </button>
              )}
            </div>

            {shops.length === 0 ? (
              <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 text-center text-xs text-[#636B76] dark:text-[#8A929C]">
                No buyer shops saved yet. Click &quot;+ Add Buyer Shop&quot; to register one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {shops.map((shop) => {
                  const isSelected = shopFilter === String(shop.id);
                  return (
                    <div
                      key={shop.id}
                      onClick={() => setShopFilter(isSelected ? 'ALL' : String(shop.id))}
                      className={`bg-white dark:bg-[#181B1F] rounded-[20px] p-5 space-y-3 shadow-xs flex flex-col justify-between transition cursor-pointer ${
                        isSelected
                          ? 'border-2 border-[#14161A] dark:border-[#D4F56B] ring-2 ring-[#D4F56B]/30'
                          : 'border border-[#E3E6E8] dark:border-[#2A2F35] hover:border-black/25 dark:hover:border-white/25'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-[#14161A] dark:text-[#F2F4F5] text-sm truncate">
                              {shop.shopName}
                            </h4>
                            <div className="text-xs text-[#636B76] dark:text-[#8A929C] font-medium truncate">
                              {shop.ownerName || 'Shop Owner'}
                            </div>
                          </div>
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-[#D4F56B] text-[#14161A]'
                                : 'bg-[#EDEEEF] dark:bg-[#272C33]'
                            }`}
                          >
                            <Store className="w-4 h-4" />
                          </span>
                        </div>

                        {shop.phone && (
                          <div className="text-xs text-[#636B76] dark:text-[#8A929C] flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
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

                      <div className="pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-[#4A515B] dark:text-[#A3AAB3] block text-[11px]">
                            Delivered
                          </span>
                          <span className="font-mono font-bold">
                            {formatNumber(shop.totalPiecesDelivered || 0)} birds
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeliveryModalForShop(shop.id);
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] text-[11px] font-bold whitespace-nowrap cursor-pointer"
                        >
                          + Deliver
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DataTable
            tableId="wholesale-sales"
            paginationEndpoint="/api/sales"
            paginationParams={{
              type: 'WHOLESALE',
              ...(shopFilter !== 'ALL' ? { shopId: shopFilter } : {}),
            }}
            title="Other Shop Delivery Bills"
            subtitle="Bulk orders sent to other chicken shops"
            data={filteredWholesale}
            columns={wholesaleColumns}
            keyExtractor={(s) => s.id}
            loading={isInitialLoading}
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
                  Number(s.totalProfit) >= 0
                    ? 'text-[#2FB67C]'
                    : 'text-[#D95C5C] dark:text-[#FF8585]'
                }`}
              >
                {formatSignedPKR(s.totalProfit)}
              </span>
            )}
          />
        </div>
      )}

      {/* TAB 3: ALL SALES UNIFIED LEDGER */}
      {activeTab === 'all' && (
        <DataTable
          tableId="all-sales"
          paginationEndpoint="/api/sales"
          paginationParams={{
            ...(channelFilter !== 'ALL' ? { type: channelFilter } : {}),
            ...(dateFilter !== 'ALL' ? { datePreset: dateFilter } : {}),
          }}
          title="All Shop & Delivery Sales"
          subtitle="Combined bills from your walk-in counter and deliveries to other chicken shops"
          data={filteredAllSales}
          columns={wholesaleColumns}
          keyExtractor={(s) => s.id}
          loading={isInitialLoading}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search bill #, shop, or notes..."
          defaultSortKey="saleDate"
          defaultSortDir="desc"
          filters={[
            {
              key: 'channel',
              label: 'Channel',
              value: channelFilter,
              onChange: setChannelFilter,
              options: [
                { value: 'ALL', label: 'All Channels' },
                { value: 'OWN_SHOP', label: 'Walk-in Shop' },
                { value: 'WHOLESALE', label: 'Other Shops' },
              ],
            },
            {
              key: 'date',
              label: 'When',
              value: dateFilter,
              onChange: setDateFilter,
              options: [
                { value: 'ALL', label: 'All Dates' },
                { value: 'TODAY', label: 'Today Only' },
                { value: 'MONTH', label: 'This Month' },
              ],
            },
          ]}
          mobileCardTitle={(s) =>
            s.saleType === 'OWN_SHOP' ? 'Walk-in Shop' : s.shopName || 'Other Shop'
          }
          mobileCardSubtitle={(s) =>
            `${s.invoiceNumber} · ${formatDate(s.saleDate)} · ${s.totalPieces} birds`
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

      {/* MODAL: SALE DETAIL */}
      {selectedSale && (
        <Modal
          isOpen={Boolean(selectedSale)}
          onClose={() => setSelectedSale(null)}
          title={`Bill Details: ${selectedSale.invoiceNumber}`}
          subtitle={
            selectedSale.saleType === 'OWN_SHOP'
              ? 'Walk-in shop sale breakdown'
              : `Delivery to ${selectedSale.shopName || 'Other Shop'}`
          }
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-[#F8F9FA] dark:bg-[#20242A] p-4 rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35] space-y-2">
              <div className="flex justify-between">
                <span className="text-[#636B76] dark:text-[#8A929C]">Channel:</span>
                <span className="font-semibold">
                  {selectedSale.saleType === 'OWN_SHOP'
                    ? 'Walk-in Shop'
                    : selectedSale.shopName || 'Other Shop'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#636B76] dark:text-[#8A929C]">Date:</span>
                <span className="font-semibold">{formatDate(selectedSale.saleDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#636B76] dark:text-[#8A929C]">Birds Sold:</span>
                <span className="font-mono font-bold">{selectedSale.totalPieces} birds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#636B76] dark:text-[#8A929C]">Sale Cash:</span>
                <span className="font-mono font-bold">{formatPKR(selectedSale.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#636B76] dark:text-[#8A929C]">Bird Cost:</span>
                <span className="font-mono">{formatPKR(selectedSale.totalCost)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E3E6E8] dark:border-[#2A2F35] pt-2">
                <span className="font-bold">Profit:</span>
                <span
                  className={`font-mono font-bold ${
                    Number(selectedSale.totalProfit) >= 0
                      ? 'text-[#2FB67C]'
                      : 'text-[#D95C5C] dark:text-[#FF8585]'
                  }`}
                >
                  {formatSignedPKR(selectedSale.totalProfit)}
                </span>
              </div>
              {selectedSale.notes && (
                <div className="flex justify-between pt-1">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Notes:</span>
                  <span>{selectedSale.notes}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="min-h-[42px] px-5 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: ADD BUYER SHOP */}
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
              disabled={isSavingShop}
              onClick={() => setIsNewShopOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingShop}
              aria-busy={isSavingShop}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingShop ? 'Saving...' : 'Save Shop'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: NEW DELIVERY TO OTHER SHOP */}
      <Modal
        isOpen={isNewDeliveryOpen}
        onClose={() => {
          setIsNewDeliveryOpen(false);
          setIsQuickBuyerOpen(false);
        }}
        title="New Delivery to Other Shop"
        subtitle="Send birds to a buyer shop and update stock automatically"
        maxWidth="md"
      >
        <form onSubmit={handleCreateWholesaleSale} className="space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-bold">Pick Shop *</label>
              <button
                type="button"
                onClick={() => setIsQuickBuyerOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-[#17807D] dark:text-[#D4F56B] bg-[#17807D]/10 dark:bg-[#D4F56B]/15 hover:bg-[#17807D]/15 dark:hover:bg-[#D4F56B]/25 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isQuickBuyerOpen ? 'Close Quick Add' : 'Quick Add Buyer'}</span>
              </button>
            </div>

            <Select
              value={selectedShopId}
              onChange={setSelectedShopId}
              options={shopOptions}
              placeholder="Choose shop"
              searchable
            />

            {isQuickBuyerOpen && (
              <div className="rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F8F9FA] dark:bg-[#20242A] p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#14161A] dark:text-[#F2F4F5]">
                    Quick Add New Buyer
                  </span>
                  <span className="text-[11px] text-[#636B76] dark:text-[#8A929C]">
                    Auto-selects after save
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">Buyer Shop Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Al-Rehman Poultry Point"
                    value={quickBuyerName}
                    onChange={(e) => setQuickBuyerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleQuickAddBuyer();
                      }
                    }}
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Owner Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Haji Bashir"
                      value={quickBuyerOwner}
                      onChange={(e) => setQuickBuyerOwner(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleQuickAddBuyer();
                        }
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 0300-1234567"
                      value={quickBuyerPhone}
                      onChange={(e) => setQuickBuyerPhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleQuickAddBuyer();
                        }
                      }}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSavingQuickBuyer}
                    onClick={() => {
                      setIsQuickBuyerOpen(false);
                      setQuickBuyerName('');
                      setQuickBuyerOwner('');
                      setQuickBuyerPhone('');
                    }}
                    className="min-h-[36px] px-3.5 py-1.5 text-[11px] font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-white dark:hover:bg-[#181B1F] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingQuickBuyer}
                    onClick={() => void handleQuickAddBuyer()}
                    className="min-h-[36px] px-4 py-1.5 text-[11px] font-bold rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingQuickBuyer ? 'Saving...' : 'Save Buyer'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-bold mb-1.5">Delivery Date *</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="block text-xs font-bold mb-1.5">Birds Sent *</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={deliveryPieces}
                onChange={(e) => setDeliveryPieces(e.target.value)}
                required
                min="1"
                max={availableStock > 0 ? availableStock : 1}
                className={`${inputCls} font-mono font-bold`}
              />
              <span className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-1 block">
                In stock: {availableStock} birds
              </span>
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-bold mb-1.5">Total Bill (PKR) *</label>
              <input
                type="number"
                placeholder="e.g. 180000"
                value={deliveryAmount}
                onChange={(e) => setDeliveryAmount(e.target.value)}
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
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isSavingDelivery}
              onClick={() => setIsNewDeliveryOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingDelivery || availableStock <= 0}
              aria-busy={isSavingDelivery}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingDelivery ? 'Saving...' : 'Save Delivery'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  Truck,
  Users,
  ShoppingCart,
  Sparkles,
  ChevronRight,
  Plus,
  Calendar,
  Check,
} from 'lucide-react';
import { formatPKR, formatSignedPKR, formatNumber, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { computeDashboardFromCollections } from '../utils/syncCalculations.ts';
import { NavItemKey } from '../components/shell/FloatingIslandShell.tsx';

interface DashboardPageProps {
  onNavigate: (tab: NavItemKey) => void;
  onOpenQuickSale: () => void;
  onOpenNewLoad: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenQuickSale,
  onOpenNewLoad,
}) => {
  const sales = useAppStore((s) => s.sales);
  const purchases = useAppStore((s) => s.purchases);
  const batches = useAppStore((s) => s.batches);
  const suppliers = useAppStore((s) => s.suppliers);
  const expenses = useAppStore((s) => s.expenses);
  const workerPayments = useAppStore((s) => s.workerPayments);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);

  const [period, setPeriod] = useState<string>('last7days');
  const [chartTimeframe, setChartTimeframe] = useState<'7D' | '30D' | '90D'>('7D');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null);

  const chartDaysCount = chartTimeframe === '90D' ? 30 : chartTimeframe === '30D' ? 14 : 7;

  const data = useMemo(
    () =>
      computeDashboardFromCollections({
        period,
        customStart: customStart || undefined,
        customEnd: customEnd || undefined,
        chartDaysCount,
        sales,
        purchases,
        batches,
        suppliers,
        expenses,
        workerPayments,
      }),
    [
      period,
      customStart,
      customEnd,
      chartDaysCount,
      sales,
      purchases,
      batches,
      suppliers,
      expenses,
      workerPayments,
    ]
  );

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      setPeriod('custom');
    }
  };

  if (loading && !initialized) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[380px]">
        <div className="text-center">
          <div className="w-9 h-9 border-3 border-[#D4F56B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#636B76] dark:text-[#8A929C] font-semibold tracking-wider uppercase">
            Loading Shop Summary...
          </p>
        </div>
      </div>
    );
  }

  const { kpis, charts, recent } = data;

  const maxBarValue = Math.max(
    ...(charts.daily || []).map((d) => Math.max(d.revenue, d.cogs, 1000)),
    1000
  );

  const formatShortNum = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${Math.round(val / 1000)}k`;
    return `${Math.round(val)}`;
  };

  const dailyList = charts.daily || [];
  const activeDay =
    dailyList.find((d) => d.date === selectedChartDate) ||
    [...dailyList].reverse().find((d) => d.revenue > 0 || d.expenses > 0) ||
    dailyList[dailyList.length - 1];

  const periodLabel =
    period === 'today'
      ? 'Today'
      : period === 'yesterday'
      ? 'Yesterday'
      : period === 'last7days'
      ? 'Last 7 Days'
      : period === 'thismonth'
      ? 'This Month'
      : 'Custom Dates';

  const periodButtons = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last7days', label: 'Last 7 Days' },
    { id: 'thismonth', label: 'This Month' },
  ] as const;

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* SECTION TITLE & DATE FILTER STRIP */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h1 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Shop Overview
          </h1>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            See how much you sold, how many birds are left, and your profit in hand
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 w-full xl:w-auto">
          {/* Mobile: Vertical List (no overflowing pills) */}
          <div className="sm:hidden bg-white dark:bg-[#181B1F] rounded-[18px] border border-[#E3E6E8] dark:border-[#2A2F35] divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] overflow-hidden shadow-xs">
            {periodButtons.map((btn) => {
              const active = period === btn.id && !showCustomDate;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => {
                    setPeriod(btn.id);
                    setShowCustomDate(false);
                  }}
                  className={`w-full px-4 py-2.5 text-xs flex items-center justify-between transition cursor-pointer ${
                    active
                      ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] font-bold'
                      : 'text-[#4A515B] dark:text-[#A3AAB3] font-medium'
                  }`}
                >
                  <span>{btn.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-[#14161A] dark:text-[#D4F56B]" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowCustomDate((v) => !v)}
              className={`w-full px-4 py-2.5 text-xs flex items-center justify-between transition cursor-pointer ${
                period === 'custom' || showCustomDate
                  ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] font-bold'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] font-medium'
              }`}
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>Pick Dates</span>
              </span>
              {(period === 'custom' || showCustomDate) && (
                <Check className="w-3.5 h-3.5 text-[#14161A] dark:text-[#D4F56B]" />
              )}
            </button>
          </div>

          {/* Tablet / Desktop: Single-row Pill Bar */}
          <div className="hidden sm:inline-flex items-center gap-0.5 bg-white dark:bg-[#181B1F] p-1 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] shadow-xs w-fit">
            {periodButtons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => {
                  setPeriod(btn.id);
                  setShowCustomDate(false);
                }}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-full transition focus:outline-none cursor-pointer whitespace-nowrap ${
                  period === btn.id
                    ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
                    : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustomDate((v) => !v)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-full transition focus:outline-none flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                period === 'custom' || showCustomDate
                  ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Pick Dates</span>
            </button>
          </div>

          {showCustomDate && (
            <form
              onSubmit={handleApplyCustomDate}
              className="grid grid-cols-2 sm:flex sm:items-center gap-2 bg-white dark:bg-[#181B1F] p-3 sm:p-1.5 sm:px-3 rounded-[18px] sm:rounded-full border border-[#E3E6E8] dark:border-[#2A2F35]"
            >
              <input
                type="date"
                aria-label="Start date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                required
                className="text-xs bg-transparent text-[#14161A] dark:text-[#F2F4F5] focus:outline-none border sm:border-0 border-[#E3E6E8] dark:border-[#2A2F35] rounded-lg px-2 py-1.5 sm:p-0"
              />
              <span className="hidden sm:inline text-xs text-[#636B76]">to</span>
              <input
                type="date"
                aria-label="End date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                required
                className="text-xs bg-transparent text-[#14161A] dark:text-[#F2F4F5] focus:outline-none border sm:border-0 border-[#E3E6E8] dark:border-[#2A2F35] rounded-lg px-2 py-1.5 sm:p-0"
              />
              <button
                type="submit"
                className="col-span-2 sm:col-span-1 px-3 py-1.5 sm:py-1 rounded-full bg-[#D4F56B] text-[#14161A] text-[11px] font-bold cursor-pointer"
              >
                Apply
              </button>
            </form>
          )}
        </div>
      </div>

      {/* PASTEL KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Lavender (Sales) */}
        <div className="rounded-[20px] p-5 bg-[#C9C3F5] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.06em] uppercase text-[#14161A]/80">
              Money From Sales
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none">
              {formatPKR(kpis.revenue)}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-[#14161A]/85">
              <span>{formatNumber(kpis.totalPiecesSold)} birds sold</span>
              <span className="bg-white/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                {periodLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Sky (Birds Ready to Sell) */}
        <div
          onClick={() => onNavigate('inventory')}
          className="rounded-[20px] p-5 bg-[#A9C8FA] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[150px] transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.06em] uppercase text-[#14161A]/80">
              Birds Ready to Sell
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none font-mono">
              {formatNumber(kpis.totalAvailableStock)} birds
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-[#14161A]/85">
              <span>In shop right now</span>
              <span className="bg-white/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                {kpis.totalAvailableStock > 200 ? 'Plenty Left' : 'Running Low'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Mint (Profit Before Bills) */}
        <div className="rounded-[20px] p-5 bg-[#92E2B3] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.06em] uppercase text-[#14161A]/80">
              Profit Before Bills
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none">
              {formatPKR(kpis.grossProfit)}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-[#14161A]/85">
              <span>Cost of birds: {formatPKR(kpis.cogs)}</span>
              <span className="bg-white/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                {kpis.revenue > 0
                  ? `${((kpis.grossProfit / kpis.revenue) * 100).toFixed(1)}%`
                  : '0%'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Butter (Profit In Hand) */}
        <div className="rounded-[20px] p-5 bg-[#F6E7A1] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.06em] uppercase text-[#14161A]/80">
              Profit In Hand
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[24px] sm:text-[26px] font-black tracking-tight leading-none">
              {formatPKR(kpis.netProfit)}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-[#14161A]/85">
              <span>Shop bills & pay: {formatPKR(kpis.generalExpenses + kpis.workerPayments)}</span>
              <span className="bg-white/80 text-[#14161A] px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                {kpis.netProfit >= 0 ? 'Profit' : 'Loss'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN 12-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 9 COLUMNS */}
        <div className="lg:col-span-9 space-y-6">
          {/* Dual-Bar Activity Chart */}
          <div className="rounded-[20px] p-5 sm:p-6 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
              <div>
                <h3 className="text-base font-bold text-[#14161A] dark:text-[#F2F4F5]">
                  Daily Sales vs What Birds Cost
                </h3>
                <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
                  Tap or click any day bar to see exact rupee numbers
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#F8F9FA] dark:bg-[#1F2328] border border-[#E3E6E8] dark:border-[#2A2F35] p-1 rounded-full text-[11px] font-bold">
                  {(['7D', '30D', '90D'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setChartTimeframe(t)}
                      className={`px-3 py-1 rounded-full transition focus:outline-none cursor-pointer ${
                        chartTimeframe === t
                          ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5]'
                          : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('reports')}
                  className="px-3.5 py-1.5 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] text-[11px] font-bold uppercase transition shadow-xs whitespace-nowrap cursor-pointer"
                >
                  Full Report
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              {/* Y-Axis Scale */}
              <div className="hidden sm:flex flex-col justify-between h-48 pt-6 pb-6 text-[10px] font-mono font-semibold text-[#636B76] dark:text-[#8A929C] text-right shrink-0 w-12">
                <span>{formatShortNum(maxBarValue)}</span>
                <span>{formatShortNum(Math.round(maxBarValue / 2))}</span>
                <span>0</span>
              </div>

              <div className="flex-1 overflow-x-auto">
                <div className="h-56 flex items-end justify-between gap-1.5 sm:gap-2 pt-6 px-1 min-w-[360px] relative">
                  {(charts.daily || []).map((day) => {
                    const revHeight =
                      day.revenue > 0
                        ? Math.max(16, Math.round((day.revenue / maxBarValue) * 145))
                        : 3;
                    const cogsHeight =
                      day.cogs > 0
                        ? Math.max(16, Math.round((day.cogs / maxBarValue) * 145))
                        : 3;
                    const isSelected = activeDay?.date === day.date;

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedChartDate(day.date)}
                        className={`flex-1 flex flex-col items-center group relative rounded-xl py-1 px-0.5 transition cursor-pointer ${
                          isSelected ? 'bg-[#F3F5F6] dark:bg-[#20242A]' : 'hover:bg-[#F3F5F6]/50 dark:hover:bg-[#20242A]/50'
                        }`}
                      >
                        {day.revenue > 0 && (
                          <span className="text-[10px] font-mono font-bold text-[#14161A] dark:text-[#F2F4F5] mb-1">
                            {formatShortNum(day.revenue)}
                          </span>
                        )}

                        <div className="w-full flex items-end justify-center space-x-1 h-40">
                          <div
                            style={{ height: `${revHeight}px` }}
                            className={`w-1/2 max-w-[22px] rounded-t-[6px] transition ${
                              day.revenue > 0 ? 'bg-[#C9C3F5]' : 'bg-[#E3E6E8] dark:bg-[#2A2F35]'
                            }`}
                          />
                          <div
                            style={{ height: `${cogsHeight}px` }}
                            className={`w-1/2 max-w-[22px] rounded-t-[6px] transition ${
                              day.cogs > 0 ? 'bg-[#92E2B3]' : 'bg-[#E3E6E8] dark:bg-[#2A2F35]'
                            }`}
                          />
                        </div>

                        <span
                          className={`text-[10px] sm:text-[11px] font-bold font-mono mt-1.5 truncate w-full text-center ${
                            isSelected
                              ? 'text-[#14161A] dark:text-[#D4F56B]'
                              : 'text-[#636B76] dark:text-[#8A929C]'
                          }`}
                        >
                          {day.date}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {activeDay && (
              <div className="mt-3 p-3 rounded-[14px] bg-[#F8F9FA] dark:bg-[#20242A] border border-[#E3E6E8] dark:border-[#2A2F35] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono font-bold text-[#14161A] dark:text-[#D4F56B]">
                  Day {activeDay.date} ({activeDay.piecesSold} birds)
                </span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                  <span>
                    Sold: <strong>{formatPKR(activeDay.revenue)}</strong>
                  </span>
                  <span>
                    Bird Cost: <strong>{formatPKR(activeDay.cogs)}</strong>
                  </span>
                  <span>
                    Bills: <strong>{formatPKR(activeDay.expenses)}</strong>
                  </span>
                  <span
                    className={`font-bold ${
                      activeDay.netProfit >= 0
                        ? 'text-[#2FB67C]'
                        : 'text-[#D95C5C] dark:text-[#FF8585]'
                    }`}
                  >
                    Profit: {formatSignedPKR(activeDay.netProfit)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-center gap-6 text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3]">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-[4px] bg-[#C9C3F5]" />
                Money From Sales
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-[4px] bg-[#92E2B3]" />
                What Sold Birds Cost
              </span>
            </div>
          </div>

          {/* Recent Sales Card (Table on md+, Cards on Mobile) */}
          <div className="rounded-[20px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#14161A] dark:text-[#F2F4F5]">
                  Latest Sales
                </h3>
                <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
                  Your newest walk-in shop bills and deliveries to other shops
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('own-shop-sales')}
                className="px-3.5 py-1.5 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] text-xs font-bold uppercase tracking-wider transition shrink-0 cursor-pointer"
              >
                See All
              </button>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E3E6E8] dark:border-[#2A2F35] text-[#636B76] dark:text-[#8A929C] text-[11px] font-bold uppercase tracking-wider bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50">
                    <th className="py-3 px-4">Bill #</th>
                    <th className="py-3 px-4">Sold To</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Birds</th>
                    <th className="py-3 px-4 text-right">Cash</th>
                    <th className="py-3 px-4 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
                  {recent.sales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-[#636B76]">
                        No sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recent.sales.slice(0, 5).map((sale) => (
                      <tr
                        key={sale.id}
                        className="hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#14161A] dark:text-white">
                          {sale.invoiceNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              sale.saleType === 'OWN_SHOP'
                                ? 'bg-[#C9C3F5] text-[#14161A]'
                                : 'bg-[#A9C8FA] text-[#14161A]'
                            }`}
                          >
                            {sale.saleType === 'OWN_SHOP' ? 'Walk-in Shop' : sale.shopName || 'Other Shop'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#4A515B] dark:text-[#A3AAB3]">
                          {formatDate(sale.saleDate)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold">
                          {sale.totalPieces} birds
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#14161A] dark:text-white">
                          {formatPKR(sale.totalAmount)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold ${
                            Number(sale.totalProfit) >= 0
                              ? 'text-[#2FB67C]'
                              : 'text-[#D95C5C] dark:text-[#FF8585]'
                          }`}
                        >
                          {formatSignedPKR(sale.totalProfit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
              {recent.sales.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#636B76]">No sales recorded yet.</div>
              ) : (
                recent.sales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#14161A] dark:text-white">
                          {sale.invoiceNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            sale.saleType === 'OWN_SHOP'
                              ? 'bg-[#C9C3F5] text-[#14161A]'
                              : 'bg-[#A9C8FA] text-[#14161A]'
                          }`}
                        >
                          {sale.saleType === 'OWN_SHOP' ? 'Walk-in Shop' : sale.shopName || 'Other Shop'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-1">
                        {formatDate(sale.saleDate)} · {sale.totalPieces} birds
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-xs text-[#14161A] dark:text-white">
                        {formatPKR(sale.totalAmount)}
                      </div>
                      <div
                        className={`font-mono font-bold text-[11px] ${
                          Number(sale.totalProfit) >= 0
                            ? 'text-[#2FB67C]'
                            : 'text-[#D95C5C] dark:text-[#FF8585]'
                        }`}
                      >
                        {formatSignedPKR(sale.totalProfit)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT 3 COLUMNS */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-[20px] p-5 bg-[#17807D] dark:bg-[#146B69] text-white shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#D4F56B]">
                Fast Sale
              </span>
              <ShoppingCart className="w-5 h-5 text-[#D4F56B]" />
            </div>

            <div>
              <h4 className="text-lg font-bold leading-tight">Write a New Sale</h4>
              <p className="text-xs text-white/85 mt-1">
                Enter birds sold and cash taken. Your oldest birds are subtracted automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenQuickSale}
              className="w-full py-2.5 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Shop Sale</span>
            </button>
          </div>

          <div className="rounded-[20px] p-5 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#636B76] dark:text-[#8A929C]">
                Owed to Dealers
              </span>
              <Users className="w-4 h-4 text-[#4A515B] dark:text-[#A3AAB3]" />
            </div>

            <div className="text-2xl font-black font-mono text-[#F5B544]">
              {formatPKR(kpis.dealerOutstandingBalance)}
            </div>

            <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3]">
              Total unpaid amount owed to chicken truck suppliers.
            </p>

            <button
              type="button"
              onClick={() => onNavigate('dealer-ledger')}
              className="w-full py-2.5 rounded-xl border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <span>See Dealer Accounts</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-[20px] p-5 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#636B76] dark:text-[#8A929C]">
                Latest Chicken Trucks
              </span>
              <button
                type="button"
                onClick={() => onNavigate('purchases')}
                className="text-[11px] font-bold text-[#14161A] dark:text-white hover:underline cursor-pointer"
              >
                See All
              </button>
            </div>

            <div className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] text-xs">
              {recent.purchases.slice(0, 3).map((load) => (
                <div key={load.id} className="py-2.5 first:pt-0 last:pb-0 space-y-0.5">
                  <div className="flex items-center justify-between font-mono font-bold text-[#14161A] dark:text-white">
                    <span>{load.loadNumber}</span>
                    <span>{formatPKR(load.purchaseAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#4A515B] dark:text-[#A3AAB3]">
                    <span className="truncate max-w-[130px]">{load.supplierName}</span>
                    <span>{formatNumber(load.totalWeightKg)} KG</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenNewLoad}
              className="w-full mt-2 py-2.5 rounded-xl bg-[#F3F5F6] dark:bg-[#1F2328] hover:bg-[#EDEEEF] dark:hover:bg-[#272C33] text-xs font-bold text-[#14161A] dark:text-white uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Add New Truck</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

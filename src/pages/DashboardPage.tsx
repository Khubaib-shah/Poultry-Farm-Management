import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  Calendar,
  Filter,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { DashboardData } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatPKR, formatNumber, formatDate } from '../utils/formatters.ts';

interface DashboardPageProps {
  onNavigate: (tab: any) => void;
  onOpenQuickSale: () => void;
  onOpenNewLoad: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenQuickSale,
  onOpenNewLoad,
}) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('today');
  const [chartTimeframe, setChartTimeframe] = useState<'7D' | '30D' | '90D'>('7D');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboard({
        period,
        startDate: customStart || undefined,
        endDate: customEnd || undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period]);

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      setPeriod('custom');
      loadData();
    }
  };

  if (loading && !data) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-9 h-9 border-3 border-[#D4F56B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#636B76] dark:text-[#8A929C] font-semibold tracking-wider uppercase">
            Loading Island Canopy Metrics...
          </p>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {
    revenue: 0,
    ownShopRevenue: 0,
    wholesaleRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    netProfit: 0,
    generalExpenses: 0,
    workerPayments: 0,
    totalAvailableStock: 0,
    totalPurchaseAmount: 0,
    totalPurchaseWeight: 0,
    totalLoadExpenses: 0,
    dealerOutstandingBalance: 0,
    totalPiecesSold: 0,
  };

  // Find max value for chart scaling
  const maxBarValue = Math.max(
    ...((data?.charts?.daily || []).map((d) => Math.max(d.revenue, d.cogs, 1000))),
    1000
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* ------------------------------------------------------------- */}
      {/* SECTION TITLE & DATE FILTER STRIP (Zero Wrap)                 */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Business Overview
          </h1>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Real-time poultry farm telemetry, live stock levels, and daily profit margins
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-[#181B1F] p-1.5 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] shadow-xs">
          {[
            { id: 'today', label: 'TODAY' },
            { id: 'yesterday', label: 'YESTERDAY' },
            { id: 'last7days', label: '7 DAYS' },
            { id: 'thismonth', label: 'THIS MONTH' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setPeriod(btn.id)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-full tracking-wider transition ${
                period === btn.id
                  ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PASTEL KPI TRIO + HIGHLIGHT CARDS (20px Rounded Geometries)   */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pastel Lavender #C9C3F5 (Revenue) */}
        <div className="rounded-[20px] p-5 bg-[#C9C3F5] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[160px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Total Revenue
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none">
              {formatPKR(kpis.revenue)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#14161A]/85">
              <span>{kpis.totalPiecesSold} pcs sold</span>
              <span className="bg-white/80 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {period.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Pastel Sky #A9C8FA (Live Stock) */}
        <div className="rounded-[20px] p-5 bg-[#A9C8FA] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[160px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Available Live Stock
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none font-mono">
              {formatNumber(kpis.totalAvailableStock)} pcs
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#14161A]/85">
              <span>Ready for FIFO sale</span>
              <span className="bg-white/80 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {kpis.totalAvailableStock > 200 ? 'HEALTHY' : 'LOW STOCK'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Pastel Mint #92E2B3 (Gross Profit) */}
        <div className="rounded-[20px] p-5 bg-[#92E2B3] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[160px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Gross Profit
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none">
              {formatPKR(kpis.grossProfit)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#14161A]/85">
              <span>COGS: {formatPKR(kpis.cogs)}</span>
              <span className="bg-white/80 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {kpis.revenue > 0 ? `${((kpis.grossProfit / kpis.revenue) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Pastel Butter #F6E7A1 (Net Profit) */}
        <div className="rounded-[20px] p-5 bg-[#F6E7A1] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[160px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Net Profit
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none">
              {formatPKR(kpis.netProfit)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#14161A]/85">
              <span>Overhead: {formatPKR(kpis.generalExpenses + kpis.workerPayments)}</span>
              <span className="bg-[#14161A] text-[#D4F56B] px-2 py-0.5 rounded-full text-[10px] font-bold">
                {kpis.netProfit >= 0 ? 'PROFIT' : 'DEFICIT'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 12-COLUMN RESPONSIVE LAYOUT (9 Columns Main + 3 Columns Side) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 9 COLUMNS */}
        <div className="lg:col-span-9 space-y-6">
          {/* Dual-Bar Activity Chart Card */}
          <div className="rounded-[20px] p-6 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-3 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
              <div>
                <h3 className="text-base font-bold text-[#14161A] dark:text-[#F2F4F5] whitespace-nowrap">
                  Sales & Cost Velocity
                </h3>
                <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
                  Daily revenue vs FIFO cost of sold birds over last 7 days
                </p>
              </div>

              {/* Timeframe pill selector + Lime Export button */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#F3F5F6] dark:bg-[#1F2328] p-1 rounded-full text-[11px] font-bold">
                  {(['7D', '30D', '90D'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setChartTimeframe(t)}
                      className={`px-3 py-1 rounded-full transition ${
                        chartTimeframe === t
                          ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
                          : 'text-[#4A515B] dark:text-[#A3AAB3]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => onNavigate('reports')}
                  className="px-3 py-1.5 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] text-[11px] font-bold tracking-wider uppercase transition shadow-xs whitespace-nowrap shrink-0 min-w-fit leading-none"
                >
                  FULL REPORT
                </button>
              </div>
            </div>

            {/* Dual Bar Display (Lavender #C9C3F5 for Revenue, Mint #92E2B3 for Cost) */}
            <div className="h-56 flex items-end justify-between gap-2 pt-2 px-2">
              {(data?.charts?.daily || []).map((day) => {
                const revHeight = Math.max(6, Math.round((day.revenue / maxBarValue) * 170));
                const cogsHeight = Math.max(6, Math.round((day.cogs / maxBarValue) * 170));

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center group relative">
                    {/* Hover Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition absolute -top-14 z-20 bg-[#14161A] text-white text-[10px] p-2 rounded-xl pointer-events-none whitespace-nowrap shadow-lg">
                      <div className="font-bold text-[#D4F56B]">Day: {day.date}</div>
                      <div>Revenue: {formatPKR(day.revenue)}</div>
                      <div>COGS: {formatPKR(day.cogs)}</div>
                      <div>Net: {formatPKR(day.netProfit)}</div>
                    </div>

                    <div className="w-full flex items-end justify-center space-x-1.5 h-44">
                      {/* Revenue Bar: Lavender #C9C3F5 */}
                      <div
                        style={{ height: `${revHeight}px` }}
                        className="w-1/2 bg-[#C9C3F5] rounded-t-[6px] hover:brightness-95 transition"
                      />
                      {/* COGS Bar: Mint #92E2B3 */}
                      <div
                        style={{ height: `${cogsHeight}px` }}
                        className="w-1/2 bg-[#92E2B3] rounded-t-[6px] hover:brightness-95 transition"
                      />
                    </div>

                    <span className="text-[11px] font-bold font-mono text-[#636B76] dark:text-[#8A929C] mt-2.5 truncate w-full text-center">
                      {day.date}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Chart Legend */}
            <div className="mt-4 pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-center gap-6 text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3]">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-[4px] bg-[#C9C3F5]" />
                Sales Revenue
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-[4px] bg-[#92E2B3]" />
                Landed COGS (FIFO)
              </span>
            </div>
          </div>

          {/* Recent Counter Sales Table with Zero-Wrap Safeguards */}
          <div className="rounded-[20px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] overflow-hidden">
            <div className="p-5 border-b border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#14161A] dark:text-[#F2F4F5] whitespace-nowrap">
                  Recent Sales Dispatches
                </h3>
                <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
                  Latest retail counter and wholesale distribution orders
                </p>
              </div>

              <button
                onClick={() => onNavigate('own-shop-sales')}
                className="px-3 py-1.5 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] text-xs font-bold uppercase tracking-wider transition shrink-0 whitespace-nowrap min-w-fit leading-none"
              >
                VIEW ALL
              </button>
            </div>

            <div className="overflow-x-auto pb-1">
              <table className="w-full text-left text-xs min-w-[620px]">
                <thead>
                  <tr className="border-b border-[#E3E6E8] dark:border-[#2A2F35] text-[#636B76] dark:text-[#8A929C] text-[11px] font-bold uppercase tracking-wider bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50">
                    <th className="py-3 px-4 whitespace-nowrap">Invoice</th>
                    <th className="py-3 px-4 whitespace-nowrap">Channel</th>
                    <th className="py-3 px-4 whitespace-nowrap">Date</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Pieces</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Revenue</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Gross Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
                  {(data?.recent?.sales || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-[#636B76]">
                        No recent sales recorded.
                      </td>
                    </tr>
                  ) : (
                    (data?.recent?.sales || []).slice(0, 5).map((sale) => (
                      <tr
                        key={sale.id}
                        className="hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#14161A] dark:text-white whitespace-nowrap">
                          {sale.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              sale.saleType === 'OWN_SHOP'
                                ? 'bg-[#C9C3F5] text-[#14161A]'
                                : 'bg-[#A9C8FA] text-[#14161A]'
                            }`}
                          >
                            {sale.saleType === 'OWN_SHOP' ? 'Own Shop' : 'Wholesale'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#4A515B] dark:text-[#A3AAB3] whitespace-nowrap">
                          {formatDate(sale.saleDate)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap">
                          {sale.totalPieces} pcs
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#14161A] dark:text-white whitespace-nowrap">
                          {formatPKR(sale.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#2FB67C] whitespace-nowrap">
                          +{formatPKR(sale.totalProfit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT 3 COLUMNS (Side Feature Cards, Dealer Credit, Fast Actions) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Card Teal Callout: Quick Counter Action */}
          <div className="rounded-[20px] p-5 bg-[#17807D] dark:bg-[#146B69] text-white shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#D4F56B]">
                Fast Operations
              </span>
              <ShoppingCart className="w-5 h-5 text-[#D4F56B]" />
            </div>

            <div>
              <h4 className="text-lg font-bold leading-tight">Ready for a sale?</h4>
              <p className="text-xs text-white/80 mt-1">
                Enter quantity and amount to automatically deduct stock from oldest Punjab batches.
              </p>
            </div>

            <button
              onClick={onOpenQuickSale}
              className="w-full py-2.5 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>COUNTER SALE (N)</span>
            </button>
          </div>

          {/* Dealer Balance Card */}
          <div className="rounded-[20px] p-5 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#636B76] dark:text-[#8A929C]">
                Dealer Payables
              </span>
              <Users className="w-4 h-4 text-[#4A515B] dark:text-[#A3AAB3]" />
            </div>

            <div className="text-2xl font-black font-mono text-[#F5B544]">
              {formatPKR(kpis.dealerOutstandingBalance)}
            </div>

            <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3]">
              Total outstanding balance owed across Punjab broiler suppliers.
            </p>

            <button
              onClick={() => onNavigate('dealer-ledger')}
              className="w-full py-2 rounded-xl border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider flex items-center justify-center gap-1 transition"
            >
              <span>View Ledger</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Recent Load Arrivals */}
          <div className="rounded-[20px] p-5 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#636B76] dark:text-[#8A929C]">
                Latest Loads
              </span>
              <button
                onClick={() => onNavigate('purchases')}
                className="text-[11px] font-bold text-[#14161A] dark:text-white hover:underline"
              >
                All Loads
              </button>
            </div>

            <div className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] text-xs">
              {(data?.recent?.purchases || []).slice(0, 3).map((load) => (
                <div key={load.id} className="py-2.5 first:pt-0 last:pb-0 space-y-0.5">
                  <div className="flex items-center justify-between font-mono font-bold text-[#14161A] dark:text-white">
                    <span>{load.loadNumber}</span>
                    <span>{formatPKR(load.purchaseAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#4A515B] dark:text-[#A3AAB3]">
                    <span className="truncate max-w-[120px]">{load.supplierName}</span>
                    <span>{formatNumber(load.totalWeightKg)} KG</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onOpenNewLoad}
              className="w-full mt-2 py-2 rounded-xl bg-[#F3F5F6] dark:bg-[#1F2328] hover:bg-[#EDEEEF] dark:hover:bg-[#272C33] text-xs font-bold text-[#14161A] dark:text-white uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>New Vehicle Load</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

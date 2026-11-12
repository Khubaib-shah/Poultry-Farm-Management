import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Filter,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ReportData } from '../types/index.ts';
import { api } from '../services/api.ts';
import { MetricCard } from '../components/common/MetricCard.tsx';
import { formatPKR, formatNumber, formatDate } from '../utils/formatters.ts';

interface ReportsPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onShowToast }) => {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeType, setRangeType] = useState<'today' | 'yesterday' | 'weekly' | 'monthly' | 'custom'>('today');

  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const fetchReport = async (s: string, e: string) => {
    try {
      setLoading(true);
      const res = await api.getReports(s, e);
      setData(res);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to load report data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (type: 'today' | 'yesterday' | 'weekly' | 'monthly') => {
    setRangeType(type);
    const now = new Date();
    let s = todayStr;
    let e = todayStr;

    if (type === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      s = y.toISOString().split('T')[0];
      e = s;
    } else if (type === 'weekly') {
      const w = new Date();
      w.setDate(w.getDate() - 6);
      s = w.toISOString().split('T')[0];
      e = todayStr;
    } else if (type === 'monthly') {
      s = `${todayStr.substring(0, 7)}-01`;
      e = todayStr;
    }

    setStartDate(s);
    setEndDate(e);
    fetchReport(s, e);
  };

  useEffect(() => {
    fetchReport(startDate, endDate);
  }, []);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setRangeType('custom');
    fetchReport(startDate, endDate);
  };

  const handleExportExcel = () => {
    if (!data) return;

    // Create Worksheets
    const summaryRows = [
      ['AL-MADINA POULTRY TRADERS - PROFIT & LOSS REPORT'],
      ['Period', `${formatDate(data.startDate)} to ${formatDate(data.endDate)}`],
      ['Generated On', new Date().toLocaleString('en-PK')],
      [''],
      ['FINANCIAL METRIC', 'AMOUNT (PKR)', 'NOTES / PERCENTAGE'],
      ['Own Shop Retail Sales', data.summary.ownShopRevenue, 'Counter retail sales'],
      ['Wholesale Shop Distribution', data.summary.wholesaleRevenue, 'Delivered to retail butcher shops'],
      ['TOTAL SALES REVENUE', data.summary.totalRevenue, '100%'],
      ['Cost of Goods Sold (COGS)', data.summary.cogs, 'FIFO stock batch landed cost'],
      ['GROSS PROFIT', data.summary.grossProfit, `${data.summary.grossMarginPercent}% margin`],
      ['General Operating Expenses', data.summary.generalExpenses, 'Electricity, rent, food, tea, maintenance'],
      ['Worker Payments & Bhatta', data.summary.workerPayments, 'Disbursed wage payments'],
      ['NET PROFIT', data.summary.netProfit, `${data.summary.netMarginPercent}% net margin`],
      [''],
      ['OPERATIONAL QUANTITIES', ''],
      ['Total Pieces Sold', data.summary.totalPiecesSold],
      ['Total Live Purchases Loaded (KG)', data.summary.totalPurchasesWeight],
      ['Total Live Purchase Cost (PKR)', data.summary.totalPurchasesAmount],
      ['Load Transit Expenses (PKR)', data.summary.totalLoadExpenses],
    ];

    const salesRows = [
      ['INVOICE NUMBER', 'DATE', 'TYPE', 'SHOP / DESTINATION', 'PIECES', 'SELLING RATE', 'COGS (FIFO)', 'TOTAL REVENUE', 'PROFIT'],
      ...(data.sales || []).map((s) => [
        s.invoiceNumber,
        s.saleDate,
        s.saleType,
        s.shopName || 'Own Shop Counter',
        s.totalPieces,
        Number(s.sellingPricePerPiece),
        Number(s.totalCost),
        Number(s.totalAmount),
        Number(s.totalProfit),
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    const wsSales = XLSX.utils.aoa_to_sheet(salesRows);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Profit & Loss Statement');
    XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Breakdown');

    const fileName = `Poultry_PnL_Report_${data.startDate}_to_${data.endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    onShowToast(`Report exported to Excel: ${fileName}`, 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const sum = data?.summary || {
    totalRevenue: 0,
    ownShopRevenue: 0,
    wholesaleRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMarginPercent: 0,
    generalExpenses: 0,
    workerPayments: 0,
    netProfit: 0,
    netMarginPercent: 0,
    totalPiecesSold: 0,
    totalPurchasesAmount: 0,
    totalPurchasesWeight: 0,
    totalLoadExpenses: 0,
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto print:p-0">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Profit & Loss Reports
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Official income statements with FIFO inventory costing and operating expense breakdown
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Export to Excel (.xlsx)
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Print Report
          </button>
        </div>
      </div>

      {/* Date Filter Bar Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs print:hidden">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-[#636B76] dark:text-[#8A929C] mr-1" />
          <span className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] mr-1">Report Period:</span>
          {(['today', 'yesterday', 'weekly', 'monthly'] as const).map((btn) => (
            <button
              key={btn}
              onClick={() => handleSelectPreset(btn)}
              className={`px-3 py-1 text-xs rounded-full font-bold tracking-wider transition ${
                rangeType === btn
                  ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
                  : 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
              }`}
            >
              {btn === 'today'
                ? 'DAILY (TODAY)'
                : btn === 'yesterday'
                ? 'YESTERDAY'
                : btn === 'weekly'
                ? 'WEEKLY (7D)'
                : 'MONTHLY'}
            </button>
          ))}
        </div>

        <form onSubmit={handleApplyCustom} className="flex items-center space-x-2">
          <span className="text-xs text-[#636B76] dark:text-[#8A929C] font-semibold">Custom:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5]"
          />
          <span className="text-[#636B76] dark:text-[#8A929C] text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5]"
          />
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-bold bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A] rounded-full hover:opacity-90 transition"
          >
            Generate
          </button>
        </form>
      </div>

      {/* Report Header for Print - Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-8 space-y-6 shadow-xs">
        <div className="text-center pb-5 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
          <h1 className="text-2xl font-black text-[#14161A] dark:text-[#F2F4F5] tracking-tight">
            AL-MADINA POULTRY TRADERS
          </h1>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] font-semibold mt-1">
            Profit & Loss Financial Statement
          </p>
          <p className="text-xs text-[#636B76] dark:text-[#8A929C] mt-1 font-mono">
            Reporting Period: {formatDate(startDate)} to {formatDate(endDate)}
          </p>
        </div>

        {/* FINANCIAL SUMMARY TABLE */}
        <div className="max-w-2xl mx-auto border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[16px] overflow-hidden text-xs">
          <div className="bg-[#F8F9FA] dark:bg-[#20242A] px-4 py-3 font-bold uppercase tracking-wider text-[#14161A] dark:text-[#F2F4F5] border-b border-[#E3E6E8] dark:border-[#2A2F35]">
            Statement of Operations
          </div>
          <table className="w-full text-left">
            <tbody className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
              {/* Revenue */}
              <tr className="bg-slate-50/40">
                <td className="py-2.5 px-4 font-bold text-slate-900">Total Sales Revenue</td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                  {formatPKR(sum.totalRevenue)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-6 text-slate-600">-- Own Shop Retail Counter</td>
                <td className="py-1.5 px-4 text-right font-mono text-slate-700">
                  {formatPKR(sum.ownShopRevenue)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-6 text-slate-600">-- Wholesale Shop Distribution</td>
                <td className="py-1.5 px-4 text-right font-mono text-slate-700">
                  {formatPKR(sum.wholesaleRevenue)}
                </td>
              </tr>

              {/* COGS */}
              <tr className="bg-slate-50/40">
                <td className="py-2.5 px-4 font-bold text-slate-800">
                  Cost of Goods Sold (FIFO Landed Cost) (-)
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-800">
                  {formatPKR(sum.cogs)}
                </td>
              </tr>

              {/* Gross Profit */}
              <tr className="bg-emerald-50/60 font-bold border-y border-emerald-200">
                <td className="py-2.5 px-4 text-emerald-950">
                  GROSS PROFIT (=) <span className="text-[11px] font-normal">({sum.grossMarginPercent}% margin)</span>
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-emerald-800 text-sm">
                  {formatPKR(sum.grossProfit)}
                </td>
              </tr>

              {/* Operating Expenses */}
              <tr className="bg-slate-50/40">
                <td className="py-2 px-4 font-bold text-slate-800">
                  Operating Overhead Expenses (-)
                </td>
                <td className="py-2 px-4 text-right font-mono text-slate-800">
                  {formatPKR(sum.generalExpenses + sum.workerPayments)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-6 text-slate-600">-- General Business Expenses (Electricity, rent, food, tea)</td>
                <td className="py-1.5 px-4 text-right font-mono text-slate-700">
                  {formatPKR(sum.generalExpenses)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-6 text-slate-600">-- Worker Wage & Bhatta Payments</td>
                <td className="py-1.5 px-4 text-right font-mono text-slate-700">
                  {formatPKR(sum.workerPayments)}
                </td>
              </tr>

              {/* Net Profit */}
              <tr className="bg-slate-900 text-white font-bold text-sm">
                <td className="py-3 px-4">
                  NET PROFIT (=) <span className="text-xs font-normal opacity-80">({sum.netMarginPercent}% net margin)</span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-emerald-400 text-base">
                  {formatPKR(sum.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Operating Notes */}
        <div className="max-w-2xl mx-auto p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">Accounting & Audit Notes:</p>
          <p>
            1. Vehicle transit and load expenses are capitalized into stock batch landed cost and are recognized via FIFO COGS as pieces are sold.
          </p>
          <p>
            2. Dealer credit payments are ledger transfers and are not double-counted as operating expenses.
          </p>
          <p>
            3. Net profit is recognized on an accrual sale date basis, not cash received.
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Calculator,
  History,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  CheckCircle2,
  DollarSign,
  Plus,
  Sliders,
  Scale,
} from 'lucide-react';
import { StockBatch, StockMovement, AppSettings } from '../types/index.ts';
import { api } from '../services/api.ts';
import { Modal } from '../components/common/Modal.tsx';
import { formatPKR, formatNumber, formatDate, formatDateTime } from '../utils/formatters.ts';
import { getCostAnalysisStatus } from '../utils/poultryMath.ts';

interface InventoryPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ onShowToast }) => {
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'batches' | 'calculator' | 'movements'>('batches');
  const [searchQuery, setSearchQuery] = useState('');

  // Cost calculator active batch
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [proposedPrice, setProposedPrice] = useState<string>('1850');

  // Manual stock adjustment modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustBatchId, setAdjustBatchId] = useState<string>('');
  const [quantityChange, setQuantityChange] = useState<string>('-5');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [batchesRes, movementsRes, settingsRes] = await Promise.all([
        api.getBatches(),
        api.getMovements(),
        api.getSettings(),
      ]);
      setBatches(batchesRes);
      setMovements(movementsRes);
      setSettings(settingsRes);
      if (batchesRes.length > 0 && !selectedBatch) {
        setSelectedBatch(batchesRes[0]);
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to load inventory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustBatchId || !quantityChange || parseInt(quantityChange, 10) === 0) {
      onShowToast('Please provide a valid stock batch and non-zero adjustment quantity', 'error');
      return;
    }

    try {
      setAdjustSubmitting(true);
      await api.adjustStock({
        stockBatchId: parseInt(adjustBatchId, 10),
        quantityChange: parseInt(quantityChange, 10),
        reason: adjustReason || 'Physical stock audit adjustment',
        adjustmentType: parseInt(quantityChange, 10) < 0 ? 'DAMAGE' : 'ADJUSTMENT',
      });
      onShowToast('Stock count adjusted successfully and recorded in ledger', 'success');
      setIsAdjustOpen(false);
      setQuantityChange('-5');
      setAdjustReason('');
      await fetchData();
    } catch (err: any) {
      onShowToast(err.message || 'Stock adjustment failed', 'error');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Filter batches
  const filteredBatches = batches.filter((b) => {
    return (
      b.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.supplierName && b.supplierName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const totalStockPieces = batches
    .filter((b) => !b.isClosed)
    .reduce((sum, b) => sum + b.remainingPieces, 0);

  const totalStockValue = batches
    .filter((b) => !b.isClosed)
    .reduce((sum, b) => sum + b.remainingPieces * Number(b.costPerPiece), 0);

  // Example selling prices from settings
  const examplePrice1 = Number(settings?.examplePrice1 || 1200);
  const examplePrice2 = Number(settings?.examplePrice2 || 1500);

  const calcCost = selectedBatch ? Number(selectedBatch.costPerPiece) : 0;
  const calcSellingPrice = parseFloat(proposedPrice) || 0;
  const analysis = getCostAnalysisStatus(calcSellingPrice, calcCost);
  const analysisEx1 = getCostAnalysisStatus(examplePrice1, calcCost);
  const analysisEx2 = getCostAnalysisStatus(examplePrice2, calcCost);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top summary row - Pastel Island Trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Pastel Sky */}
        <div className="rounded-[20px] p-5 bg-[#A9C8FA] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Total Available Inventory
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none font-mono">
              {formatNumber(totalStockPieces)} pcs
            </div>
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              Across {batches.filter((b) => !b.isClosed).length} active FIFO batches
            </p>
          </div>
        </div>

        {/* Card 2: Pastel Mint */}
        <div className="rounded-[20px] p-5 bg-[#92E2B3] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between h-[150px] transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[#14161A]/80">
              Total Landed Value
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-[#14161A] shadow-xs">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-[26px] sm:text-[28px] font-black tracking-tight leading-none font-mono">
              {formatPKR(totalStockValue)}
            </div>
            <p className="text-xs font-semibold text-[#14161A]/85 mt-2">
              Valued at true batch landed cost per piece
            </p>
          </div>
        </div>

        {/* Card 3: Floating Island Operations */}
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 shadow-xs flex flex-col justify-between h-[150px]">
          <div>
            <span className="text-[11px] font-extrabold text-[#636B76] dark:text-[#8A929C] uppercase tracking-[0.08em]">
              Stock Operations
            </span>
            <div className="text-xs font-semibold text-[#14161A] dark:text-[#F2F4F5] mt-1">
              Adjust stock counts or audit FIFO history
            </div>
          </div>
          <button
            onClick={() => {
              if (batches.length > 0) {
                setAdjustBatchId(String(batches[0].id));
              }
              setIsAdjustOpen(true);
            }}
            className="w-full inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs"
          >
            Adjust Stock Counts
          </button>
        </div>
      </div>

      {/* Floating Pill Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-[#181B1F] p-1.5 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] w-fit shadow-xs">
        <button
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 text-xs font-bold rounded-full transition flex items-center space-x-2 ${
            activeTab === 'batches'
              ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
              : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Active Batches & Landed Costs</span>
        </button>

        <button
          onClick={() => setActiveTab('calculator')}
          className={`px-4 py-2 text-xs font-bold rounded-full transition flex items-center space-x-2 ${
            activeTab === 'calculator'
              ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
              : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Cost Analysis Calculator</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 text-xs font-bold rounded-full transition flex items-center space-x-2 ${
            activeTab === 'movements'
              ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
              : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Stock Movement Ledger</span>
        </button>
      </div>

      {/* TAB 1: BATCHES TABLE */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#636B76] dark:text-[#8A929C]" />
              <input
                type="text"
                placeholder="Search batch # or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              />
            </div>
            <span className="text-xs text-[#636B76] dark:text-[#8A929C]">
              Batches are consumed sequentially by oldest arrival date (FIFO)
            </span>
          </div>

          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35] text-[#4A515B] dark:text-[#A3AAB3] font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Batch Number</th>
                  <th className="py-2.5 px-3">Receiving Date</th>
                  <th className="py-2.5 px-3">Supplier Load</th>
                  <th className="py-2.5 px-3 text-right">Received / Dead / Dmg</th>
                  <th className="py-2.5 px-3 text-right">Original Saleable</th>
                  <th className="py-2.5 px-3 text-right">Sold Pieces</th>
                  <th className="py-2.5 px-3 text-right font-bold text-[#14161A] dark:text-[#F2F4F5]">Remaining Pieces</th>
                  <th className="py-2.5 px-3 text-right font-bold text-[#14161A] dark:text-[#D4F56B]">Cost / Piece</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Analyze</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35]">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Loading stock batches...
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No stock batches available.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((batch) => (
                    <tr
                      key={batch.id}
                      className={`hover:bg-slate-50/80 transition ${
                        batch.isClosed ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold font-mono text-slate-900">
                        {batch.batchNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{formatDate(batch.receivingDate)}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{batch.supplierName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{batch.loadNumber}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                        {batch.receivedPieces} /{' '}
                        <span className="text-rose-600">{batch.deadPieces}</span> /{' '}
                        <span className="text-amber-600">{batch.damagedPieces}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">
                        {formatNumber(batch.originalSaleablePieces)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {formatNumber(batch.soldPieces)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatNumber(batch.remainingPieces)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {formatPKR(batch.costPerPiece)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            batch.isClosed
                              ? 'bg-slate-100 text-slate-600'
                              : batch.remainingPieces <= 50
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {batch.isClosed
                            ? 'Depleted'
                            : batch.remainingPieces <= 50
                            ? 'Low Stock'
                            : 'Active FIFO'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedBatch(batch);
                            setActiveTab('calculator');
                          }}
                          className="px-2 py-1 text-[11px] font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          Calculate Margin
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SELLING PRICE & MARGIN CALCULATOR */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Batch Selector & Cost Breakdown */}
          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
              1. Select Batch for Cost Analysis
            </h3>

            <div>
              <label className="block text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3] mb-1">
                Choose Batch
              </label>
              <select
                value={selectedBatch?.id || ''}
                onChange={(e) => {
                  const b = batches.find((item) => item.id === parseInt(e.target.value, 10));
                  if (b) setSelectedBatch(b);
                }}
                className="w-full px-3 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} ({b.remainingPieces} pcs remaining @ PKR {b.costPerPiece}/pc)
                  </option>
                ))}
              </select>
            </div>

            {selectedBatch && (
              <div className="bg-[#F8F9FA] dark:bg-[#20242A] p-4 rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Purchase Amount:</span>
                  <span className="font-mono font-medium text-[#14161A] dark:text-[#F2F4F5]">
                    {formatPKR(selectedBatch.purchaseAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Load Expenses:</span>
                  <span className="font-mono font-medium text-[#14161A] dark:text-[#F2F4F5]">
                    {formatPKR(selectedBatch.totalLoadExpenses)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#E3E6E8] dark:border-[#2A2F35] pt-1">
                  <span className="font-semibold text-[#14161A] dark:text-[#F2F4F5]">Total Landed Cost:</span>
                  <span className="font-mono font-bold text-[#14161A] dark:text-[#F2F4F5]">
                    {formatPKR(selectedBatch.totalLandedCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#636B76] dark:text-[#8A929C]">Saleable Pieces:</span>
                  <span className="font-mono font-medium text-[#14161A] dark:text-[#F2F4F5]">
                    {selectedBatch.originalSaleablePieces} pieces
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#E3E6E8] dark:border-[#2A2F35] pt-2 bg-[#92E2B3]/20 -mx-4 -mb-4 p-3.5 rounded-b-[16px]">
                  <span className="font-bold text-emerald-950 dark:text-[#92E2B3]">Cost Per Piece:</span>
                  <span className="font-mono font-black text-emerald-900 dark:text-[#92E2B3] text-sm">
                    {formatPKR(selectedBatch.costPerPiece)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Center: Proposed Selling Price Calculator */}
          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
              2. Proposed Selling Price Calculator
            </h3>

            <div>
              <label className="block text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3] mb-1">
                Enter Proposed Selling Price Per Piece (PKR)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  className="w-full pl-4 pr-12 py-2 text-sm font-bold border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] font-mono focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
                />
                <span className="absolute right-4 top-2.5 text-xs text-[#636B76] dark:text-[#8A929C] font-bold">
                  PKR
                </span>
              </div>
              <p className="text-[10px] text-[#636B76] dark:text-[#8A929C] mt-1">
                Planning calculator only. Actual sales prices are recorded per transaction.
              </p>
            </div>

            {/* Indicator Card */}
            <div
              className={`p-4 rounded-[16px] border text-center ${
                analysis.status === 'PROFITABLE'
                  ? 'bg-[#92E2B3]/20 border-[#92E2B3]/40 text-emerald-950 dark:text-[#92E2B3]'
                  : analysis.status === 'AT_COST'
                  ? 'bg-[#F6E7A1]/30 border-[#F6E7A1]/50 text-amber-950 dark:text-[#F6E7A1]'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-950 dark:text-rose-300'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1">
                Pricing Assessment
              </div>
              <div className="text-lg font-black tracking-tight">
                {analysis.status === 'PROFITABLE' && 'PROFITABLE SALE'}
                {analysis.status === 'AT_COST' && 'AT BREAK-EVEN COST'}
                {analysis.status === 'BELOW_COST' && 'BELOW COST (LOSS WARNING)'}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-current/20 pt-3">
                <div>
                  <div className="text-[10px] opacity-75">Profit / Piece</div>
                  <div className="font-bold font-mono text-sm">
                    {formatPKR(analysis.profitPerPiece)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] opacity-75">Profit Margin</div>
                  <div className="font-bold font-mono text-sm">
                    {analysis.marginPercent}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Configured Example Benchmarks */}
          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
              3. Preset Price Benchmarks
            </h3>
            <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
              Configured example benchmark prices from Settings
            </p>

            {/* Benchmark 1 */}
            <div className="p-3.5 rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F8F9FA] dark:bg-[#20242A]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#14161A] dark:text-[#F2F4F5]">At {formatPKR(examplePrice1)} / pc:</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    analysisEx1.status === 'PROFITABLE'
                      ? 'bg-[#92E2B3]/30 text-emerald-800 dark:text-[#92E2B3]'
                      : 'bg-rose-500/20 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {analysisEx1.status}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-1.5 text-[#4A515B] dark:text-[#A3AAB3]">
                <span>Profit per piece:</span>
                <span className="font-mono font-bold text-[#14161A] dark:text-[#F2F4F5]">{formatPKR(analysisEx1.profitPerPiece)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#4A515B] dark:text-[#A3AAB3]">
                <span>Margin:</span>
                <span className="font-mono font-bold text-[#14161A] dark:text-[#F2F4F5]">{analysisEx1.marginPercent}%</span>
              </div>
            </div>

            {/* Benchmark 2 */}
            <div className="p-3.5 rounded-[16px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F8F9FA] dark:bg-[#20242A]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#14161A] dark:text-[#F2F4F5]">At {formatPKR(examplePrice2)} / pc:</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    analysisEx2.status === 'PROFITABLE'
                      ? 'bg-[#92E2B3]/30 text-emerald-800 dark:text-[#92E2B3]'
                      : 'bg-rose-500/20 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {analysisEx2.status}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-1.5 text-[#4A515B] dark:text-[#A3AAB3]">
                <span>Profit per piece:</span>
                <span className="font-mono font-bold text-[#14161A] dark:text-[#F2F4F5]">{formatPKR(analysisEx2.profitPerPiece)}</span>
              </div>
              <div className="flex justify-between text-xs text-[#4A515B] dark:text-[#A3AAB3]">
                <span>Margin:</span>
                <span className="font-mono font-bold text-[#14161A] dark:text-[#F2F4F5]">{analysisEx2.marginPercent}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK MOVEMENTS LEDGER */}
      {activeTab === 'movements' && (
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] overflow-hidden shadow-xs">
          <div className="px-5 py-4 bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35]">
            <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
              Complete Stock Movement Ledger
            </h3>
            <p className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-0.5">
              Every arrival, sale deduction, wholesale delivery, or adjustment is recorded here
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Batch</th>
                  <th className="py-2.5 px-3">Movement Type</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Balance After</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3">Reference / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-600 font-mono">
                        {formatDateTime(mov.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 font-mono">
                        {mov.batchNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            mov.movementType === 'STOCK_IN'
                              ? 'bg-emerald-50 text-emerald-700'
                              : mov.movementType === 'SALE_OUT'
                              ? 'bg-blue-50 text-blue-700'
                              : mov.movementType === 'WHOLESALE_OUT'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {mov.movementType}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold ${
                          mov.quantity > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-semibold">
                        {mov.balanceAfter} pcs
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {formatPKR(mov.unitCost)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]">
                        {mov.notes || mov.referenceType || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      <Modal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title="Authorized Stock Adjustment"
        subtitle="Manually update batch piece counts for physical mortality or audit count corrections"
        maxWidth="md"
      >
        <form onSubmit={handleStockAdjustment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Stock Batch *
            </label>
            <select
              value={adjustBatchId}
              onChange={(e) => setAdjustBatchId(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            >
              {batches
                .filter((b) => !b.isClosed)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} (Current stock: {b.remainingPieces} pcs)
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantity Change (+ / -) *
            </label>
            <input
              type="number"
              placeholder="e.g. -5 for mortality, +10 for recount"
              value={quantityChange}
              onChange={(e) => setQuantityChange(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono font-bold"
            />
            <p className="text-[10px] text-slate-500 mt-0.5">
              Enter negative value (e.g. -5) to write off dead/damaged birds. Negative inventory is forbidden.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Explanation *
            </label>
            <input
              type="text"
              placeholder="e.g. Afternoon heat mortality count"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAdjustOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjustSubmitting}
              className="px-4 py-1.5 text-xs font-bold rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {adjustSubmitting ? 'Recording...' : 'Apply Stock Adjustment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

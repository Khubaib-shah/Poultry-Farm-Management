import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Calendar,
  Filter,
  DollarSign,
  PieChart,
} from 'lucide-react';
import { BusinessExpense } from '../types/index.ts';
import { api } from '../services/api.ts';
import { Modal } from '../components/common/Modal.tsx';
import { formatPKR, formatDate } from '../utils/formatters.ts';

interface ExpensesPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
}

const EXPENSE_CATEGORIES = [
  'Electricity',
  'Rent',
  'Maintenance',
  'Food',
  'Tea',
  'Cleaning',
  'Other',
];

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ onShowToast }) => {
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // New Expense Modal
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [category, setCategory] = useState('Electricity');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const list = await api.getExpenses();
      setExpenses(list);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to load expenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const expAmount = parseFloat(amount);
    if (!category || isNaN(expAmount) || expAmount <= 0) {
      onShowToast('Please provide a valid category and positive amount', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const created = await api.createExpense({
        category,
        amount: expAmount,
        expenseDate,
        paymentMethod,
        description: description.trim() || undefined,
      });

      onShowToast(`Expense of ${formatPKR(created.amount)} for ${created.category} recorded!`, 'success');
      setIsNewExpenseOpen(false);
      setAmount('');
      setDescription('');
      await fetchExpenses();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to record expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await api.deleteExpense(id);
      onShowToast('Expense deleted', 'success');
      await fetchExpenses();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to delete expense', 'error');
    }
  };

  // Category totals
  const categoryTotals: Record<string, number> = {};
  let grandTotal = 0;
  expenses.forEach((e) => {
    const val = Number(e.amount);
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + val;
    grandTotal += val;
  });

  const filtered = expenses.filter(
    (e) => selectedCategory === 'ALL' || e.category === selectedCategory
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            General Business Operating Expenses
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Daily shop utilities, rent, maintenance, food, and cleaning. (Load transit expenses are managed in Purchases).
          </p>
        </div>

        <button
          onClick={() => setIsNewExpenseOpen(true)}
          className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add General Expense
        </button>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {EXPENSE_CATEGORIES.map((cat) => (
          <div
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
            className={`p-3 rounded-[16px] border text-center cursor-pointer transition shadow-xs ${
              selectedCategory === cat
                ? 'bg-[#14161A] text-[#D4F56B] border-[#14161A] dark:bg-[#D4F56B] dark:text-[#14161A]'
                : 'bg-white dark:bg-[#181B1F] border-[#E3E6E8] dark:border-[#2A2F35] text-[#14161A] dark:text-[#F2F4F5] hover:border-black/20 dark:hover:border-white/20'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">{cat}</div>
            <div className="text-xs font-black font-mono mt-1">
              {formatPKR(categoryTotals[cat] || 0)}
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Total Banner Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5]">Category Filter:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-[#4A515B] dark:text-[#A3AAB3] flex items-center gap-2">
          <span>Total General Expenses:</span>
          <strong className="font-mono font-black text-sm text-[#14161A] dark:text-[#D4F56B]">{formatPKR(grandTotal)}</strong>
        </div>
      </div>

      {/* Expenses Table Floating Island */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] dark:bg-[#20242A] border-b border-[#E3E6E8] dark:border-[#2A2F35] text-[#4A515B] dark:text-[#A3AAB3] font-bold uppercase text-[11px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3 text-right font-bold text-[#14161A] dark:text-[#F2F4F5]">Amount</th>
                <th className="py-2.5 px-3 text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading expenses...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-600 font-mono">
                      {formatDate(exp.expenseDate)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[280px] truncate">
                      {exp.description || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {exp.paymentMethod}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatPKR(exp.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
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
        </div>
      </div>

      {/* MODAL: ADD GENERAL EXPENSE */}
      <Modal
        isOpen={isNewExpenseOpen}
        onClose={() => setIsNewExpenseOpen(false)}
        title="Add General Business Expense"
        subtitle="Daily shop operating expense (not associated with a specific vehicle load)"
        maxWidth="md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (PKR) *
              </label>
              <input
                type="number"
                placeholder="e.g. 1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="1"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expense Date *
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
              />
            </div>
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
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Online Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description *
            </label>
            <input
              type="text"
              placeholder="e.g. LESCO electric bill, cleaning supplies, staff lunch"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewExpenseOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

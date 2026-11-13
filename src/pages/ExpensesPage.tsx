import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
} from 'lucide-react';
import { BusinessExpense } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { formatPKR, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

interface ExpensesPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
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

const METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
];

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ onShowToast }) => {
  const expenses = useAppStore((s) => s.expenses);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const createExpense = useAppStore((s) => s.createExpense);
  const deleteExpense = useAppStore((s) => s.deleteExpense);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [category, setCategory] = useState('Electricity');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => getLocalPakistanDate());
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [description, setDescription] = useState('');
  const { isSubmitting: isSavingExpense, runOptimistic: runSaveExpense } = useThrottledSubmit();
  const { isSubmitting: isDeletingExpense, runOptimistic: runDeleteExpense } = useThrottledSubmit();

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const expAmount = parseFloat(amount);
    if (!category || !Number.isFinite(expAmount) || expAmount <= 0) {
      onShowToast('Please choose a category and enter amount', 'error');
      return;
    }

    const descVal = description.trim() || undefined;

    await runSaveExpense((onOptimistic) =>
      createExpense(
        {
          category,
          amount: expAmount,
          expenseDate,
          paymentMethod,
          description: descVal,
        },
        {
          onOptimistic: () => {
            setIsNewExpenseOpen(false);
            setAmount('');
            setDescription('');
            onOptimistic();
          },
        }
      )
    );
  };

  const handleDeleteExpense = async (id: number) => {
    if (isDeletingExpense) return;
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    await runDeleteExpense((onOptimistic) =>
      deleteExpense(id, {
        onOptimistic: () => {
          setConfirmDeleteId(null);
          onOptimistic();
        },
      })
    );
  };

  const { categoryTotals, grandTotal } = useMemo(() => {
    const totals: Record<string, number> = {};
    let grand = 0;
    expenses.forEach((e) => {
      const val = Number(e.amount || 0);
      totals[e.category] = (totals[e.category] || 0) + val;
      grand += val;
    });
    return { categoryTotals: totals, grandTotal: grand };
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      const q = searchQuery.toLowerCase();
      const matchesCat = selectedCategory === 'ALL' || e.category === selectedCategory;
      const matchesMethod = methodFilter === 'ALL' || e.paymentMethod === methodFilter;
      const matchesSearch =
        !q ||
        e.category.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q));
      return matchesCat && matchesMethod && matchesSearch;
    });
  }, [expenses, selectedCategory, methodFilter, searchQuery]);

  const columns: DataTableColumn<BusinessExpense>[] = [
    {
      key: 'expenseDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (e) => <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">{formatDate(e.expenseDate)}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (e) => (
        <span className="px-2.5 py-0.5 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] text-[11px] font-normal text-[#636B76] dark:text-[#A3AAB3]">
          {e.category}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Note / Details',
      render: (e) => (
        <span className="text-[#7B848F] dark:text-[#8A929C] truncate max-w-[260px] block">
          {e.description || '-'}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Paid Via',
      defaultVisible: false,
      sortable: true,
      render: (e) => <span className="font-normal text-[11px]">{e.paymentMethod}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      sortValue: (e) => Number(e.amount),
      render: (e) => <span className="font-normal tabular-nums">{formatPKR(e.amount)}</span>,
    },
    {
      key: 'actions',
      header: 'Remove',
      align: 'right',
      render: (e) => (
        <button
          type="button"
          disabled={isDeletingExpense}
          onClick={() => handleDeleteExpense(e.id)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
            confirmDeleteId === e.id
              ? 'bg-rose-600 text-white'
              : 'text-[#636B76] hover:text-rose-600'
          }`}
          title="Delete expense"
        >
          {confirmDeleteId === e.id ? 'Confirm?' : <Trash2 className="w-3.5 h-3.5 inline" />}
        </button>
      ),
    },
  ];

  const inputCls =
    'w-full min-w-0 max-w-full block min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Daily Shop Expenses
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Electricity bills, shop rent, repairs, staff tea & food. (Truck diesel goes under Truck Purchases).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsNewExpenseOpen(true)}
          className="w-full sm:w-auto xl:ml-auto min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Shop Expense
        </button>
      </div>

      {/* Category Filter Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {EXPENSE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
            className={`p-3 rounded-[16px] border text-center cursor-pointer transition focus:outline-none shadow-xs ${
              selectedCategory === cat
                ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] border-[#D7DBDF] dark:border-[#373E47]'
                : 'bg-white dark:bg-[#181B1F] border-[#E3E6E8] dark:border-[#2A2F35] text-[#14161A] dark:text-[#F2F4F5] hover:border-black/20 dark:hover:border-white/20'
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">{cat}</div>
            <div className="text-xs font-black font-mono mt-1">
              {formatPKR(categoryTotals[cat] || 0)}
            </div>
          </button>
        ))}
      </div>

      {/* Expenses DataTable */}
      <DataTable
        tableId="expenses"
        title="Recorded Shop Bills"
        subtitle={`Total across all expenses: ${formatPKR(grandTotal)}`}
        data={filtered}
        columns={columns}
        keyExtractor={(e) => e.id}
        loading={loading && !initialized}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search note or category..."
        defaultSortKey="expenseDate"
        defaultSortDir="desc"
        filters={[
          {
            key: 'category',
            label: 'Category',
            value: selectedCategory,
            onChange: setSelectedCategory,
            options: [
              { value: 'ALL', label: 'All Categories' },
              ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
            ],
          },
          {
            key: 'method',
            label: 'Method',
            value: methodFilter,
            onChange: setMethodFilter,
            options: [{ value: 'ALL', label: 'All Methods' }, ...METHOD_OPTIONS],
          },
        ]}
        mobileCardTitle={(e) => e.category}
        mobileCardSubtitle={(e) =>
          `${formatDate(e.expenseDate)} · ${
            e.paymentMethod === 'CASH' ? 'Cash' : e.paymentMethod.replace('_', ' ')
          }`
        }
        mobileCardBadge={(e) => <span className="font-mono font-bold text-xs">{formatPKR(e.amount)}</span>}
      />

      {/* MODAL: ADD EXPENSE */}
      <Modal
        isOpen={isNewExpenseOpen}
        onClose={() => setIsNewExpenseOpen(false)}
        title="Add Daily Expense"
        subtitle="Shop utility bill, rent, tea, or cleaning cost"
        maxWidth="md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">Category *</label>
            <Select
              value={category}
              onChange={setCategory}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="block text-xs font-bold mb-1.5">Amount (PKR) *</label>
              <input
                type="number"
                placeholder="e.g. 1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="1"
                className={`${inputCls} font-mono font-bold`}
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-bold mb-1.5">Date *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Paid Via *</label>
            <Select
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={METHOD_OPTIONS}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Details / Note *</label>
            <input
              type="text"
              placeholder="e.g. LESCO electric bill or staff lunch"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isSavingExpense}
              onClick={() => setIsNewExpenseOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingExpense}
              aria-busy={isSavingExpense}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingExpense ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

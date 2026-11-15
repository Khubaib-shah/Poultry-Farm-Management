import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Receipt,
  Briefcase,
  DollarSign,
  Phone,
  Check,
} from 'lucide-react';
import { motion } from 'motion/react';
import { BusinessExpense, Worker, WorkerPayment } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { formatPKR, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

export type ExpensesStaffSubTab = 'expenses' | 'staff';

interface ExpensesStaffPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
  initialSubTab?: ExpensesStaffSubTab;
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

const WAGE_METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank / Easypaisa / JazzCash' },
];

export const ExpensesStaffPage: React.FC<ExpensesStaffPageProps> = ({
  onShowToast,
  initialSubTab = 'expenses',
}) => {
  const expenses = useAppStore((s) => s.expenses);
  const workers = useAppStore((s) => s.workers);
  const workerPayments = useAppStore((s) => s.workerPayments);
  const resolvedIdMap = useAppStore((s) => s.resolvedIdMap);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const isInitialLoading = loading && !initialized;

  const createExpense = useAppStore((s) => s.createExpense);
  const deleteExpense = useAppStore((s) => s.deleteExpense);
  const createWorker = useAppStore((s) => s.createWorker);
  const recordWorkerPayment = useAppStore((s) => s.recordWorkerPayment);

  const [activeTab, setActiveTab] = useState<ExpensesStaffSubTab>(initialSubTab);

  // Expenses state
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [category, setCategory] = useState('Electricity');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => getLocalPakistanDate());
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [description, setDescription] = useState('');

  // Workers state
  const [isNewWorkerOpen, setIsNewWorkerOpen] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerNotes, setWorkerNotes] = useState('');

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payWorkerId, setPayWorkerId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => getLocalPakistanDate());
  const [payDesc, setPayDesc] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');

  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workerFilter, setWorkerFilter] = useState('ALL');
  const [wageSearch, setWageSearch] = useState('');

  const { isSubmitting: isSavingExpense, runOptimistic: runSaveExpense } = useThrottledSubmit();
  const { isSubmitting: isDeletingExpense, runOptimistic: runDeleteExpense } = useThrottledSubmit();
  const { isSubmitting: isSavingWorker, runOptimistic: runSaveWorker } = useThrottledSubmit();
  const { isSubmitting: isSavingWage, runOptimistic: runSaveWage } = useThrottledSubmit();

  useEffect(() => {
    setActiveTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (workers.length > 0 && !payWorkerId) {
      setPayWorkerId(String(workers[0].id));
    }
  }, [workers, payWorkerId]);

  // Totals
  const { categoryTotals, grandExpenseTotal } = useMemo(() => {
    const totals: Record<string, number> = {};
    let grand = 0;
    expenses.forEach((e) => {
      const val = Number(e.amount || 0);
      totals[e.category] = (totals[e.category] || 0) + val;
      grand += val;
    });
    return { categoryTotals: totals, grandExpenseTotal: grand };
  }, [expenses]);

  const grandWageTotal = useMemo(
    () => workerPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [workerPayments]
  );

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const q = expenseSearch.toLowerCase();
      const matchesCat = selectedCategory === 'ALL' || e.category === selectedCategory;
      const matchesMethod = methodFilter === 'ALL' || e.paymentMethod === methodFilter;
      const matchesSearch =
        !q ||
        e.category.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q));
      return matchesCat && matchesMethod && matchesSearch;
    });
  }, [expenses, selectedCategory, methodFilter, expenseSearch]);

  const filteredPayments = useMemo(() => {
    return workerPayments.filter((p) => {
      const q = wageSearch.toLowerCase();
      const matchesWorker = workerFilter === 'ALL' || String(p.workerId) === workerFilter;
      const matchesSearch =
        !q ||
        (p.workerName && p.workerName.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q));
      return matchesWorker && matchesSearch;
    });
  }, [workerPayments, workerFilter, wageSearch]);

  const selectedWorkerHistory = useMemo(
    () =>
      selectedWorker
        ? workerPayments.filter(
            (p) =>
              p.workerId === selectedWorker.id ||
              p.workerId === resolvedIdMap[selectedWorker.id]
          )
        : [],
    [workerPayments, selectedWorker, resolvedIdMap]
  );

  const workerOptions = useMemo(
    () =>
      workers.map((w) => ({
        value: String(w.id),
        label: w.name,
        sublabel: w.phone || undefined,
      })),
    [workers]
  );

  // Handlers
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
            setActiveTab('expenses');
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

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) {
      onShowToast('Please enter staff member name', 'error');
      return;
    }

    const payload = {
      name: workerName.trim(),
      phone: workerPhone.trim() || undefined,
      notes: workerNotes.trim() || undefined,
      isActive: true,
    };
    let optWorkerId: number | null = null;

    await runSaveWorker((onOptimistic) =>
      createWorker(payload, {
        onOptimistic: (optWorker) => {
          optWorkerId = optWorker.id;
          setIsNewWorkerOpen(false);
          setWorkerName('');
          setWorkerPhone('');
          setWorkerNotes('');
          if (!payWorkerId) {
            setPayWorkerId(String(optWorker.id));
          }
          onOptimistic();
        },
        onSynced: (created) => {
          setPayWorkerId((prev) =>
            prev === String(optWorkerId) ? String(created.id) : prev
          );
        },
      })
    );
  };

  const handleRecordWagePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const wageAmt = parseFloat(payAmount);
    const wId = parseInt(payWorkerId, 10);
    if (!payWorkerId || !Number.isFinite(wId) || !Number.isFinite(wageAmt) || wageAmt <= 0) {
      onShowToast('Please pick a worker and enter amount', 'error');
      return;
    }

    const desc = payDesc || 'Daily wage / salary';

    await runSaveWage((onOptimistic) =>
      recordWorkerPayment(
        wId,
        {
          amount: wageAmt,
          paymentDate: payDate,
          paymentMethod: payMethod,
          description: desc,
        },
        {
          onOptimistic: () => {
            setIsPaymentOpen(false);
            setPayAmount('');
            setPayDesc('');
            setActiveTab('staff');
            onOptimistic();
          },
        }
      )
    );
  };

  const expenseColumns: DataTableColumn<BusinessExpense>[] = [
    {
      key: 'expenseDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (e) => (
        <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">
          {formatDate(e.expenseDate)}
        </span>
      ),
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
      alwaysVisible: true,
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

  const paymentColumns: DataTableColumn<WorkerPayment>[] = [
    {
      key: 'paymentDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (p) => (
        <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">
          {formatDate(p.paymentDate)}
        </span>
      ),
    },
    {
      key: 'workerName',
      header: 'Staff Member',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (p) => (
        <span className="font-normal text-[#636B76] dark:text-[#A3AAB3]">
          {p.workerName || `Staff #${p.workerId}`}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Reason / Note',
      render: (p) => (
        <span className="text-[#7B848F] dark:text-[#8A929C]">{p.description || '-'}</span>
      ),
    },
    {
      key: 'paymentMethod',
      header: 'Paid Via',
      defaultVisible: false,
      sortable: true,
      render: (p) => <span className="font-normal text-[11px]">{p.paymentMethod}</span>,
    },
    {
      key: 'amount',
      header: 'Amount Paid',
      align: 'right',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      sortValue: (p) => Number(p.amount),
      render: (p) => <span className="font-normal tabular-nums">{formatPKR(p.amount)}</span>,
    },
  ];

  const subTabs: Array<{
    id: ExpensesStaffSubTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'expenses', label: `Daily Shop Bills (${expenses.length})`, icon: Receipt },
    { id: 'staff', label: `Staff & Wages (${workers.length})`, icon: Briefcase },
  ];

  const inputCls =
    'w-full min-w-0 max-w-full block min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Expenses & Staff
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Track shop electricity, rent, tea & repairs alongside staff salaries and daily wages
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 w-full xl:w-auto xl:ml-auto">
          <button
            type="button"
            onClick={() => {
              setPayDate(getLocalPakistanDate());
              setIsPaymentOpen(true);
            }}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pay Staff Wage
          </button>
          <button
            type="button"
            onClick={() => {
              setExpenseDate(getLocalPakistanDate());
              setIsNewExpenseOpen(true);
            }}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Shop Expense
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className="text-left rounded-[20px] p-4 sm:p-5 bg-[#C9C3F5] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[128px] transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Daily Shop Bills
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-32 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black leading-none font-mono tabular-nums">
                {formatPKR(grandExpenseTotal)}
              </div>
            )}
            <p className="text-xs font-semibold opacity-85 mt-2">
              {expenses.length} recorded {expenses.length === 1 ? 'bill' : 'bills'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className="text-left rounded-[20px] p-4 sm:p-5 bg-[#A9C8FA] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[128px] transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Staff Wages Paid
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-32 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black leading-none font-mono tabular-nums">
                {formatPKR(grandWageTotal)}
              </div>
            )}
            <p className="text-xs font-semibold opacity-85 mt-2">
              Across {workers.length} staff {workers.length === 1 ? 'member' : 'members'}
            </p>
          </div>
        </button>

        <div className="rounded-[20px] p-4 sm:p-5 bg-[#F6E7A1] text-[#14161A] border border-black/5 shadow-xs flex flex-col justify-between min-h-[104px] sm:min-h-[128px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-[0.08em] uppercase opacity-80">
              Total Operating Cost
            </span>
            <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            {isInitialLoading ? (
              <div className="h-7 w-32 rounded-lg bg-black/10 animate-pulse" />
            ) : (
              <div className="text-[24px] sm:text-[26px] font-black leading-none font-mono tabular-nums">
                {formatPKR(grandExpenseTotal + grandWageTotal)}
              </div>
            )}
            <p className="text-xs font-semibold opacity-85 mt-2">
              Shop bills + staff wages combined
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
                  layoutId="expensesStaffTabPill"
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

      {/* TAB 1: DAILY SHOP BILLS */}
      {activeTab === 'expenses' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === cat ? 'ALL' : cat)}
                className={`p-3 rounded-[16px] border text-center cursor-pointer transition focus:outline-none shadow-xs ${
                  selectedCategory === cat
                    ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] border-[#14161A] dark:border-[#D4F56B]'
                    : 'bg-white dark:bg-[#181B1F] border-[#E3E6E8] dark:border-[#2A2F35] text-[#14161A] dark:text-[#F2F4F5] hover:border-black/20 dark:hover:border-white/20'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                  {cat}
                </div>
                <div className="text-xs font-black font-mono mt-1 tabular-nums">
                  {formatPKR(categoryTotals[cat] || 0)}
                </div>
              </button>
            ))}
          </div>

          <DataTable
            tableId="expenses"
            paginationEndpoint="/api/expenses"
            paginationParams={{
              ...(selectedCategory !== 'ALL' ? { category: selectedCategory } : {}),
              ...(methodFilter !== 'ALL' ? { paymentMethod: methodFilter } : {}),
            }}
            title="Recorded Shop Bills"
            subtitle={`Total across all expenses: ${formatPKR(grandExpenseTotal)}`}
            data={filteredExpenses}
            columns={expenseColumns}
            keyExtractor={(e) => e.id}
            loading={isInitialLoading}
            searchValue={expenseSearch}
            onSearchChange={setExpenseSearch}
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
            mobileCardBadge={(e) => (
              <span className="font-mono font-bold text-xs">{formatPKR(e.amount)}</span>
            )}
          />
        </div>
      )}

      {/* TAB 2: STAFF & WAGES */}
      {activeTab === 'staff' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
              Staff Roster ({workers.length}) — Click a worker to filter wages
            </h3>
            <div className="flex items-center gap-2.5">
              {workerFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setWorkerFilter('ALL')}
                  className="text-xs font-bold text-[#17807D] dark:text-[#D4F56B] hover:underline cursor-pointer"
                >
                  Show All Staff
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsNewWorkerOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition cursor-pointer"
              >
                + Add Staff
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {isInitialLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs"
                >
                  <div className="h-4 w-32 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                  <div className="h-3 w-24 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                  <div className="h-10 w-full rounded-[14px] bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                </div>
              ))
            ) : workers.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs text-[#636B76] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px]">
                No staff added yet. Click &quot;+ Add Staff&quot; to begin.
              </div>
            ) : (
              workers.map((w) => {
                const isSelected = workerFilter === String(w.id);
                return (
                  <div
                    key={w.id}
                    onClick={() => setWorkerFilter(isSelected ? 'ALL' : String(w.id))}
                    className={`bg-white dark:bg-[#181B1F] rounded-[20px] p-5 space-y-3 shadow-xs flex flex-col justify-between transition cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[#14161A] dark:border-[#D4F56B] ring-2 ring-[#D4F56B]/30'
                        : 'border border-[#E3E6E8] dark:border-[#2A2F35] hover:border-black/25 dark:hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-[#14161A] dark:text-[#F2F4F5] text-sm">
                            {w.name}
                          </h4>
                          <div className="text-[11px] text-[#636B76] dark:text-[#8A929C]">
                            {w.notes || 'Shop / Farm Staff'}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            w.isActive
                              ? 'bg-[#92E2B3]/30 text-emerald-800 dark:text-[#92E2B3]'
                              : 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#636B76]'
                          }`}
                        >
                          {w.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>

                      {w.phone && (
                        <div className="text-xs text-[#636B76] dark:text-[#8A929C] flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{w.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      <div className="bg-[#F8F9FA] dark:bg-[#20242A] p-3 rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] text-xs flex justify-between items-center">
                        <span className="text-[#636B76] dark:text-[#8A929C] font-semibold">
                          Total Paid:
                        </span>
                        <span className="font-mono font-black text-[#14161A] dark:text-[#D4F56B]">
                          {formatPKR(w.totalPaid || 0)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWorker(w);
                          }}
                          className="flex-1 min-h-[36px] py-1.5 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition cursor-pointer"
                        >
                          History
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPayWorkerId(String(w.id));
                            setPayDate(getLocalPakistanDate());
                            setIsPaymentOpen(true);
                          }}
                          className="min-h-[36px] px-4 py-1.5 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition cursor-pointer"
                        >
                          Pay
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DataTable
            tableId="worker-payments"
            paginationEndpoint="/api/worker-payments"
            paginationParams={{
              ...(workerFilter !== 'ALL' ? { workerId: workerFilter } : {}),
            }}
            title="Wage Payments History"
            subtitle="All salaries and daily wages paid to staff"
            data={filteredPayments}
            columns={paymentColumns}
            keyExtractor={(p) => p.id}
            loading={isInitialLoading}
            searchValue={wageSearch}
            onSearchChange={setWageSearch}
            searchPlaceholder="Search staff or note..."
            defaultSortKey="paymentDate"
            defaultSortDir="desc"
            filters={[
              {
                key: 'worker',
                label: 'Staff',
                value: workerFilter,
                onChange: setWorkerFilter,
                options: [{ value: 'ALL', label: 'All Staff' }, ...workerOptions],
              },
            ]}
            mobileCardTitle={(p) => p.workerName || `Staff #${p.workerId}`}
            mobileCardSubtitle={(p) =>
              `${formatDate(p.paymentDate)} · ${
                p.paymentMethod === 'CASH' ? 'Cash' : 'Bank / Online'
              }`
            }
            mobileCardBadge={(p) => (
              <span className="font-mono font-bold text-xs">{formatPKR(p.amount)}</span>
            )}
          />
        </div>
      )}

      {/* MODAL: ADD DAILY EXPENSE */}
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

      {/* MODAL: ADD STAFF MEMBER */}
      <Modal
        isOpen={isNewWorkerOpen}
        onClose={() => setIsNewWorkerOpen(false)}
        title="Add Staff Member"
        subtitle="Register a cutter, loader, or helper"
        maxWidth="md"
      >
        <form onSubmit={handleCreateWorker} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Akram Masih"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 0322-1122334"
              value={workerPhone}
              onChange={(e) => setWorkerPhone(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Job Role / Notes</label>
            <input
              type="text"
              placeholder="e.g. Head cutter and shop helper"
              value={workerNotes}
              onChange={(e) => setWorkerNotes(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isSavingWorker}
              onClick={() => setIsNewWorkerOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingWorker}
              aria-busy={isSavingWorker}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingWorker ? 'Saving...' : 'Add Staff'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: RECORD WAGE PAYMENT */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title="Pay Staff Wage"
        subtitle="Record salary, daily bhatta, or overtime payment"
        maxWidth="md"
      >
        <form onSubmit={handleRecordWagePayment} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">Pick Staff Member *</label>
            <Select
              value={payWorkerId}
              onChange={setPayWorkerId}
              options={workerOptions}
              placeholder="Choose staff"
              searchable
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="block text-xs font-bold mb-1.5">Amount (PKR) *</label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                min="1"
                className={`${inputCls} font-mono font-bold`}
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-bold mb-1.5">Payment Date *</label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                required
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Paid Via *</label>
            <Select value={payMethod} onChange={setPayMethod} options={WAGE_METHOD_OPTIONS} />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Reason / Note *</label>
            <input
              type="text"
              placeholder="e.g. Weekly cash wage or daily allowance"
              value={payDesc}
              onChange={(e) => setPayDesc(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
            <button
              type="button"
              disabled={isSavingWage}
              onClick={() => setIsPaymentOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingWage}
              aria-busy={isSavingWage}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingWage ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: STAFF PAYMENT HISTORY */}
      {selectedWorker && (
        <Modal
          isOpen={Boolean(selectedWorker)}
          onClose={() => setSelectedWorker(null)}
          title={`Payments: ${selectedWorker.name}`}
          subtitle="All salary and wage entries for this staff member"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="divide-y divide-[#E3E6E8] dark:divide-[#2A2F35] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[16px] max-h-64 overflow-y-auto">
              {selectedWorkerHistory.length === 0 ? (
                <div className="p-6 text-center text-[#636B76]">No payments recorded yet.</div>
              ) : (
                selectedWorkerHistory.map((p) => (
                  <div key={p.id} className="p-3 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{p.description || 'Wage Payment'}</div>
                      <div className="text-[11px] text-[#636B76] font-mono">
                        {formatDate(p.paymentDate)} · {p.paymentMethod}
                      </div>
                    </div>
                    <div className="font-mono font-bold">{formatPKR(p.amount)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedWorker(null)}
                className="min-h-[40px] px-5 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] cursor-pointer"
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

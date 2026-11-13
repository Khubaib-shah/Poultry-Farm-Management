import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Phone,
} from 'lucide-react';
import { Worker, WorkerPayment } from '../types/index.ts';
import { Modal } from '../components/common/Modal.tsx';
import { Select } from '../components/common/Select.tsx';
import { DataTable, DataTableColumn } from '../components/common/DataTable.tsx';
import { formatPKR, formatDate } from '../utils/formatters.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { getLocalPakistanDate } from '../utils/syncCalculations.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

interface WorkersPageProps {
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

const WAGE_METHOD_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank / Easypaisa / JazzCash' },
];

export const WorkersPage: React.FC<WorkersPageProps> = ({ onShowToast }) => {
  const workers = useAppStore((s) => s.workers);
  const workerPayments = useAppStore((s) => s.workerPayments);
  const loading = useAppStore((s) => s.loading);
  const initialized = useAppStore((s) => s.initialized);
  const isInitialLoading = loading && !initialized;
  const createWorker = useAppStore((s) => s.createWorker);
  const recordWorkerPayment = useAppStore((s) => s.recordWorkerPayment);

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
  const [searchQuery, setSearchQuery] = useState('');

  const { isSubmitting: isSavingWorker, run: runSaveWorker } = useThrottledSubmit();
  const { isSubmitting: isSavingPayment, run: runSavePayment } = useThrottledSubmit();

  useEffect(() => {
    if (workers.length > 0 && !payWorkerId) {
      setPayWorkerId(String(workers[0].id));
    }
  }, [workers, payWorkerId]);

  const workerOptions = useMemo(
    () =>
      workers.map((w) => ({
        value: String(w.id),
        label: w.name,
        sublabel: w.phone || undefined,
      })),
    [workers]
  );

  const selectedWorkerHistory = useMemo(
    () =>
      selectedWorker
        ? workerPayments.filter((p) => p.workerId === selectedWorker.id)
        : [],
    [workerPayments, selectedWorker]
  );

  const filteredPayments = useMemo(() => {
    return workerPayments.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesWorker = workerFilter === 'ALL' || String(p.workerId) === workerFilter;
      const matchesSearch =
        !q ||
        (p.workerName && p.workerName.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q));
      return matchesWorker && matchesSearch;
    });
  }, [workerPayments, workerFilter, searchQuery]);

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

    await runSaveWorker(async () => {
      try {
        await createWorker(payload);
        setIsNewWorkerOpen(false);
        setWorkerName('');
        setWorkerPhone('');
        setWorkerNotes('');
      } catch {
        // handled by store
      }
    });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (!payWorkerId || isNaN(amount) || amount <= 0) {
      onShowToast('Please pick a worker and enter amount', 'error');
      return;
    }

    const wId = parseInt(payWorkerId, 10);
    const desc = payDesc || 'Daily wage / salary';

    await runSavePayment(async () => {
      try {
        await recordWorkerPayment(wId, {
          amount,
          paymentDate: payDate,
          paymentMethod: payMethod,
          description: desc,
        });
        setIsPaymentOpen(false);
        setPayAmount('');
        setPayDesc('');
      } catch {
        // handled by store
      }
    });
  };

  const paymentColumns: DataTableColumn<WorkerPayment>[] = [
    {
      key: 'paymentDate',
      header: 'Date',
      sortable: true,
      hideOnMobileDefault: true,
      render: (p) => <span className="font-normal text-[#7B848F] dark:text-[#8A929C]">{formatDate(p.paymentDate)}</span>,
    },
    {
      key: 'workerName',
      header: 'Staff Member',
      sortable: true,
      alwaysVisible: true,
      hideOnMobileDefault: true,
      render: (p) => <span className="font-normal text-[#636B76] dark:text-[#A3AAB3]">{p.workerName || `Staff #${p.workerId}`}</span>,
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

  const inputCls =
    'w-full min-w-0 max-w-full block min-h-[42px] px-3.5 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="hidden xl:block">
          <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Staff & Wages
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Pay salaries, daily wages, and food allowance for cutters, loaders, and helpers
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 w-full xl:w-auto xl:ml-auto">
          <button
            type="button"
            onClick={() => setIsNewWorkerOpen(true)}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition cursor-pointer"
          >
            + Add Staff
          </button>
          <button
            type="button"
            onClick={() => setIsPaymentOpen(true)}
            className="min-h-[40px] inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Pay Staff Wage
          </button>
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isInitialLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                <div className="h-3 w-24 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                <div className="h-3 w-28 rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
              </div>
              <div className="space-y-2.5">
                <div className="bg-[#F8F9FA] dark:bg-[#20242A] p-3 rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35]">
                  <div className="h-3.5 w-full rounded bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-9 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                  <div className="w-16 h-9 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] animate-pulse" />
                </div>
              </div>
            </div>
          ))
        ) : workers.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-[#636B76]">
            No staff added yet. Click &quot;+ Add Staff&quot; to begin.
          </div>
        ) : (
          workers.map((w) => (
            <div
              key={w.id}
              className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-[#14161A] dark:text-[#F2F4F5] text-sm">
                      {w.name}
                    </h3>
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
                  <span className="text-[#636B76] dark:text-[#8A929C] font-semibold">Total Paid:</span>
                  <span className="font-mono font-black text-[#14161A] dark:text-[#D4F56B]">
                    {formatPKR(w.totalPaid || 0)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWorker(w)}
                    className="flex-1 min-h-[38px] py-1.5 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition cursor-pointer"
                  >
                    History
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPayWorkerId(String(w.id));
                      setIsPaymentOpen(true);
                    }}
                    className="min-h-[38px] px-4 py-1.5 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition cursor-pointer"
                  >
                    Pay
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* All Recent Staff Wage Payments Table */}
      <DataTable
        tableId="worker-payments"
        title="Wage Payments History"
        subtitle="All salaries and daily wages paid to staff"
        data={filteredPayments}
        columns={paymentColumns}
        keyExtractor={(p) => p.id}
        loading={isInitialLoading}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
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
          `${formatDate(p.paymentDate)} · ${p.paymentMethod === 'CASH' ? 'Cash' : 'Bank / Online'}`
        }
        mobileCardBadge={(p) => <span className="font-mono font-bold text-xs">{formatPKR(p.amount)}</span>}
      />

      {/* MODAL: ADD STAFF */}
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
        <form onSubmit={handleRecordPayment} className="space-y-4">
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
              disabled={isSavingPayment}
              onClick={() => setIsPaymentOpen(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingPayment}
              aria-busy={isSavingPayment}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSavingPayment ? 'Saving...' : 'Save Payment'}
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

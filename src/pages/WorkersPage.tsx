import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Phone,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import { Worker, WorkerPayment } from '../types/index.ts';
import { api } from '../services/api.ts';
import { Modal } from '../components/common/Modal.tsx';
import { formatPKR, formatDate } from '../utils/formatters.ts';

interface WorkersPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
}

export const WorkersPage: React.FC<WorkersPageProps> = ({ onShowToast }) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  // New Worker Modal
  const [isNewWorkerOpen, setIsNewWorkerOpen] = useState(false);
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerNotes, setWorkerNotes] = useState('');
  const [submittingWorker, setSubmittingWorker] = useState(false);

  // Record Payment Modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payWorkerId, setPayWorkerId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payDesc, setPayDesc] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Worker Payment History Modal
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [paymentsList, setPaymentsList] = useState<WorkerPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const res = await api.getWorkers();
      setWorkers(res);
      if (res.length > 0 && !payWorkerId) {
        setPayWorkerId(String(res[0].id));
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to load workers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const openHistory = async (w: Worker) => {
    try {
      setSelectedWorker(w);
      setPaymentsLoading(true);
      const list = await api.getWorkerPayments(w.id);
      setPaymentsList(list);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to fetch payments', 'error');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) {
      onShowToast('Worker name is required', 'error');
      return;
    }

    try {
      setSubmittingWorker(true);
      const created = await api.createWorker({
        name: workerName.trim(),
        phone: workerPhone.trim() || undefined,
        notes: workerNotes.trim() || undefined,
        isActive: true,
      });

      onShowToast(`Worker "${created.name}" added successfully!`, 'success');
      setIsNewWorkerOpen(false);
      setWorkerName('');
      setWorkerPhone('');
      setWorkerNotes('');
      await fetchWorkers();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to add worker', 'error');
    } finally {
      setSubmittingWorker(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (!payWorkerId || isNaN(amount) || amount <= 0) {
      onShowToast('Please select worker and enter positive amount', 'error');
      return;
    }

    try {
      setSubmittingPayment(true);
      await api.recordWorkerPayment(parseInt(payWorkerId, 10), {
        amount,
        paymentDate: payDate,
        paymentMethod: payMethod,
        description: payDesc || 'Wage / Bhatta disbursement',
      });

      onShowToast('Worker payment recorded and included in daily operating expenses', 'success');
      setIsPaymentOpen(false);
      setPayAmount('');
      setPayDesc('');
      await fetchWorkers();
      if (selectedWorker && selectedWorker.id === parseInt(payWorkerId, 10)) {
        openHistory(selectedWorker);
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to record worker payment', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
            Workers & Wage Payments
          </h2>
          <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
            Flexible wage and bhatta payments for farm workers, cutters, and transport loaders
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsNewWorkerOpen(true)}
            className="px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition"
          >
            Add New Worker
          </button>
          <button
            onClick={() => setIsPaymentOpen(true)}
            className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] transition shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Worker Payment
          </button>
        </div>
      </div>

      {/* Workers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-8 text-center text-[#636B76] dark:text-[#8A929C] text-xs">
            Loading workers...
          </div>
        ) : workers.length === 0 ? (
          <div className="col-span-full py-8 text-center text-[#636B76] dark:text-[#8A929C] text-xs">
            No workers added yet. Click "Add New Worker" to register staff.
          </div>
        ) : (
          workers.map((w) => (
            <div
              key={w.id}
              className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 space-y-3 hover:border-black/20 dark:hover:border-white/20 transition shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-[#14161A] dark:text-[#F2F4F5] text-sm">{w.name}</h3>
                  <div className="text-[11px] text-[#636B76] dark:text-[#8A929C]">{w.notes || 'Farm / Shop Assistant'}</div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    w.isActive
                      ? 'bg-[#92E2B3]/30 text-emerald-800 dark:text-[#92E2B3] border border-[#92E2B3]/40'
                      : 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#636B76] dark:text-[#8A929C]'
                  }`}
                >
                  {w.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              {w.phone && (
                <div className="text-xs text-[#636B76] dark:text-[#8A929C] flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-1.5 text-[#8A929C]" />
                  <span>{w.phone}</span>
                </div>
              )}

              <div className="bg-[#F8F9FA] dark:bg-[#20242A] p-3 rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] text-xs flex justify-between items-center">
                <span className="text-[#636B76] dark:text-[#8A929C] font-semibold">Total Paid:</span>
                <span className="font-mono font-black text-[#14161A] dark:text-[#D4F56B]">
                  {formatPKR(w.totalPaid || 0)}
                </span>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => openHistory(w)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] transition"
                >
                  Payment History
                </button>
                <button
                  onClick={() => {
                    setPayWorkerId(String(w.id));
                    setIsPaymentOpen(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-full bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A] hover:opacity-90 transition"
                >
                  Pay
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: ADD WORKER */}
      <Modal
        isOpen={isNewWorkerOpen}
        onClose={() => setIsNewWorkerOpen(false)}
        title="Add New Worker"
        subtitle="Register worker for wage and bhatta tracking"
        maxWidth="md"
      >
        <form onSubmit={handleCreateWorker} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Worker Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Akram Masih"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 0322-1122334"
              value={workerPhone}
              onChange={(e) => setWorkerPhone(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Role / Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Head cutter and shop supervisor"
              value={workerNotes}
              onChange={(e) => setWorkerNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsNewWorkerOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingWorker}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submittingWorker ? 'Saving...' : 'Add Worker'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: RECORD WORKER PAYMENT */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title="Record Worker Payment"
        subtitle="Disburse wage, daily bhatta, or overtime payment"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Worker *
            </label>
            <select
              value={payWorkerId}
              onChange={(e) => setPayWorkerId(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.phone ? `(${w.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Amount (PKR) *
              </label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                min="1"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Reason *
            </label>
            <input
              type="text"
              placeholder="e.g. Weekly cash wage, daily bhatta, or overtime"
              value={payDesc}
              onChange={(e) => setPayDesc(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsPaymentOpen(false)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingPayment}
              className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submittingPayment ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: WORKER PAYMENT HISTORY */}
      {selectedWorker && (
        <Modal
          isOpen={Boolean(selectedWorker)}
          onClose={() => setSelectedWorker(null)}
          title={`Payment History: ${selectedWorker.name}`}
          subtitle="All recorded wage and bhatta payments"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="divide-y divide-slate-100 border border-slate-200 rounded max-h-60 overflow-y-auto">
              {paymentsLoading ? (
                <div className="p-4 text-center text-slate-400">Loading payments...</div>
              ) : paymentsList.length === 0 ? (
                <div className="p-4 text-center text-slate-400">No payments recorded yet.</div>
              ) : (
                paymentsList.map((p) => (
                  <div key={p.id} className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                    <div>
                      <div className="font-semibold text-slate-900">{p.description || 'Payment'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{formatDate(p.paymentDate)}</div>
                    </div>
                    <div className="text-right font-mono font-bold text-slate-900">
                      {formatPKR(p.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedWorker(null)}
                className="px-4 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white hover:bg-slate-50"
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

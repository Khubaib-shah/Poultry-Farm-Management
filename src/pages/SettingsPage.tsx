import React, { useState, useEffect } from 'react';
import {
  Save,
  RefreshCw,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { AppSettings, AuthUser } from '../types/index.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';
import { PWAInstallButton } from '../components/common/PWAInstallButton.tsx';

interface SettingsPageProps {
  currentUser?: AuthUser | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ currentUser }) => {
  const storeSettings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetWorkspaceData = useAppStore((s) => s.resetWorkspaceData);

  const isDemoMode = currentUser?.role === 'demo' || currentUser?.workspace === 'demo';

  const [formState, setFormState] = useState<AppSettings>(storeSettings);
  const [confirmReset, setConfirmReset] = useState(false);

  const { isSubmitting: isSavingSettings, runOptimistic: runSaveSettings } = useThrottledSubmit();
  const { isSubmitting: resetting, run: runReset } = useThrottledSubmit();

  useEffect(() => {
    setFormState(storeSettings);
  }, [storeSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSaveSettings((onOptimistic) =>
      updateSettings(formState, {
        onOptimistic,
      })
    );
  };

  const handleWorkspaceReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    await runReset(async () => {
      try {
        await resetWorkspaceData();
      } catch {
        // handled by store
      }
    });
  };

  const inputCls =
    'w-full min-h-[42px] px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[14px] bg-[#F3F5F6]/70 dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]';

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="hidden xl:block">
        <h2 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
          Shop Settings
        </h2>
        <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
          {isDemoMode
            ? 'Configure demo shop details, quick price checks, and reset your demo sandbox'
            : 'Update shop details, low-stock threshold, rate benchmarks, and account data'}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Business Identity */}
          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 sm:p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider border-b border-[#E3E6E8] dark:border-[#2A2F35] pb-2">
              Shop Details
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Shop / Business Name
                </label>
                <input
                  type="text"
                  value={formState.businessName}
                  onChange={(e) => setFormState({ ...formState, businessName: e.target.value })}
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Address / City
                </label>
                <input
                  type="text"
                  value={formState.businessLocation}
                  onChange={(e) =>
                    setFormState({ ...formState, businessLocation: e.target.value })
                  }
                  required
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Pricing & Low Stock */}
          <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 sm:p-6 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider border-b border-[#E3E6E8] dark:border-[#2A2F35] pb-2">
              Price Checker & Stock Alerts
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Test Selling Rate 1 (PKR)
                </label>
                <input
                  type="number"
                  value={formState.examplePrice1}
                  onChange={(e) => setFormState({ ...formState, examplePrice1: e.target.value })}
                  required
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                  Test Selling Rate 2 (PKR)
                </label>
                <input
                  type="number"
                  value={formState.examplePrice2}
                  onChange={(e) => setFormState({ ...formState, examplePrice2: e.target.value })}
                  required
                  className={`${inputCls} font-mono`}
                />
              </div>
            </div>
            <p className="text-[11px] text-[#636B76] dark:text-[#8A929C]">
              Saved benchmark rates used in Trucks &amp; Bird Stock → Rate &amp; Profit Checker cards.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5">
                Low Stock Alert Below (Birds)
              </label>
              <input
                type="number"
                value={formState.lowStockThreshold}
                onChange={(e) =>
                  setFormState({ ...formState, lowStockThreshold: e.target.value })
                }
                required
                className={`${inputCls} sm:w-56 font-mono`}
              />
              <p className="text-[11px] text-[#636B76] dark:text-[#8A929C] mt-1">
                Show a low-stock alert when remaining birds fall below this count.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSavingSettings}
            aria-busy={isSavingSettings}
            className="min-h-[44px] px-6 py-2.5 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingSettings ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Install App / Add to Home Screen */}
      <PWAInstallButton variant="card" />

      {/* Mode-Aware Reset Controls */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E3E6E8] dark:border-[#2A2F35] pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#17807D] dark:text-[#D4F56B]" />
            <span>{isDemoMode ? 'Demo Sandbox Reset' : 'Reset Application Data'}</span>
          </h3>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              isDemoMode
                ? 'bg-[#17807D]/15 text-[#17807D] dark:bg-[#D4F56B]/20 dark:text-[#D4F56B]'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
            }`}
          >
            {isDemoMode ? 'Demo Sandbox (Isolated)' : 'Real Owner Account'}
          </span>
        </div>

        <p className="text-xs text-[#636B76] dark:text-[#8A929C] leading-relaxed">
          {isDemoMode
            ? 'You are signed into the isolated Demo account. Resetting here refreshes only the 6-month sample history — your real owner records stay completely separate and untouched.'
            : 'Clear all real business records (suppliers, trucks, bird batches, sales, buyer shops, workers, and shop expenses) to start fresh from zero. Demo mode stays separate and is never affected.'}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => void handleWorkspaceReset()}
            disabled={resetting}
            aria-busy={resetting}
            className={`min-h-[42px] px-5 py-2 text-xs font-bold rounded-full transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              isDemoMode
                ? confirmReset
                  ? 'bg-[#17807D] text-white'
                  : 'border border-[#17807D]/40 dark:border-[#D4F56B]/40 text-[#17807D] dark:text-[#D4F56B] hover:bg-[#17807D]/10 dark:hover:bg-[#D4F56B]/10'
                : confirmReset
                ? 'bg-rose-600 text-white'
                : 'border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            {isDemoMode ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>
              {resetting
                ? 'Resetting...'
                : isDemoMode
                ? confirmReset
                  ? 'Click Again to Reset Demo Data'
                  : 'Reset Demo Data (Fresh 6 Months)'
                : confirmReset
                ? 'Click Again to Permanently Clear All Records'
                : 'Reset All Data'}
            </span>
          </button>

          {confirmReset && !resetting && (
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] text-[#4A515B] dark:text-[#A3AAB3] hover:bg-[#F3F5F6] dark:hover:bg-[#20242A] cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

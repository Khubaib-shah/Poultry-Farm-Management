import React, { useState, useEffect } from 'react';
import {
  Save,
  Database,
  RefreshCw,
} from 'lucide-react';
import { AppSettings } from '../types/index.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';
import { PWAInstallButton } from '../components/common/PWAInstallButton.tsx';

export const SettingsPage: React.FC = () => {
  const storeSettings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const seedDemoData = useAppStore((s) => s.seedDemoData);

  const [formState, setFormState] = useState<AppSettings>(storeSettings);
  const [confirmReset, setConfirmReset] = useState(false);

  const { isSubmitting: isSavingSettings, run: runSaveSettings } = useThrottledSubmit();
  const { isSubmitting: seeding, run: runSeed } = useThrottledSubmit();

  useEffect(() => {
    setFormState(storeSettings);
  }, [storeSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSaveSettings(async () => {
      try {
        await updateSettings(formState);
      } catch {
        // handled by store
      }
    });
  };

  const handleSeed = async (force: boolean) => {
    if (force && !confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    await runSeed(async () => {
      try {
        await seedDemoData(force);
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
          Update shop name, low stock warning level, and sample test data
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

      {/* Sample Data Controls */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 sm:p-6 space-y-4 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider">Sample Business Data</h3>
        <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
          Load ready-made suppliers, trucks, bird stock, counter sales, wholesale shops, wages, and shop bills so every screen works together cleanly.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => void handleSeed(false)}
            disabled={seeding}
            className="min-h-[42px] px-4 py-2 text-xs font-bold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F8F9FA] dark:bg-[#20242A] hover:bg-[#EDEEEF] dark:hover:bg-[#272C33] disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{seeding ? 'Loading...' : 'Fill Sample Data (If Empty)'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSeed(true)}
            disabled={seeding}
            className={`min-h-[42px] px-4 py-2 text-xs font-bold rounded-full transition flex items-center gap-2 cursor-pointer ${
              confirmReset
                ? 'bg-rose-600 text-white'
                : 'border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {confirmReset
                ? 'Click Again to Reset All Data'
                : 'Reset to Fresh Sample Data'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

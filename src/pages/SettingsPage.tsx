import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { AppSettings } from '../types/index.ts';
import { api } from '../services/api.ts';
import { formatPKR } from '../utils/formatters.ts';

interface SettingsPageProps {
  onShowToast: (text: string, type: 'success' | 'error') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onShowToast }) => {
  const [settings, setSettings] = useState<AppSettings>({
    businessName: 'Al-Madina Poultry Traders',
    businessLocation: 'Lahore Road, Punjab, Pakistan',
    examplePrice1: '1200',
    examplePrice2: '1500',
    lowStockThreshold: '300',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      setSettings(res);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.updateSettings(settings);
      onShowToast('Settings updated successfully', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    if (
      !confirm(
        'Populate database with sample Punjab suppliers, vehicle loads, and sales records? (Will only add if database is empty)'
      )
    ) {
      return;
    }

    try {
      setSeeding(true);
      const res = await api.seedData();
      onShowToast(res.message, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Seed failed', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-[26px] sm:text-[28px] leading-[34px] font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
          System Settings & Configurations
        </h2>
        <p className="text-xs text-[#4A515B] dark:text-[#A3AAB3] mt-0.5">
          Configure business details, benchmark pricing presets, and database controls
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business Identity */}
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider border-b border-[#E3E6E8] dark:border-[#2A2F35] pb-2">
            Business Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-1">
                Business Name
              </label>
              <input
                type="text"
                value={settings.businessName}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                required
                className="w-full px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-1">
                Location & City (Punjab)
              </label>
              <input
                type="text"
                value={settings.businessLocation}
                onChange={(e) => setSettings({ ...settings, businessLocation: e.target.value })}
                required
                className="w-full px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              />
            </div>
          </div>
        </div>

        {/* Pricing Suggestion Benchmarks */}
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider border-b border-[#E3E6E8] dark:border-[#2A2F35] pb-2">
            Selling Price Calculator Presets
          </h3>
          <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
            Configure the two example selling price benchmarks shown in the Cost Analysis calculator
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-1">
                Example Selling Price 1 (PKR)
              </label>
              <input
                type="number"
                value={settings.examplePrice1}
                onChange={(e) => setSettings({ ...settings, examplePrice1: e.target.value })}
                required
                className="w-full px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] font-mono focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              />
              <p className="text-[10px] text-[#636B76] dark:text-[#8A929C] mt-1">
                Default benchmark (e.g. Rs. 1,200)
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-1">
                Example Selling Price 2 (PKR)
              </label>
              <input
                type="number"
                value={settings.examplePrice2}
                onChange={(e) => setSettings({ ...settings, examplePrice2: e.target.value })}
                required
                className="w-full px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] font-mono focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
              />
              <p className="text-[10px] text-[#636B76] dark:text-[#8A929C] mt-1">
                Default benchmark (e.g. Rs. 1,500)
              </p>
            </div>
          </div>
        </div>

        {/* Inventory Alert Threshold */}
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider border-b border-[#E3E6E8] dark:border-[#2A2F35] pb-2">
            Inventory Alerts
          </h3>

          <div>
            <label className="block text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider mb-1">
              Low Stock Warning Threshold (Pieces)
            </label>
            <input
              type="number"
              value={settings.lowStockThreshold}
              onChange={(e) => setSettings({ ...settings, lowStockThreshold: e.target.value })}
              required
              className="w-48 px-4 py-2 text-xs border border-[#E3E6E8] dark:border-[#2A2F35] rounded-full bg-[#F3F5F6]/50 dark:bg-[#1F2328]/50 text-[#14161A] dark:text-[#F2F4F5] font-mono focus:outline-none focus:ring-2 focus:ring-[#D4F56B]"
            />
            <p className="text-[10px] text-[#636B76] dark:text-[#8A929C] mt-1">
              Batches with fewer than this number of remaining pieces will be flagged as low stock
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 flex items-center space-x-2 shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
          </button>
        </div>
      </form>

      {/* Database Controls */}
      <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-6 space-y-4 shadow-xs">
        <h3 className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
          Database Management
        </h3>
        <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
          Managed Cloud SQL PostgreSQL database with persistent storage
        </p>

        <div className="flex items-center space-x-3 pt-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 text-xs font-bold rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F8F9FA] dark:bg-[#20242A] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#EDEEEF] dark:hover:bg-[#272C33] disabled:opacity-50 transition flex items-center space-x-2"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{seeding ? 'Seeding...' : 'Seed Sample Pakistani Poultry Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

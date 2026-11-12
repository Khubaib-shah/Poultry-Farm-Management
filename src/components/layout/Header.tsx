import React, { useState, useEffect } from 'react';
import { Calendar, User, LogOut, RefreshCw, Plus } from 'lucide-react';
import { NavItemKey } from './Sidebar.tsx';

interface HeaderProps {
  currentTab: NavItemKey;
  onQuickAction?: (action: 'new-sale' | 'new-load' | 'receive-stock') => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const titles: Record<NavItemKey, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Business Overview Dashboard',
    subtitle: 'Real-time revenue, gross profit, stock levels, and daily performance metrics',
  },
  purchases: {
    title: 'Purchases & Vehicle Loads',
    subtitle: 'Manage live whole chicken loads from Punjab suppliers and vehicle transit costs',
  },
  suppliers: {
    title: 'Supplier Management',
    subtitle: 'Supplier directory, purchase history, and outstanding balance summaries',
  },
  inventory: {
    title: 'Inventory & Stock Batches',
    subtitle: 'FIFO batch tracking, live piece counts, cost per piece, and stock ledger',
  },
  shops: {
    title: 'Wholesale Shops & Distribution',
    subtitle: 'Manage retail distribution shops and bulk piece delivery invoices',
  },
  'own-shop-sales': {
    title: 'Own Shop Sales Counter',
    subtitle: 'Rapid piece-based retail counter sales with automated FIFO cost and profit deduction',
  },
  'dealer-ledger': {
    title: 'Dealer Ledger & Supplier Debits/Credits',
    subtitle: 'Double-entry purchase debits, payment credits, and running balance ledger',
  },
  workers: {
    title: 'Workers & Wage Payments',
    subtitle: 'Worker attendance, loaders, shop staff, and flexible wage disbursements',
  },
  expenses: {
    title: 'General Operating Expenses',
    subtitle: 'Daily farm and retail shop expenses: electricity, rent, maintenance, food, tea',
  },
  reports: {
    title: 'Daily & Monthly Profit & Loss Reports',
    subtitle: 'Financial statements, COGS FIFO recognition, gross/net margins, and Excel export',
  },
  settings: {
    title: 'System Settings & Configurations',
    subtitle: 'Business identity, example selling price calculators, and database management',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onQuickAction,
  onRefresh,
  isRefreshing,
}) => {
  const [currentDateFormatted, setCurrentDateFormatted] = useState('');

  useEffect(() => {
    const now = new Date();
    // Pakistan time formatting
    const formatted = now.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    setCurrentDateFormatted(formatted);
  }, []);

  const meta = titles[currentTab] || { title: 'Poultry System', subtitle: '' };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 px-6 flex items-center justify-between">
      {/* Title & Context */}
      <div>
        <h2 className="text-base font-bold text-slate-800 leading-tight">
          {meta.title}
        </h2>
        <p className="text-xs text-slate-500 hidden sm:block">
          {meta.subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Quick Action Buttons */}
        {onQuickAction && (
          <div className="hidden md:flex items-center space-x-2">
            <button
              onClick={() => onQuickAction('new-sale')}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Quick Sale
            </button>
            <button
              onClick={() => onQuickAction('new-load')}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Load
            </button>
          </div>
        )}

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh database records"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded border border-slate-200 bg-white hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Current Date */}
        <div className="hidden lg:flex items-center text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
          <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
          <span>{currentDateFormatted || 'Wednesday, 11 November 2026'}</span>
        </div>

        {/* User Profile */}
        <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
          <div className="w-7 h-7 rounded bg-slate-800 text-slate-100 flex items-center justify-center text-xs font-bold">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-800 leading-none">
              Business Owner
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">
              Lahore, Punjab
            </div>
          </div>
        </div>

        {/* Logout (Switch User) */}
        <button
          onClick={() => {
            if (confirm('Switch user session or log out?')) {
              window.location.reload();
            }
          }}
          title="Logout"
          className="p-1.5 text-slate-400 hover:text-red-600 rounded transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

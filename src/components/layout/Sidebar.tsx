import React from 'react';
import {
  LayoutDashboard,
  Truck,
  Users,
  Boxes,
  Store,
  ShoppingBag,
  BookOpen,
  Briefcase,
  Receipt,
  BarChart3,
  Settings,
} from 'lucide-react';

export type NavItemKey =
  | 'dashboard'
  | 'purchases'
  | 'suppliers'
  | 'inventory'
  | 'shops'
  | 'own-shop-sales'
  | 'dealer-ledger'
  | 'workers'
  | 'expenses'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  availableStock?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  availableStock = 0,
}) => {
  const navItems: Array<{
    key: NavItemKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    highlight?: boolean;
  }> = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'purchases', label: 'Purchases & Loads', icon: Truck },
    { key: 'suppliers', label: 'Suppliers', icon: Users },
    {
      key: 'inventory',
      label: 'Inventory / Stock',
      icon: Boxes,
      badge: availableStock > 0 ? `${availableStock} pcs` : undefined,
    },
    { key: 'shops', label: 'Shops & Distribution', icon: Store },
    {
      key: 'own-shop-sales',
      label: 'Own Shop Sales',
      icon: ShoppingBag,
      highlight: true,
    },
    { key: 'dealer-ledger', label: 'Dealer Ledger', icon: BookOpen },
    { key: 'workers', label: 'Workers & Payments', icon: Briefcase },
    { key: 'expenses', label: 'Expenses', icon: Receipt },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed inset-y-0 left-0 z-30 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800 bg-slate-950/60">
        <img
          src="/assets/aistudio/check-in_ceb7ef49.webp"
          alt="Al-Madina Poultry Logo"
          className="w-8 h-8 rounded-[8px] object-cover bg-[#F3F3F3] mr-3 shadow-xs"
        />
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight leading-tight">
            AL-MADINA POULTRY
          </h1>
          <p className="text-[11px] text-slate-400 font-mono tracking-wide uppercase">
            Farm Management System
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Main Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.key;

          return (
            <button
              key={item.key}
              onClick={() => onSelectTab(item.key)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-colors text-left ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : item.highlight
                  ? 'text-emerald-400 hover:bg-slate-800/80 hover:text-emerald-300'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-800 text-emerald-400 border border-emerald-900/50'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer / System Status */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-300 font-medium">PostgreSQL Live</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">v1.2 PK</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 truncate">
          Pakistan Poultry Core
        </p>
      </div>
    </aside>
  );
};

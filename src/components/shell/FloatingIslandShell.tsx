import React, { useState } from 'react';
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
  Feather,
  Sun,
  Moon,
  HelpCircle,
  Plus,
  Menu,
  X,
  User,
  ChevronDown,
  Database,
  Calculator,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.tsx';

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

interface FloatingIslandShellProps {
  currentTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  availableStock?: number;
  onQuickAction: (action: 'new-sale' | 'new-load' | 'calculator') => void;
  children: React.ReactNode;
}

export const FloatingIslandShell: React.FC<FloatingIslandShellProps> = ({
  currentTab,
  onSelectTab,
  availableStock = 0,
  onQuickAction,
  children,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Primary horizontal pill navigation items
  const primaryNavTabs: Array<{ key: NavItemKey; label: string; badge?: string | number }> = [
    { key: 'dashboard', label: 'DASHBOARD' },
    { key: 'purchases', label: 'PURCHASES' },
    { key: 'inventory', label: 'STOCK', badge: availableStock > 0 ? `${availableStock}` : undefined },
    { key: 'own-shop-sales', label: 'OWN SHOP' },
    { key: 'dealer-ledger', label: 'LEDGER' },
    { key: 'reports', label: 'REPORTS' },
  ];

  // Secondary/All modules list for Left Rail & Slide-Over Drawer
  const allModules: Array<{
    key: NavItemKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    category?: string;
  }> = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'purchases', label: 'Purchases & Loads', icon: Truck },
    { key: 'inventory', label: 'Inventory / Stock', icon: Boxes },
    { key: 'own-shop-sales', label: 'Own Shop Sales', icon: ShoppingBag },
    { key: 'shops', label: 'Wholesale Shops', icon: Store },
    { key: 'dealer-ledger', label: 'Dealer Ledger', icon: BookOpen },
    { key: 'suppliers', label: 'Suppliers', icon: Users },
    { key: 'workers', label: 'Workers & Wages', icon: Briefcase },
    { key: 'expenses', label: 'General Expenses', icon: Receipt },
    { key: 'reports', label: 'Profit & Loss Reports', icon: BarChart3 },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F2F4F4] dark:bg-[#0F1113] text-[#14161A] dark:text-[#F2F4F5] relative transition-colors duration-200 selection:bg-[#D4F56B] selection:text-[#14161A]">
      {/* ------------------------------------------------------------- */}
      {/* TOP FADE GRADIENT MASK (Content scrolls gracefully under pills) */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden xl:block pointer-events-none fixed top-0 inset-x-0 h-14 bg-gradient-to-b from-[#F2F4F4] via-[#F2F4F4]/90 to-transparent dark:from-[#0F1113] dark:via-[#0F1113]/90 z-30" />

      {/* ------------------------------------------------------------- */}
      {/* 1. TOP-LEFT LOGO TILE (52x52px, rounded-[18px])               */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden xl:flex fixed top-5 left-5 z-40 w-[52px] h-[52px] rounded-[18px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] items-center justify-center transition-transform hover:scale-105">
        <div className="w-[34px] h-[34px] rounded-[12px] bg-[#D4F56B] flex items-center justify-center text-[#14161A] font-bold shadow-xs">
          <Feather className="w-5 h-5" />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FLOATING NAV PILL (Desktop xl+)                             */}
      {/* ------------------------------------------------------------- */}
      <nav
        aria-label="Primary Navigation"
        className="hidden xl:flex fixed top-5 left-[84px] z-40 h-12 rounded-full p-1 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] items-center gap-1"
      >
        {primaryNavTabs.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelectTab(tab.key)}
              className={`relative px-3.5 h-10 rounded-full text-[12px] font-bold tracking-[0.08em] uppercase transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? 'bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] shadow-xs'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D4F56B] text-[#14161A] font-mono leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* More Modules Dropdown Trigger */}
        <div className="relative border-l border-[#E3E6E8] dark:border-[#2A2F35] pl-1 pr-1.5">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="px-2.5 h-10 rounded-full text-[11px] font-bold tracking-[0.08em] uppercase text-[#636B76] dark:text-[#8A929C] hover:text-[#14161A] dark:hover:text-white flex items-center gap-1"
          >
            <span>MORE</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* ------------------------------------------------------------- */}
      {/* 3. FLOATING TOP-RIGHT UTILITY CLUSTER                          */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden xl:flex fixed top-5 right-5 xl:right-10 z-40 items-center gap-3">
        {/* PostgreSQL Live Status Pill */}
        <div className="h-10 px-3.5 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] uppercase text-[#4A515B] dark:text-[#A3AAB3]">
          <span>Khubaib Shah</span>
        </div>

        {/* Primary Action Button: Electric Lime #D4F56B */}
        <button
          onClick={() => onQuickAction('new-sale')}
          className="h-10 px-4 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 transition-all duration-150 transform active:scale-95 shadow-[0_2px_8px_rgba(212,245,107,0.4)] cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>QUICK SALE</span>
        </button>

        {/* User Profile Pill */}
        <div className="relative">
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="h-10 px-2.5 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] flex items-center gap-2 hover:border-[#D7DBDF] dark:hover:border-[#373E47] transition cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-[#14161A] text-[#D4F56B] flex items-center justify-center font-bold text-[11px]">
              OP
            </div>
            <span className="text-xs font-semibold text-[#14161A] dark:text-[#F2F4F5]">
              Al-Madina
            </span>
            <ChevronDown className="w-3 h-3 text-[#636B76]" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 top-12 w-56 p-2 rounded-[18px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="p-2 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
                <div className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5]">
                  Farm Owner
                </div>
                <div className="text-[11px] text-[#636B76] dark:text-[#8A929C]">
                  Lahore Road, Punjab
                </div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onSelectTab('settings');
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] font-medium transition"
                >
                  Business Settings
                </button>
                <button
                  onClick={() => {
                    onSelectTab('dealer-ledger');
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] font-medium transition"
                >
                  Dealer Accounts
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. FLOATING VERTICAL LEFT RAIL (Quick Filters & Navigation)   */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden xl:flex fixed top-28 left-5 z-40 flex-col items-center w-[52px] p-1.5 gap-1.5 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)]">
        {allModules.slice(0, 7).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelectTab(item.key)}
              title={item.label}
              className={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all duration-150 transform hover:scale-105 active:scale-95 group relative ${
                isActive
                  ? 'bg-[#D4F56B] text-[#14161A] shadow-xs'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] hover:text-[#14161A] dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {/* Tooltip on hover */}
              <span className="opacity-0 group-hover:opacity-100 transition absolute left-14 z-50 bg-[#14161A] text-white text-[11px] font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-md pointer-events-none">
                {item.label}
              </span>
            </button>
          );
        })}

        <div className="w-6 h-px bg-[#E3E6E8] dark:bg-[#2A2F35] my-0.5" />

        {/* Quick Drawer trigger */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          title="All 11 Modules"
          className="w-10 h-10 rounded-[14px] flex items-center justify-center text-[#4A515B] dark:text-[#A3AAB3] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] hover:text-[#14161A] dark:hover:text-white transition"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. FLOATING BOTTOM-LEFT CONTROLS (Theme + Help)               */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden xl:flex fixed bottom-5 left-5 z-40 flex-col gap-2.5">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-[52px] h-[52px] rounded-[20px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] flex items-center justify-center text-[#14161A] dark:text-[#F2F4F5] hover:scale-105 active:scale-95 transition cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-[#F6E7A1]" />
          ) : (
            <Moon className="w-5 h-5 text-[#14161A]" />
          )}
        </button>

        {/* Help / Shortcuts Button */}
        <button
          onClick={() => setHelpModalOpen(true)}
          title="System Guide & Shortcuts"
          className="w-[52px] h-[52px] rounded-[20px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] flex items-center justify-center text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white hover:scale-105 active:scale-95 transition cursor-pointer"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. MOBILE & TABLET FLOATING SHELL (< xl breakpoint)           */}
      {/* ------------------------------------------------------------- */}
      {/* Mobile Top Bar */}
      <div className="xl:hidden fixed top-3 inset-x-3 z-40 h-14 bg-white/95 dark:bg-[#181B1F]/95 backdrop-blur-md rounded-[20px] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-lg px-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[12px] bg-[#D4F56B] flex items-center justify-center text-[#14161A]">
            <Feather className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wide">
              Al-Madina Poultry
            </div>
            <div className="text-[10px] text-[#636B76] dark:text-[#8A929C] font-mono">
              Stock: {availableStock} pcs
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onQuickAction('new-sale')}
            aria-label="Quick Sale"
            className="w-9 h-9 rounded-full bg-[#D4F56B] text-[#14161A] flex items-center justify-center shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open Navigation Drawer"
            className="w-9 h-9 rounded-full bg-[#F3F5F6] dark:bg-[#1F2328] text-[#14161A] dark:text-white flex items-center justify-center cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Floating Pill Tab Bar */}
      <div className="xl:hidden fixed bottom-3.5 inset-x-0 mx-auto w-[min(90%,360px)] h-14 bg-white/95 dark:bg-[#181B1F]/95 backdrop-blur-md rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] shadow-2xl px-3 flex items-center justify-between z-40">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`p-2 rounded-full transition ${
            currentTab === 'dashboard'
              ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
              : 'text-[#636B76] dark:text-[#8A929C]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectTab('purchases')}
          className={`p-2 rounded-full transition ${
            currentTab === 'purchases'
              ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
              : 'text-[#636B76] dark:text-[#8A929C]'
          }`}
        >
          <Truck className="w-5 h-5" />
        </button>

        {/* Center Elevated Action Pill */}
        <button
          onClick={() => onQuickAction('new-sale')}
          className="w-10 h-10 -mt-3 rounded-full bg-[#D4F56B] text-[#14161A] flex items-center justify-center shadow-lg transform active:scale-90"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        <button
          onClick={() => onSelectTab('own-shop-sales')}
          className={`p-2 rounded-full transition ${
            currentTab === 'own-shop-sales'
              ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
              : 'text-[#636B76] dark:text-[#8A929C]'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectTab('reports')}
          className={`p-2 rounded-full transition ${
            currentTab === 'reports'
              ? 'bg-[#14161A] text-[#D4F56B] dark:bg-[#D4F56B] dark:text-[#14161A]'
              : 'text-[#636B76] dark:text-[#8A929C]'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
        </button>
      </div>

      {/* Slide-over Drawer for All 11 Modules */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-[85%] max-w-[340px] bg-white dark:bg-[#181B1F] h-full shadow-2xl z-50 flex flex-col p-5 border-r border-[#E3E6E8] dark:border-[#2A2F35]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[12px] bg-[#D4F56B] flex items-center justify-center text-[#14161A]">
                  <Feather className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm tracking-tight text-[#14161A] dark:text-[#F2F4F5]">
                  Al-Madina Poultry
                </span>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-1">
              <div className="text-[10px] font-bold text-[#636B76] dark:text-[#8A929C] uppercase tracking-wider px-2 py-1">
                All Modules
              </div>
              {allModules.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      onSelectTab(item.key);
                      setMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                      isActive
                        ? 'bg-[#D4F56B] text-[#14161A]'
                        : 'text-[#4A515B] dark:text-[#A3AAB3] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Controls inside Drawer */}
            <div className="pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between">
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3] px-3 py-2 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35]"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <span className="text-[10px] text-[#636B76] font-mono">v2.0 Island</span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. MAIN CONTENT CANOPY                                         */}
      {/* ------------------------------------------------------------- */}
      <main className="w-full min-h-screen pt-[76px] sm:pt-[84px] xl:pt-[96px] pb-24 xl:pb-12 px-4 sm:px-6 md:px-8 xl:pl-[104px] xl:pr-10">
        {children}
      </main>

      {/* HELP SHORTCUTS MODAL */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#181B1F] rounded-[20px] border border-[#E3E6E8] dark:border-[#2A2F35] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
              <h3 className="font-bold text-sm text-[#14161A] dark:text-white uppercase tracking-wider">
                System Guide & Floating Islands
              </h3>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-4 space-y-3 text-xs text-[#4A515B] dark:text-[#A3AAB3]">
              <p>
                <strong>Floating Island Navigation:</strong> Use the top horizontal pill for fast tab switches and the vertical left rail for quick module access.
              </p>
              <p>
                <strong>FIFO Stock Valuation:</strong> Every sale automatically consumes the oldest active Punjab batch first, ensuring strict cost of goods accuracy.
              </p>
              <p>
                <strong>Landed Costs:</strong> Vehicle transit expenses are added directly to the purchase load cost before calculating piece costs.
              </p>
            </div>
            <div className="pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex justify-end">
              <button
                onClick={() => setHelpModalOpen(false)}
                className="px-4 py-2 rounded-full bg-[#D4F56B] text-[#14161A] font-bold text-xs uppercase"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

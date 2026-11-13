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
  Sun,
  Moon,
  HelpCircle,
  Plus,
  Menu,
  X,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  User,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTheme } from '../../context/ThemeContext.tsx';
import { getLocalPakistanDate } from '../../utils/syncCalculations.ts';
import { PWAInstallButton } from '../common/PWAInstallButton.tsx';

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
  pendingLoadsCount?: number;
  businessName?: string;
  globalError?: string | null;
  onDismissError?: () => void;
  onRetrySync?: () => void;
  onQuickAction: (action: 'new-sale' | 'new-load' | 'calculator') => void;
  children: React.ReactNode;
}

const PAGE_TITLES: Record<NavItemKey, string> = {
  dashboard: 'Overview',
  purchases: 'Truck Purchases',
  suppliers: 'Suppliers',
  inventory: 'Bird Stock',
  shops: 'Other Shops',
  'own-shop-sales': 'Shop Sales',
  'dealer-ledger': 'Dealer Accounts',
  workers: 'Staff & Wages',
  expenses: 'Daily Expenses',
  reports: 'Profit & Loss',
  settings: 'Settings',
};

function formatOrdinalHeaderDate(pktDateStr: string = getLocalPakistanDate()): string {
  const [yearStr, monthStr, dayStr] = pktDateStr.split('-');
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
      ? 'nd'
      : day % 10 === 3 && day !== 13
      ? 'rd'
      : 'th';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[parseInt(monthStr, 10) - 1] || '';
  return `${day}${suffix} ${month} ${year}`;
}

export const FloatingIslandShell: React.FC<FloatingIslandShellProps> = ({
  currentTab,
  onSelectTab,
  availableStock = 0,
  pendingLoadsCount = 0,
  businessName = 'Al-Madina',
  globalError = null,
  onDismissError,
  onRetrySync,
  onQuickAction,
  children,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const primaryNavTabs: Array<{ key: NavItemKey; label: string; badge?: string | number }> = [
    { key: 'dashboard', label: 'OVERVIEW' },
    {
      key: 'purchases',
      label: 'TRUCKS',
      badge: pendingLoadsCount > 0 ? pendingLoadsCount : undefined,
    },
    { key: 'inventory', label: 'STOCK', badge: availableStock > 0 ? `${availableStock}` : undefined },
    { key: 'own-shop-sales', label: 'SHOP SALES' },
    { key: 'dealer-ledger', label: 'ACCOUNTS' },
    { key: 'reports', label: 'REPORTS' },
  ];

  const allModules: Array<{
    key: NavItemKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { key: 'purchases', label: 'Truck Purchases', icon: Truck },
    { key: 'inventory', label: 'Bird Stock & Rates', icon: Boxes },
    { key: 'own-shop-sales', label: 'Walk-in Shop Sales', icon: ShoppingBag },
    { key: 'shops', label: 'Other Chicken Shops', icon: Store },
    { key: 'dealer-ledger', label: 'Dealer Accounts', icon: BookOpen },
    { key: 'suppliers', label: 'Suppliers', icon: Users },
    { key: 'workers', label: 'Staff & Wages', icon: Briefcase },
    { key: 'expenses', label: 'Daily Expenses', icon: Receipt },
    { key: 'reports', label: 'Profit & Loss Report', icon: BarChart3 },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  const todayFormatted = formatOrdinalHeaderDate();

  return (
    <div className="min-h-screen bg-[#F2F4F4] dark:bg-[#0F1113] text-[#14161A] dark:text-[#F2F4F5] relative transition-colors duration-200 selection:bg-[#D4F56B] selection:text-[#14161A]">
      {/* TOP FADE GRADIENT MASK (Desktop xl+) */}
      <div className="hidden xl:block pointer-events-none fixed top-0 inset-x-0 h-16 bg-gradient-to-b from-[#F2F4F4] via-[#F2F4F4]/90 to-transparent dark:from-[#0F1113] dark:via-[#0F1113]/90 z-30" />

      {/* 1. DESKTOP TOP-LEFT LOGO TILE */}
      <button
        type="button"
        onClick={() => onSelectTab('dashboard')}
        aria-label="Go to Overview"
        className="hidden xl:flex fixed top-5 left-5 z-40 w-[52px] h-[52px] rounded-[18px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] items-center justify-center p-1 transition-transform hover:scale-105 cursor-pointer"
      >
        <img
          src="/assets/aistudio/check-in_ceb7ef49.webp"
          alt="Al-Madina Poultry Logo"
          className="w-full h-full rounded-[13px] object-cover bg-[#F3F3F3]"
        />
      </button>

      {/* 2. DESKTOP FLOATING NAV PILL */}
      <nav
        aria-label="Primary Navigation"
        className="hidden xl:flex fixed top-5 left-[84px] z-40 h-12 rounded-full p-1 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] items-center gap-0.5"
      >
        {primaryNavTabs.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelectTab(tab.key)}
              className={`relative px-3.5 h-10 rounded-full text-[12px] font-bold tracking-[0.07em] uppercase transition-colors duration-150 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'text-[#14161A] dark:text-[#F2F4F5]'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="desktopNavPill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] -z-10"
                />
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#D4F56B] text-[#14161A] font-mono leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* More Modules Trigger */}
        <div className="relative border-l border-[#E3E6E8] dark:border-[#2A2F35] pl-1 pr-1.5">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="px-2.5 h-10 rounded-full text-[11px] font-bold tracking-[0.08em] uppercase text-[#636B76] dark:text-[#8A929C] hover:text-[#14161A] dark:hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <span>MORE</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* 3. DESKTOP TOP-RIGHT UTILITY CLUSTER */}
      <div className="hidden xl:flex fixed top-5 right-6 z-40 items-center gap-2.5">
        <div className="h-10 px-3.5 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] uppercase text-[#4A515B] dark:text-[#A3AAB3]">
          <span>Khubaib Shah</span>
        </div>

        <PWAInstallButton variant="pill" />

        <button
          type="button"
          onClick={() => onQuickAction('new-sale')}
          className="h-10 px-4 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 transition-all duration-150 transform active:scale-95 shadow-[0_2px_8px_rgba(212,245,107,0.4)] cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>QUICK SALE</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="h-10 px-2.5 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] bg-white dark:bg-[#181B1F] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] flex items-center gap-2 hover:border-[#D7DBDF] dark:hover:border-[#373E47] focus:outline-none transition cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-[#14161A] dark:text-[#F2F4F5] max-w-[110px] truncate">
              {businessName.split(' ')[0] || 'Al-Madina'}
            </span>
            <ChevronDown className="w-3 h-3 text-[#636B76]" />
          </button>

          <AnimatePresence>
            {profileDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-12 w-56 p-2 rounded-[18px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-xl z-50"
              >
                <div className="p-2 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
                  <div className="text-xs font-bold text-[#14161A] dark:text-[#F2F4F5]">
                    {businessName}
                  </div>
                  <div className="text-[11px] text-[#636B76] dark:text-[#8A929C]">
                    Farm & Shop Manager
                  </div>
                </div>
                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab('settings');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 text-xs rounded-lg hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] font-medium transition cursor-pointer"
                  >
                    Shop Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab('dealer-ledger');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 text-xs rounded-lg hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] font-medium transition cursor-pointer"
                  >
                    Dealer Accounts
                  </button>
                  <PWAInstallButton
                    variant="menu-item"
                    onActionComplete={() => setProfileDropdownOpen(false)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 4. DESKTOP FLOATING VERTICAL LEFT RAIL */}
      <div className="hidden xl:flex fixed top-28 left-5 z-40 flex-col items-center w-[52px] p-1.5 gap-1.5 bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)]">
        {allModules.slice(0, 8).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectTab(item.key)}
              title={item.label}
              className={`w-10 h-10 rounded-[14px] flex items-center justify-center transition-all duration-150 transform hover:scale-105 active:scale-95 group relative cursor-pointer ${
                isActive
                  ? 'bg-[#D4F56B] text-[#14161A] shadow-xs'
                  : 'text-[#4A515B] dark:text-[#A3AAB3] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] hover:text-[#14161A] dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="opacity-0 group-hover:opacity-100 transition absolute left-14 z-50 bg-[#14161A] text-white text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-md pointer-events-none">
                {item.label}
              </span>
            </button>
          );
        })}

        <div className="w-6 h-px bg-[#E3E6E8] dark:bg-[#2A2F35] my-0.5" />

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          title="All Sections"
          className="w-10 h-10 rounded-[14px] flex items-center justify-center text-[#4A515B] dark:text-[#A3AAB3] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] hover:text-[#14161A] dark:hover:text-white transition cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* 5. DESKTOP BOTTOM-LEFT CONTROLS */}
      <div className="hidden xl:flex fixed bottom-5 left-5 z-40 flex-col gap-2.5">
        <button
          type="button"
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

        <button
          type="button"
          onClick={() => setHelpModalOpen(true)}
          title="Quick Guide"
          className="w-[52px] h-[52px] rounded-[20px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] flex items-center justify-center text-[#4A515B] dark:text-[#A3AAB3] hover:text-[#14161A] dark:hover:text-white hover:scale-105 active:scale-95 transition cursor-pointer"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* 6. MOBILE & TABLET FLOATING BUTTON HEADER (< xl) */}
      <header className="xl:hidden px-4 sm:px-6 pt-4 pb-0 space-y-3 sm:space-y-4">
        {/* Top Row: Backgroundless floating icon buttons (Logo left, + & Menu right) */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            aria-label="Al-Madina Poultry Home"
            className="w-11 h-11 rounded-[16px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_6px_18px_rgba(20,22,26,0.06)] flex items-center justify-center p-1 active:scale-95 transition cursor-pointer"
          >
            <img
              src="/assets/aistudio/check-in_ceb7ef49.webp"
              alt="Al-Madina Poultry Logo"
              className="w-full h-full rounded-[11px] object-cover bg-[#F3F3F3]"
            />
          </button>

          <div className="flex items-center gap-2">
            <PWAInstallButton variant="mobile-icon" />
            <button
              type="button"
              onClick={() => onQuickAction('new-sale')}
              aria-label="Quick Sale"
              className="w-11 h-11 rounded-full bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_6px_18px_rgba(20,22,26,0.06)] flex items-center justify-center text-[#14161A] dark:text-white active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-5 h-5 stroke-[2]" />
            </button>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open All Menu Sections"
              className="w-11 h-11 rounded-full bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_1px_2px_rgba(20,22,26,0.04),0_6px_18px_rgba(20,22,26,0.06)] flex items-center justify-center text-[#14161A] dark:text-white active:scale-95 transition cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Second Row: Current Page Title + Date left, Quick Square Icon Buttons right */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[24px] sm:text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5] truncate">
              {PAGE_TITLES[currentTab]}
            </div>
            <div className="text-xs font-medium text-[#636B76] dark:text-[#8A929C] mt-0.5">
              {todayFormatted} · {availableStock.toLocaleString('en-PK')} birds in stock
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-10 h-10 rounded-[14px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-xs flex items-center justify-center text-[#14161A] dark:text-[#F6E7A1] active:scale-95 transition cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('purchases')}
              aria-label="Check Truck Arrivals"
              className="relative w-10 h-10 rounded-[14px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-xs flex items-center justify-center text-[#14161A] dark:text-white active:scale-95 transition cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              {pendingLoadsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#F2F4F4] dark:ring-[#0F1113]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 7. MOBILE BOTTOM FLOATING PILL NAV (< xl) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="xl:hidden fixed bottom-3.5 inset-x-0 mx-auto w-[min(92%,380px)] h-16 bg-white/95 dark:bg-[#181B1F]/95 backdrop-blur-md rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_8px_30px_rgba(20,22,26,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] px-3 flex items-center justify-between z-40"
      >
        {/* Tab 1: Dashboard */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          aria-label="Overview"
          className="relative w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer"
        >
          {currentTab === 'dashboard' && (
            <motion.span
              layoutId="mobileNavActive"
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 rounded-full bg-[#F3F5F6] dark:bg-[#272C33]"
            />
          )}
          <LayoutDashboard
            className={`relative z-10 w-5 h-5 transition-colors ${
              currentTab === 'dashboard'
                ? 'text-[#14161A] dark:text-[#F2F4F5] stroke-[2.2]'
                : 'text-[#636B76] dark:text-[#8A929C]'
            }`}
          />
        </button>

        {/* Tab 2: Truck Purchases (with electric-lime count badge) */}
        <button
          type="button"
          onClick={() => onSelectTab('purchases')}
          aria-label="Truck Purchases"
          className="relative w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer"
        >
          {currentTab === 'purchases' && (
            <motion.span
              layoutId="mobileNavActive"
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 rounded-full bg-[#F3F5F6] dark:bg-[#272C33]"
            />
          )}
          <Truck
            className={`relative z-10 w-5 h-5 transition-colors ${
              currentTab === 'purchases'
                ? 'text-[#14161A] dark:text-[#F2F4F5] stroke-[2.2]'
                : 'text-[#636B76] dark:text-[#8A929C]'
            }`}
          />
          {pendingLoadsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 z-20 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D4F56B] text-[#14161A] text-[10px] font-black flex items-center justify-center leading-none shadow-xs">
              {pendingLoadsCount}
            </span>
          )}
        </button>

        {/* Center: Flush Electric Lime + Button */}
        <button
          type="button"
          onClick={() => onQuickAction('new-sale')}
          aria-label="New Quick Sale"
          className="w-12 h-12 rounded-full bg-[#D4F56B] hover:bg-[#C9EE55] text-[#14161A] flex items-center justify-center shadow-[0_2px_10px_rgba(212,245,107,0.45)] active:scale-90 transition-transform cursor-pointer"
        >
          <Plus className="w-6 h-6 stroke-[2.3]" />
        </button>

        {/* Tab 4: Shop Sales */}
        <button
          type="button"
          onClick={() => onSelectTab('own-shop-sales')}
          aria-label="Shop Sales"
          className="relative w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer"
        >
          {currentTab === 'own-shop-sales' && (
            <motion.span
              layoutId="mobileNavActive"
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 rounded-full bg-[#F3F5F6] dark:bg-[#272C33]"
            />
          )}
          <ShoppingBag
            className={`relative z-10 w-5 h-5 transition-colors ${
              currentTab === 'own-shop-sales'
                ? 'text-[#14161A] dark:text-[#F2F4F5] stroke-[2.2]'
                : 'text-[#636B76] dark:text-[#8A929C]'
            }`}
          />
        </button>

        {/* Tab 5: Profit & Loss Reports */}
        <button
          type="button"
          onClick={() => onSelectTab('reports')}
          aria-label="Profit & Loss Reports"
          className="relative w-12 h-12 rounded-full flex items-center justify-center transition-colors cursor-pointer"
        >
          {currentTab === 'reports' && (
            <motion.span
              layoutId="mobileNavActive"
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 rounded-full bg-[#F3F5F6] dark:bg-[#272C33]"
            />
          )}
          <BarChart3
            className={`relative z-10 w-5 h-5 transition-colors ${
              currentTab === 'reports'
                ? 'text-[#14161A] dark:text-[#F2F4F5] stroke-[2.2]'
                : 'text-[#636B76] dark:text-[#8A929C]'
            }`}
          />
        </button>
      </nav>

      {/* SLIDE-OVER DRAWER FOR ALL 11 MODULES */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="relative w-[85%] max-w-[330px] bg-white dark:bg-[#181B1F] h-full shadow-2xl z-50 flex flex-col p-5 border-r border-[#E3E6E8] dark:border-[#2A2F35]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/assets/aistudio/check-in_ceb7ef49.webp"
                    alt="Al-Madina Poultry Logo"
                    className="w-9 h-9 rounded-[12px] object-cover border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F3F3F3]"
                  />
                  <div>
                    <div className="font-bold text-sm tracking-tight text-[#14161A] dark:text-[#F2F4F5]">
                      {businessName}
                    </div>
                    <div className="text-[11px] text-[#636B76] dark:text-[#8A929C]">
                      {availableStock} birds in stock
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close Menu"
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-1">
                <div className="text-[10px] font-bold text-[#636B76] dark:text-[#8A929C] uppercase tracking-wider px-2 py-1">
                  Menu Sections
                </div>
                {allModules.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.key);
                        setMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-xs font-bold tracking-wide transition cursor-pointer ${
                        isActive
                          ? 'bg-[#D4F56B] text-[#14161A]'
                          : 'text-[#4A515B] dark:text-[#A3AAB3] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328]'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </span>
                      {item.key === 'purchases' && pendingLoadsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#D4F56B] text-[#14161A] text-[10px] font-bold">
                          {pendingLoadsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 pb-2 border-t border-[#E3E6E8] dark:border-[#2A2F35]">
                <PWAInstallButton
                  variant="menu-item"
                  onActionComplete={() => setMobileDrawerOpen(false)}
                />
              </div>

              <div className="pt-2 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-2 text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3] px-3.5 py-2 rounded-full border border-[#E3E6E8] dark:border-[#2A2F35] cursor-pointer"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    setHelpModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#4A515B] dark:text-[#A3AAB3] px-3 py-2 rounded-full hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Guide</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAIN FULL-WIDTH CONTENT CANOPY (No max-width restrictions) */}
      <main className="w-full min-h-screen pt-4 sm:pt-6 xl:pt-[92px] pb-24 xl:pb-12 px-4 sm:px-6 xl:pl-[96px] xl:pr-6">
        {globalError && (
          <div className="mb-4 rounded-[16px] border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{globalError}</span>
            </div>
            <div className="flex items-center gap-2">
              {onRetrySync && (
                <button
                  type="button"
                  onClick={onRetrySync}
                  className="px-3 py-1.5 rounded-full bg-rose-600 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              )}
              {onDismissError && (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="px-2.5 py-1.5 rounded-full hover:bg-rose-200/50 dark:hover:bg-rose-900/50 font-semibold text-[11px] cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="w-full"
        >
          {children}
        </motion.div>
      </main>

      {/* HELP GUIDE MODAL */}
      <AnimatePresence>
        {helpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16 }}
              className="w-full max-w-md bg-white dark:bg-[#181B1F] rounded-[22px] border border-[#E3E6E8] dark:border-[#2A2F35] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
                <h3 className="font-bold text-sm text-[#14161A] dark:text-white uppercase tracking-wider">
                  Quick Business Guide
                </h3>
                <button
                  type="button"
                  onClick={() => setHelpModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="py-4 space-y-3 text-xs text-[#4A515B] dark:text-[#A3AAB3] leading-relaxed">
                <p>
                  <strong className="text-[#14161A] dark:text-white">1. Buying Trucks:</strong>{' '}
                  Write down the truck weight and supplier bill. Add diesel or driver pay, then count healthy birds when the truck arrives.
                </p>
                <p>
                  <strong className="text-[#14161A] dark:text-white">2. Oldest Birds Sold First:</strong>{' '}
                  Every sale at your shop or to other shops automatically takes birds from your oldest chicken lot first so your profit is always right.
                </p>
                <p>
                  <strong className="text-[#14161A] dark:text-white">3. Dealer Accounts:</strong>{' '}
                  Money you give to suppliers lowers what you owe them without counting twice as shop bills.
                </p>
              </div>
              <div className="pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex justify-end">
                <button
                  type="button"
                  onClick={() => setHelpModalOpen(false)}
                  className="px-5 py-2 rounded-full bg-[#D4F56B] text-[#14161A] font-bold text-xs uppercase cursor-pointer"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

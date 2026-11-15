import { useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { FloatingIslandShell, NavItemKey } from './components/shell/FloatingIslandShell.tsx';
import { ToastContainer } from './components/common/Toast.tsx';
import { OfflineIndicator } from './components/common/OfflineIndicator.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { TrucksStockPage, TrucksStockSubTab } from './pages/TrucksStockPage.tsx';
import { SalesPage, SalesSubTab } from './pages/SalesPage.tsx';
import { DealersPage } from './pages/DealersPage.tsx';
import { ExpensesStaffPage } from './pages/ExpensesStaffPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { useAppStore } from './store/useAppStore.ts';
import { api, setUnauthorizedHandler } from './services/api.ts';
import { AuthUser } from './types/index.ts';

interface AppShellContentProps {
  currentUser: AuthUser;
  onLogout: () => void;
}

function AppShellContent({ currentUser, onLogout }: AppShellContentProps) {
  const [currentTab, setCurrentTab] = useState<NavItemKey>('dashboard');
  const [trucksStockSubTab, setTrucksStockSubTab] = useState<TrucksStockSubTab>('trucks');
  const [salesSubTab, setSalesSubTab] = useState<SalesSubTab>('walk-in');
  const [initialOpenNewLoad, setInitialOpenNewLoad] = useState(false);

  const bootstrap = useAppStore((s) => s.bootstrap);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const invalidateDataCache = useAppStore((s) => s.invalidateDataCache);
  const batches = useAppStore((s) => s.batches);
  const purchases = useAppStore((s) => s.purchases);
  const settings = useAppStore((s) => s.settings);
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);
  const addToast = useAppStore((s) => s.addToast);
  const globalError = useAppStore((s) => s.globalError);
  const clearGlobalError = useAppStore((s) => s.clearGlobalError);

  useEffect(() => {
    setWorkspace(currentUser.workspace || 'real');
    void bootstrap({ force: true });
  }, [bootstrap, setWorkspace, currentUser.workspace]);

  const availableStock = useMemo(
    () =>
      batches
        .filter((b) => !b.isClosed)
        .reduce((sum, b) => sum + Number(b.remainingPieces || 0), 0),
    [batches]
  );

  const pendingLoadsCount = useMemo(
    () => purchases.filter((p) => p.status !== 'RECEIVED').length,
    [purchases]
  );

  const handleNavigate = (tab: NavItemKey, subTab?: string) => {
    setInitialOpenNewLoad(false);
    if (tab === 'trucks-stock' && subTab) {
      setTrucksStockSubTab(subTab as TrucksStockSubTab);
    }
    if (tab === 'sales' && subTab) {
      setSalesSubTab(subTab as SalesSubTab);
    }
    setCurrentTab(tab);
  };

  const handleQuickAction = (action: 'new-sale' | 'new-load' | 'calculator') => {
    if (action === 'new-sale') {
      setSalesSubTab('walk-in');
      setCurrentTab('sales');
    } else if (action === 'new-load') {
      setTrucksStockSubTab('trucks');
      setInitialOpenNewLoad(true);
      setCurrentTab('trucks-stock');
    } else if (action === 'calculator') {
      setTrucksStockSubTab('calculator');
      setCurrentTab('trucks-stock');
    }
  };

  return (
    <FloatingIslandShell
      currentTab={currentTab}
      onSelectTab={(tab) => {
        setCurrentTab(tab);
        setInitialOpenNewLoad(false);
      }}
      availableStock={availableStock}
      pendingLoadsCount={pendingLoadsCount}
      businessName={settings.businessName}
      globalError={globalError}
      onDismissError={clearGlobalError}
      onRetrySync={() => {
        invalidateDataCache();
        void bootstrap({ force: true });
      }}
      onQuickAction={handleQuickAction}
      currentUser={currentUser}
      onLogout={onLogout}
    >
      {currentTab === 'dashboard' && (
        <DashboardPage
          onNavigate={handleNavigate}
          onOpenQuickSale={() => {
            setSalesSubTab('walk-in');
            setCurrentTab('sales');
          }}
          onOpenNewLoad={() => {
            setTrucksStockSubTab('trucks');
            setInitialOpenNewLoad(true);
            setCurrentTab('trucks-stock');
          }}
        />
      )}

      {currentTab === 'trucks-stock' && (
        <TrucksStockPage
          onShowToast={addToast}
          initialSubTab={trucksStockSubTab}
          initialOpenNewModal={initialOpenNewLoad}
        />
      )}

      {currentTab === 'sales' && (
        <SalesPage onShowToast={addToast} initialSubTab={salesSubTab} />
      )}

      {currentTab === 'dealers' && <DealersPage onShowToast={addToast} />}

      {currentTab === 'expenses-staff' && <ExpensesStaffPage onShowToast={addToast} />}

      {currentTab === 'reports' && <ReportsPage onShowToast={addToast} />}

      {currentTab === 'settings' && <SettingsPage currentUser={currentUser} />}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <OfflineIndicator />
    </FloatingIslandShell>
  );
}

function AuthenticatedApp() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'unauthenticated' | 'authenticated'>(
    'checking'
  );
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const resetStore = useAppStore((s) => s.resetStore);
  const setWorkspace = useAppStore((s) => s.setWorkspace);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      resetStore();
      setCurrentUser(null);
      setAuthStatus('unauthenticated');
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [resetStore]);

  useEffect(() => {
    let active = true;
    api.auth
      .me()
      .then((res) => {
        if (!active) return;
        if (res.user) {
          setWorkspace(res.user.workspace || 'real');
          setCurrentUser(res.user);
          setAuthStatus('authenticated');
        } else {
          setCurrentUser(null);
          setAuthStatus('unauthenticated');
        }
      })
      .catch(() => {
        if (!active) return;
        setCurrentUser(null);
        setAuthStatus('unauthenticated');
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      resetStore();
      setCurrentUser(null);
      setAuthStatus('unauthenticated');
    }
  }, [resetStore]);

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#F2F4F4] dark:bg-[#0F1113] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-[16px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] p-1.5 shadow-xs flex items-center justify-center">
            <img
              src="/assets/aistudio/check-in_ceb7ef49.webp"
              alt="Check-In Poultry"
              className="w-full h-full rounded-[10px] object-cover animate-pulse"
            />
          </div>
          <span className="text-xs font-medium text-[#636B76] dark:text-[#8A929C]">
            Verifying session...
          </span>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated' || !currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setWorkspace(user.workspace || 'real');
          setCurrentUser(user);
          setAuthStatus('authenticated');
        }}
      />
    );
  }

  return <AppShellContent currentUser={currentUser} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthenticatedApp />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

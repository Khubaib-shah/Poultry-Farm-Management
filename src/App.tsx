import React, { useState, useEffect, useMemo } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { FloatingIslandShell, NavItemKey } from './components/shell/FloatingIslandShell.tsx';
import { ToastContainer } from './components/common/Toast.tsx';
import { OfflineIndicator } from './components/common/OfflineIndicator.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { PurchasesPage } from './pages/PurchasesPage.tsx';
import { SuppliersPage } from './pages/SuppliersPage.tsx';
import { InventoryPage } from './pages/InventoryPage.tsx';
import { WholesalePage } from './pages/WholesalePage.tsx';
import { OwnShopSalesPage } from './pages/OwnShopSalesPage.tsx';
import { DealerLedgerPage } from './pages/DealerLedgerPage.tsx';
import { WorkersPage } from './pages/WorkersPage.tsx';
import { ExpensesPage } from './pages/ExpensesPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { useAppStore } from './store/useAppStore.ts';

function AppShellContent() {
  const [currentTab, setCurrentTab] = useState<NavItemKey>('dashboard');
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<number | undefined>(
    undefined
  );
  const [initialOpenNewLoad, setInitialOpenNewLoad] = useState(false);

  const bootstrap = useAppStore((s) => s.bootstrap);
  const batches = useAppStore((s) => s.batches);
  const purchases = useAppStore((s) => s.purchases);
  const settings = useAppStore((s) => s.settings);
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);
  const addToast = useAppStore((s) => s.addToast);
  const globalError = useAppStore((s) => s.globalError);
  const clearGlobalError = useAppStore((s) => s.clearGlobalError);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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

  const handleQuickAction = (action: 'new-sale' | 'new-load' | 'calculator') => {
    if (action === 'new-sale') {
      setCurrentTab('own-shop-sales');
    } else if (action === 'new-load') {
      setInitialOpenNewLoad(true);
      setCurrentTab('purchases');
    } else if (action === 'calculator') {
      setCurrentTab('inventory');
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
      onRetrySync={() => void bootstrap({ force: true })}
      onQuickAction={handleQuickAction}
    >
      {currentTab === 'dashboard' && (
        <DashboardPage
          onNavigate={(tab) => setCurrentTab(tab)}
          onOpenQuickSale={() => setCurrentTab('own-shop-sales')}
          onOpenNewLoad={() => {
            setInitialOpenNewLoad(true);
            setCurrentTab('purchases');
          }}
        />
      )}

      {currentTab === 'purchases' && (
        <PurchasesPage onShowToast={addToast} initialOpenNewModal={initialOpenNewLoad} />
      )}

      {currentTab === 'suppliers' && (
        <SuppliersPage
          onShowToast={addToast}
          onOpenLedgerTab={(supId) => {
            setSelectedSupplierForLedger(supId);
            setCurrentTab('dealer-ledger');
          }}
        />
      )}

      {currentTab === 'inventory' && <InventoryPage onShowToast={addToast} />}

      {currentTab === 'shops' && <WholesalePage onShowToast={addToast} />}

      {currentTab === 'own-shop-sales' && <OwnShopSalesPage onShowToast={addToast} />}

      {currentTab === 'dealer-ledger' && (
        <DealerLedgerPage
          onShowToast={addToast}
          selectedSupplierId={selectedSupplierForLedger}
        />
      )}

      {currentTab === 'workers' && <WorkersPage onShowToast={addToast} />}

      {currentTab === 'expenses' && <ExpensesPage onShowToast={addToast} />}

      {currentTab === 'reports' && <ReportsPage onShowToast={addToast} />}

      {currentTab === 'settings' && <SettingsPage onShowToast={addToast} />}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <OfflineIndicator />
    </FloatingIslandShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AppShellContent />
      </ErrorBoundary>
    </ThemeProvider>
  );
}

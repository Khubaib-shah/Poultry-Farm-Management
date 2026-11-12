import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { FloatingIslandShell, NavItemKey } from './components/shell/FloatingIslandShell.tsx';
import { ToastContainer, ToastMessage } from './components/common/Toast.tsx';
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
import { api } from './services/api.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavItemKey>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [availableStock, setAvailableStock] = useState<number>(0);

  // Cross-page parameters
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<number | undefined>(undefined);
  const [initialOpenNewLoad, setInitialOpenNewLoad] = useState(false);

  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const refreshStockCount = async () => {
    try {
      const batches = await api.getBatches();
      const total = batches
        .filter((b) => !b.isClosed)
        .reduce((sum, b) => sum + b.remainingPieces, 0);
      setAvailableStock(total);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    refreshStockCount();
  }, [currentTab]);

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
    <ThemeProvider>
      <FloatingIslandShell
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setInitialOpenNewLoad(false);
        }}
        availableStock={availableStock}
        onQuickAction={handleQuickAction}
      >
        {/* Dynamic Page Views */}
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
          <PurchasesPage
            onShowToast={addToast}
            initialOpenNewModal={initialOpenNewLoad}
          />
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

        {currentTab === 'inventory' && (
          <InventoryPage onShowToast={addToast} />
        )}

        {currentTab === 'shops' && (
          <WholesalePage onShowToast={addToast} />
        )}

        {currentTab === 'own-shop-sales' && (
          <OwnShopSalesPage onShowToast={addToast} />
        )}

        {currentTab === 'dealer-ledger' && (
          <DealerLedgerPage
            onShowToast={addToast}
            selectedSupplierId={selectedSupplierForLedger}
          />
        )}

        {currentTab === 'workers' && (
          <WorkersPage onShowToast={addToast} />
        )}

        {currentTab === 'expenses' && (
          <ExpensesPage onShowToast={addToast} />
        )}

        {currentTab === 'reports' && (
          <ReportsPage onShowToast={addToast} />
        )}

        {currentTab === 'settings' && (
          <SettingsPage onShowToast={addToast} />
        )}

        {/* Floating Toast Notification Stack */}
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </FloatingIslandShell>
    </ThemeProvider>
  );
}

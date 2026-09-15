import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AppLayout, NavTab } from './components/layout/AppLayout';
import { LoginView } from './components/auth/LoginView';
import { DashboardView } from './components/dashboard/DashboardView';
import { SalesView } from './components/sales/SalesView';
import { CustomersView } from './components/customers/CustomersView';
import { MoneyView } from './components/money/MoneyView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { LoadingSpinner } from './components/common/LoadingSpinner';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  // Cross-view action triggers
  const [openAddSaleModal, setOpenAddSaleModal] = useState(false);
  const [openRecordPaymentModal, setOpenRecordPaymentModal] = useState(false);
  const [targetCustomerId, setTargetCustomerId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-black text-xl shadow-xl shadow-brand-950 mb-4 animate-pulse">
          CTC
        </div>
        <LoadingSpinner text="Connecting to Chelladurai Tradings Corporation..." size="md" />
      </div>
    );
  }

  // Unauthenticated gate: Must log in first
  if (!user) {
    return <LoginView />;
  }

  return (
    <AppLayout currentTab={currentTab} onTabChange={setCurrentTab}>
      {currentTab === 'dashboard' && (
        <DashboardView
          onNavigateToSales={() => setCurrentTab('sales')}
          onNavigateToMoney={() => setCurrentTab('money')}
          onOpenAddSale={() => {
            setOpenAddSaleModal(true);
            setCurrentTab('sales');
          }}
          onOpenRecordPayment={() => {
            setOpenRecordPaymentModal(true);
            setCurrentTab('money');
          }}
        />
      )}

      {currentTab === 'sales' && (
        <SalesView
          isAddModalOpenInitially={openAddSaleModal}
          onCloseInitialAddModal={() => setOpenAddSaleModal(false)}
          onCustomerSelect={(custId) => {
            setTargetCustomerId(custId);
            setCurrentTab('customers');
          }}
        />
      )}

      {currentTab === 'customers' && (
        <CustomersView
          initialCustomerId={targetCustomerId}
          onClearInitialCustomer={() => setTargetCustomerId(null)}
        />
      )}

      {currentTab === 'money' && (
        <MoneyView
          isRecordModalOpenInitially={openRecordPaymentModal}
          onCloseInitialRecordModal={() => setOpenRecordPaymentModal(false)}
        />
      )}

      {currentTab === 'reports' && <ReportsView />}

      {currentTab === 'settings' && <SettingsView />}
    </AppLayout>
  );
};

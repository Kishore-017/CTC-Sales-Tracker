import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Wallet,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab = 'dashboard' | 'sales' | 'customers' | 'money' | 'reports' | 'settings';

interface AppLayoutProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { user, profile, signOut } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; desc: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, desc: 'Financial Overview' },
    { id: 'sales', label: 'Sales', icon: <ShoppingCart className="w-5 h-5" />, desc: 'Invoices & Balances' },
    { id: 'customers', label: 'Customers', icon: <Users className="w-5 h-5" />, desc: 'Ledger & Balances' },
    { id: 'money', label: 'Money', icon: <Wallet className="w-5 h-5" />, desc: 'Collections & Dues' },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" />, desc: 'Analytics & Trends' },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-5 h-5" />, desc: 'Shop & Account' },
  ];

  const handleSelectTab = (tab: NavTab) => {
    onTabChange(tab);
    setMobileDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ────────────────── DESKTOP SIDEBAR ────────────────── */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex-shrink-0 select-none">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-brand-900/30">
            CTC
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white leading-tight truncate">Chelladurai Tradings</h1>
            <p className="text-[11px] font-medium text-slate-400 tracking-wide">Sales &amp; Money Tracker</p>
          </div>
        </div>

        {/* Business Badge */}
        <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Paint Shop • Live Store</span>
          </div>
        </div>

        {/* Main Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-950/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-white/80" />}
              </button>
            );
          })}
        </nav>

        {/* User Account / Sign Out Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {profile?.role || 'Admin'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5" title={user?.email || ''}>
                {user?.email || 'Logged in'}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/30 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ────────────────── MAIN CONTENT AREA ────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Mobile Brand Name */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
                CTC
              </div>
              <span className="font-bold text-slate-900 text-sm truncate">Chelladurai Tradings</span>
            </div>

            {/* Desktop Breadcrumb/Title */}
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-800 uppercase tracking-wider text-xs">
                Chelladurai Tradings Corporation
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-brand-700 capitalize">{currentTab}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>INR (₹) Sales Tracker</span>
            </div>
            <button
              onClick={() => signOut()}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* ────────────────── MOBILE DRAWER NAVIGATION ────────────────── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Slide-out Drawer */}
          <div className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-slate-900 shadow-2xl z-50 flex flex-col justify-between">
            <div>
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black text-sm">
                    CTC
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Chelladurai Tradings</h2>
                    <p className="text-[10px] text-slate-400">Sales &amp; Money Tracker</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation list */}
              <nav className="p-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-brand-600 text-white font-semibold shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60">
              <div className="mb-3 px-1">
                <p className="text-xs font-bold text-slate-300 truncate">{user?.email}</p>
                <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-wider">
                  Role: {profile?.role || 'Admin'}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/50 hover:bg-rose-900 border border-rose-800/40"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

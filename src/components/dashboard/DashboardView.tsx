import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowDownRight,
  AlertCircle,
  Calendar,
  Clock,
  PlusCircle,
  DollarSign,
  CreditCard,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { reportsService } from '../../services/reportsService';
import { KPISummary, DailyChartPoint } from '../../types/database';
import { formatINR, formatDate } from '../../lib/formatters';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface DashboardViewProps {
  onNavigateToSales: () => void;
  onNavigateToMoney: () => void;
  onOpenAddSale: () => void;
  onOpenRecordPayment: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToSales,
  onNavigateToMoney,
  onOpenAddSale,
  onOpenRecordPayment,
}) => {
  const [kpis, setKpis] = useState<KPISummary | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'7days' | '30days' | 'month'>('7days');
  const [chartData, setChartData] = useState<DailyChartPoint[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<
    Array<{
      id: string;
      type: 'sale' | 'payment';
      date: string;
      customerName: string;
      description: string;
      amount: number;
      statusOrMethod: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [kpiRes, chartRes, recentRes] = await Promise.all([
        reportsService.getDashboardKPIs(),
        reportsService.getDashboardChartData(chartPeriod),
        reportsService.getRecentTransactions(6),
      ]);
      setKpis(kpiRes);
      setChartData(chartRes);
      setRecentTransactions(recentRes);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [chartPeriod]);

  if (loading && !kpis) {
    return <LoadingSpinner text="Calculating financial overview..." size="lg" />;
  }

  // Calculate Paid vs Outstanding percentage
  const totalFinancialVolume = (kpis?.totalOutstanding || 0) + (kpis?.todayCollections || 0);
  const paidPercent =
    totalFinancialVolume > 0
      ? Math.round(((kpis?.todayCollections || 0) / totalFinancialVolume) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
            Shop Financial Overview
          </span>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Chelladurai Tradings Corporation
          </h2>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Updated live • All amounts in Indian Rupees (₹)</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            icon={<RefreshCw className="w-4 h-4" />}
            title="Refresh dashboard"
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenRecordPayment}
            icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
          >
            Record Payment
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenAddSale}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            + Add Sale
          </Button>
        </div>
      </div>

      {/* ────────────────── 4 MAIN KPI SECTION ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Today's Sales
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatINR(kpis?.todaySales || 0)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {kpis?.todaySalesCount || 0} {kpis?.todaySalesCount === 1 ? 'sale' : 'sales'}
              </span>
              <span>recorded today</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Today's Collection */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Today's Collection
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600 tracking-tight">
              {formatINR(kpis?.todayCollections || 0)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Cash, UPI &amp; Bank received today
            </div>
          </div>
        </div>

        {/* KPI 3: Outstanding Amount */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Outstanding Amount
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600 tracking-tight">
              {formatINR(kpis?.totalOutstanding || 0)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                {kpis?.pendingTransactionsCount || 0} pending
              </span>
              <span>credit accounts</span>
            </div>
          </div>
        </div>

        {/* KPI 4: This Month's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              This Month's Sales
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatINR(kpis?.monthSales || 0)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Current calendar month gross sales
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────── CHARTS & VISUALIZATION ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Collections Trend Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Sales &amp; Collections Trend</h3>
              <p className="text-xs text-slate-500">
                Comparison of billed sales vs collected money
              </p>
            </div>

            {/* Period Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
              <button
                onClick={() => setChartPeriod('7days')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  chartPeriod === '7days'
                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setChartPeriod('30days')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  chartPeriod === '30days'
                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setChartPeriod('month')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  chartPeriod === 'month'
                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                This Month
              </button>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="collectionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  formatter={(value: number) => [formatINR(value), '']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#salesGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="collections"
                  name="Collections"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#collectionsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-6 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-brand-600" />
              <span className="font-semibold">Billed Sales</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="font-semibold">Collections Received</span>
            </div>
          </div>
        </div>

        {/* Paid vs Outstanding Visualization */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Collections vs Due</h3>
            <p className="text-xs text-slate-500">Current financial balance breakdown</p>

            {/* Clean visual metric breakdown */}
            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-600">Collected Today</span>
                  <span className="font-bold text-emerald-600">
                    {formatINR(kpis?.todayCollections || 0)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, paidPercent)}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-amber-900">Total Customer Balance Due</span>
                  <span className="font-black text-amber-700">
                    {formatINR(kpis?.totalOutstanding || 0)}
                  </span>
                </div>
                <p className="text-[11px] text-amber-700/80">
                  Across all active credit accounts
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToMoney}
              className="w-full justify-between text-xs"
            >
              <span>Manage Outstanding Dues</span>
              <ArrowDownRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ────────────────── RECENT TRANSACTIONS ────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Transactions</h3>
            <p className="text-xs text-slate-500">Latest sales and payment collections</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onNavigateToSales} className="text-xs">
            View All Sales
          </Button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No transactions recorded yet. Click <strong>+ Add Sale</strong> to start tracking.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {recentTransactions.map((tx) => {
              const isSale = tx.type === 'sale';
              return (
                <div
                  key={tx.id}
                  className="py-3 flex items-center justify-between gap-3 text-sm hover:bg-slate-50/70 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSale ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {isSale ? <DollarSign className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate">
                          {tx.customerName}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 truncate">{tx.description}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatDate(tx.date)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div
                      className={`font-black ${
                        isSale ? 'text-slate-900' : 'text-emerald-600'
                      }`}
                    >
                      {isSale ? '+' : ''}
                      {formatINR(tx.amount)}
                    </div>
                    <div className="mt-0.5 text-xs">
                      {isSale ? (
                        <span
                          className={`font-semibold capitalize text-[11px] ${
                            tx.statusOrMethod === 'paid'
                              ? 'text-emerald-600'
                              : tx.statusOrMethod === 'partial'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {tx.statusOrMethod}
                        </span>
                      ) : (
                        <span className="text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                          {tx.statusOrMethod}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

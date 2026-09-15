import React, { useState, useEffect } from 'react';
import {
  Printer,
  TrendingUp,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { reportsService, ReportPeriod, ReportSummary } from '../../services/reportsService';
import { formatINR, getTodayDateString } from '../../lib/formatters';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const ReportsView: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(getTodayDateString());
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pieMode, setPieMode] = useState<'ratio' | 'status'>('ratio');

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await reportsService.getReportData(
        period,
        period === 'custom' ? customStart : undefined,
        period === 'custom' ? customEnd : undefined
      );
      setReport(data);
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [period]);

  const handleApplyCustomDate = () => {
    if (customStart && customEnd) {
      loadReport();
    }
  };

  // Pie chart data for Paid vs Outstanding & Breakdown
  const statusPieData = [
    { name: 'Paid Sales', value: report?.paidCount || 0, color: '#10b981' },
    { name: 'Partially Paid', value: report?.partialCount || 0, color: '#f59e0b' },
    { name: 'Credit (Unpaid)', value: report?.creditCount || 0, color: '#ef4444' },
  ].filter((item) => item.value > 0);

  const financialRatioData = [
    { name: 'Collections Received', value: report?.totalCollections || 0, color: '#10b981' },
    { name: 'Balance Outstanding', value: report?.totalOutstanding || 0, color: '#f59e0b' },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Header & Period Selectors */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
            Financial Statements
          </span>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Business Performance Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated revenue, payment collections, and credit risk analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === 'today'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === 'week'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === 'month'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === 'custom'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Range
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            icon={<Printer className="w-4 h-4" />}
            className="no-print"
          >
            Print
          </Button>
        </div>
      </div>

      {/* Custom Date Range Picker bar */}
      {period === 'custom' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-600">From:</span>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-600">To:</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs"
            />
          </div>
          <Button variant="primary" size="sm" onClick={handleApplyCustomDate}>
            Generate Report
          </Button>
        </div>
      )}

      {loading && !report ? (
        <LoadingSpinner text="Compiling financial report..." />
      ) : (
        <>
          {/* ────────────────── 3 PRIMARY FINANCIAL METRICS ────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Sales */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Sales in Period
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {formatINR(report?.totalSales || 0)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Across {report?.totalSalesCount || 0} total sales invoices
                </div>
              </div>
            </div>

            {/* Total Collection */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Collection in Period
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-emerald-600 tracking-tight">
                  {formatINR(report?.totalCollections || 0)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Total receipts received in selected window
                </div>
              </div>
            </div>

            {/* Total Outstanding */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Period Outstanding
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-amber-600 tracking-tight">
                  {formatINR(report?.totalOutstanding || 0)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Remaining unpaid balance on period invoices
                </div>
              </div>
            </div>
          </div>

          {/* ────────────────── TRANSACTION BREAKDOWN STRIP ────────────────── */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Sales Invoices by Payment Status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="block text-xs text-slate-500">Total Invoices</span>
                <span className="font-black text-slate-900 text-lg mt-0.5 block">
                  {report?.totalSalesCount || 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="block text-xs text-emerald-700">Fully Paid</span>
                <span className="font-black text-emerald-600 text-lg mt-0.5 block">
                  {report?.paidCount || 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="block text-xs text-amber-700">Partially Paid</span>
                <span className="font-black text-amber-600 text-lg mt-0.5 block">
                  {report?.partialCount || 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <span className="block text-xs text-rose-700">Credit (Unpaid)</span>
                <span className="font-black text-rose-600 text-lg mt-0.5 block">
                  {report?.creditCount || 0}
                </span>
              </div>
            </div>
          </div>

          {/* ────────────────── CHARTS: SALES & COLLECTIONS OVER TIME ────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline Trend */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">
                  Sales &amp; Collections Timeline
                </h3>
                <p className="text-xs text-slate-500">
                  Daily comparison of billing vs actual money collected
                </p>
              </div>

              <div className="h-72 w-full">
                {report && report.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
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
                        tickFormatter={(val) =>
                          `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`
                        }
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
                      <Bar dataKey="sales" name="Sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar
                        dataKey="collections"
                        name="Collections"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No data points for this timeframe
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-6 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-600" />
                  <span className="font-semibold">Billed Sales (₹)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="font-semibold">Collected Cash/UPI (₹)</span>
                </div>
              </div>
            </div>

            {/* Paid vs Outstanding Visualization */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {pieMode === 'ratio' ? 'Collections Ratio' : 'Invoice Status Split'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {pieMode === 'ratio' ? 'Collected cash vs remaining credit' : 'Proportion of paid vs pending sales'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      onClick={() => setPieMode('ratio')}
                      className={`px-2 py-0.5 rounded ${
                        pieMode === 'ratio' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      ₹ Ratio
                    </button>
                    <button
                      onClick={() => setPieMode('status')}
                      className={`px-2 py-0.5 rounded ${
                        pieMode === 'status' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      Status
                    </button>
                  </div>
                </div>

                <div className="h-56 w-full mt-4">
                  {(pieMode === 'ratio' ? financialRatioData : statusPieData).length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieMode === 'ratio' ? financialRatioData : statusPieData}
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {(pieMode === 'ratio' ? financialRatioData : statusPieData).map(
                            (entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            )
                          )}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) => [
                            pieMode === 'ratio' ? formatINR(val) : `${val} invoices`,
                            '',
                          ]}
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#1e293b',
                            borderRadius: '0.75rem',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No financial activity recorded
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                {pieMode === 'ratio' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="font-medium text-slate-700">Collected:</span>
                      </span>
                      <span className="font-bold text-emerald-600">
                        {formatINR(report?.totalCollections || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="font-medium text-slate-700">Outstanding:</span>
                      </span>
                      <span className="font-bold text-amber-600">
                        {formatINR(report?.totalOutstanding || 0)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="font-medium text-slate-700">Paid:</span>
                      </span>
                      <span className="font-bold text-emerald-600">{report?.paidCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="font-medium text-slate-700">Partial:</span>
                      </span>
                      <span className="font-bold text-amber-600">{report?.partialCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="font-medium text-slate-700">Credit:</span>
                      </span>
                      <span className="font-bold text-rose-600">{report?.creditCount || 0}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

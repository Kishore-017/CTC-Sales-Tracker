import { supabase } from '../lib/supabase';
import { KPISummary, DailyChartPoint, Sale, Payment } from '../types/database';

export interface ReportSummary {
  totalSales: number;
  totalCollections: number;
  totalOutstanding: number;
  totalSalesCount: number;
  paidCount: number;
  partialCount: number;
  creditCount: number;
  chartData: DailyChartPoint[];
}

export type ReportPeriod = 'today' | 'week' | 'month' | 'custom';

export const reportsService = {
  /**
   * Fetch KPI metrics for Dashboard from ctc_tracker_sales and ctc_tracker_payments
   */
  async getDashboardKPIs(): Promise<KPISummary> {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const firstDayOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // 1. All Sales from ctc_tracker_sales
    const { data: allSales, error: salesErr } = await supabase
      .from('ctc_tracker_sales')
      .select('id, total_amount, amount_paid, payment_status, sale_date');
    if (salesErr) throw salesErr;

    // 2. All Payments from ctc_tracker_payments
    const { data: allPayments, error: payErr } = await supabase
      .from('ctc_tracker_payments')
      .select('amount, payment_date');
    if (payErr) throw payErr;

    const salesList = (allSales as Array<{
      id: string;
      total_amount: number;
      amount_paid: number;
      payment_status: string;
      sale_date: string;
    }>) || [];

    const paymentsList = (allPayments as Array<{ amount: number; payment_date: string }>) || [];

    let todaySales = 0;
    let todaySalesCount = 0;
    let monthSales = 0;
    let totalSalesSum = 0;
    let totalPaidSum = 0;
    let pendingTransactionsCount = 0;

    salesList.forEach((s) => {
      const tot = Number(s.total_amount) || 0;
      const pd = Number(s.amount_paid) || 0;

      totalSalesSum += tot;
      totalPaidSum += pd;

      if (s.sale_date === todayStr) {
        todaySales += tot;
        todaySalesCount += 1;
      }

      if (s.sale_date >= firstDayOfMonthStr) {
        monthSales += tot;
      }

      if (s.payment_status === 'partial' || s.payment_status === 'credit') {
        pendingTransactionsCount += 1;
      }
    });

    let todayCollections = 0;
    paymentsList.forEach((p) => {
      if (p.payment_date === todayStr) {
        todayCollections += Number(p.amount) || 0;
      }
    });

    const totalOutstanding = Math.max(0, Math.round((totalSalesSum - totalPaidSum) * 100) / 100);

    return {
      todaySales,
      todayCollections,
      totalOutstanding,
      monthSales,
      todaySalesCount,
      pendingTransactionsCount,
    };
  },

  /**
   * Fetch daily trend chart data for Dashboard from ctc_tracker_* tables
   */
  async getDashboardChartData(period: '7days' | '30days' | 'month'): Promise<DailyChartPoint[]> {
    const today = new Date();
    let startDate: Date;

    if (period === '7days') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
    } else if (period === '30days') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 29);
    } else {
      // Month
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // Fetch sales and payments in this range
    const { data: sales } = await supabase
      .from('ctc_tracker_sales')
      .select('total_amount, sale_date')
      .gte('sale_date', startStr)
      .lte('sale_date', todayStr);

    const { data: payments } = await supabase
      .from('ctc_tracker_payments')
      .select('amount, payment_date')
      .gte('payment_date', startStr)
      .lte('payment_date', todayStr);

    // Build day map
    const map: Record<string, { sales: number; collections: number }> = {};
    const curr = new Date(startDate);

    while (curr <= today) {
      const dStr = curr.toISOString().split('T')[0];
      map[dStr] = { sales: 0, collections: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    (sales || []).forEach((s: { total_amount: number; sale_date: string }) => {
      if (map[s.sale_date]) {
        map[s.sale_date].sales += Number(s.total_amount) || 0;
      }
    });

    (payments || []).forEach((p: { amount: number; payment_date: string }) => {
      if (map[p.payment_date]) {
        map[p.payment_date].collections += Number(p.amount) || 0;
      }
    });

    return Object.keys(map).map((dateKey) => {
      const d = new Date(dateKey);
      const displayDate = new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
      }).format(d);

      return {
        date: dateKey,
        displayDate,
        sales: Math.round(map[dateKey].sales * 100) / 100,
        collections: Math.round(map[dateKey].collections * 100) / 100,
      };
    });
  },

  /**
   * Fetch recent transactions from ctc_tracker_sales and ctc_tracker_payments
   */
  async getRecentTransactions(limit = 6): Promise<Array<{
    id: string;
    type: 'sale' | 'payment';
    date: string;
    customerName: string;
    description: string;
    amount: number;
    statusOrMethod: string;
  }>> {
    const { data: recentSales } = await supabase
      .from('ctc_tracker_sales')
      .select('id, sale_date, description, total_amount, payment_status, created_at, customer:ctc_tracker_customers(name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: recentPayments } = await supabase
      .from('ctc_tracker_payments')
      .select('id, payment_date, amount, payment_method, notes, created_at, customer:ctc_tracker_customers(name), sale:ctc_tracker_sales(description)')
      .order('created_at', { ascending: false })
      .limit(limit);

    type SaleRow = {
      id: string;
      sale_date: string;
      description: string;
      total_amount: number;
      payment_status: string;
      created_at: string;
      customer: { name: string } | null;
    };

    type PaymentRow = {
      id: string;
      payment_date: string;
      amount: number;
      payment_method: string;
      notes: string | null;
      created_at: string;
      customer: { name: string } | null;
      sale: { description: string } | null;
    };

    const combined: Array<{
      id: string;
      type: 'sale' | 'payment';
      date: string;
      customerName: string;
      description: string;
      amount: number;
      statusOrMethod: string;
      createdAt: string;
    }> = [];

    (recentSales as unknown as SaleRow[] || []).forEach((s) => {
      combined.push({
        id: `sale-${s.id}`,
        type: 'sale',
        date: s.sale_date,
        customerName: s.customer?.name || 'Walk-in',
        description: s.description,
        amount: Number(s.total_amount),
        statusOrMethod: s.payment_status,
        createdAt: s.created_at,
      });
    });

    (recentPayments as unknown as PaymentRow[] || []).forEach((p) => {
      combined.push({
        id: `pay-${p.id}`,
        type: 'payment',
        date: p.payment_date,
        customerName: p.customer?.name || 'Customer',
        description: p.sale ? `Payment for ${p.sale.description}` : 'Collection',
        amount: Number(p.amount),
        statusOrMethod: p.payment_method,
        createdAt: p.created_at,
      });
    });

    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined.slice(0, limit);
  },

  /**
   * Fetch comprehensive report data for Reports page from ctc_tracker_* tables
   */
  async getReportData(
    period: ReportPeriod,
    customStart?: string,
    customEnd?: string
  ): Promise<ReportSummary> {
    const today = new Date();
    let startDate: string;
    let endDate: string = today.toISOString().split('T')[0];

    if (period === 'today') {
      startDate = endDate;
    } else if (period === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      d.setDate(diff);
      startDate = d.toISOString().split('T')[0];
    } else if (period === 'month') {
      startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      startDate = customStart || `${today.getFullYear()}-01-01`;
      endDate = customEnd || endDate;
    }

    // Query sales in period from ctc_tracker_sales
    const { data: salesData, error: sErr } = await supabase
      .from('ctc_tracker_sales')
      .select('*')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    if (sErr) throw sErr;
    const sales = (salesData as Sale[]) || [];

    // Query payments in period from ctc_tracker_payments
    const { data: paymentsData, error: pErr } = await supabase
      .from('ctc_tracker_payments')
      .select('*')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    if (pErr) throw pErr;
    const payments = (paymentsData as Payment[]) || [];

    let totalSales = 0;
    let paidCount = 0;
    let partialCount = 0;
    let creditCount = 0;

    sales.forEach((s) => {
      totalSales += Number(s.total_amount) || 0;
      if (s.payment_status === 'paid') paidCount++;
      else if (s.payment_status === 'partial') partialCount++;
      else if (s.payment_status === 'credit') creditCount++;
    });

    let totalCollections = 0;
    payments.forEach((p) => {
      totalCollections += Number(p.amount) || 0;
    });

    const totalOutstanding = Math.max(0, Math.round((totalSales - totalCollections) * 100) / 100);

    // Build day map for chart
    const map: Record<string, { sales: number; collections: number }> = {};
    const dStart = new Date(startDate);
    const dEnd = new Date(endDate);
    const curr = new Date(dStart);

    while (curr <= dEnd) {
      const dStr = curr.toISOString().split('T')[0];
      map[dStr] = { sales: 0, collections: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    sales.forEach((s) => {
      if (map[s.sale_date]) {
        map[s.sale_date].sales += Number(s.total_amount) || 0;
      }
    });

    payments.forEach((p) => {
      if (map[p.payment_date]) {
        map[p.payment_date].collections += Number(p.amount) || 0;
      }
    });

    const chartData: DailyChartPoint[] = Object.keys(map).map((dateKey) => {
      const d = new Date(dateKey);
      const displayDate = new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
      }).format(d);
      return {
        date: dateKey,
        displayDate,
        sales: Math.round(map[dateKey].sales * 100) / 100,
        collections: Math.round(map[dateKey].collections * 100) / 100,
      };
    });

    return {
      totalSales: Math.round(totalSales * 100) / 100,
      totalCollections: Math.round(totalCollections * 100) / 100,
      totalOutstanding,
      totalSalesCount: sales.length,
      paidCount,
      partialCount,
      creditCount,
      chartData,
    };
  },
};

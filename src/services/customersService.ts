import { supabase } from '../lib/supabase';
import { Customer, CustomerWithBalances, Sale, Payment } from '../types/database';

export interface LedgerItem {
  id: string;
  type: 'sale' | 'payment';
  date: string;
  description: string;
  totalAmount?: number;
  amountPaid?: number;
  paymentAmount?: number;
  balance?: number;
  paymentMethod?: string | null;
  notes?: string | null;
  saleId?: string;
}

export const customersService = {
  /**
   * Fetch all customers from ctc_tracker_customers
   */
  async getCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('ctc_tracker_customers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
    return (data as Customer[]) || [];
  },

  /**
   * Fetch customers with aggregated total sales, paid amount, and outstanding balances
   */
  async getCustomersWithBalances(): Promise<CustomerWithBalances[]> {
    // 1. Fetch all tracker customers
    const { data: customersData, error: custError } = await supabase
      .from('ctc_tracker_customers')
      .select('*')
      .order('name', { ascending: true });

    if (custError) throw custError;
    const customers = (customersData as Customer[]) || [];

    // 2. Fetch all sales from ctc_tracker_sales
    const { data: salesData, error: salesError } = await supabase
      .from('ctc_tracker_sales')
      .select('id, customer_id, total_amount, amount_paid, sale_date');

    if (salesError) throw salesError;
    const sales = (salesData as Array<{
      id: string;
      customer_id: string;
      total_amount: number;
      amount_paid: number;
      sale_date: string;
    }>) || [];

    // 3. Fetch latest payment dates from ctc_tracker_payments
    const { data: paymentsData } = await supabase
      .from('ctc_tracker_payments')
      .select('customer_id, payment_date');
    const payments = (paymentsData as Array<{ customer_id: string; payment_date: string }>) || [];

    // Aggregate by customer
    const aggregated: Record<
      string,
      { total_sales: number; total_paid: number; last_date: string | null; count: number }
    > = {};

    customers.forEach((c) => {
      aggregated[c.id] = { total_sales: 0, total_paid: 0, last_date: null, count: 0 };
    });

    sales.forEach((s) => {
      if (!aggregated[s.customer_id]) {
        aggregated[s.customer_id] = { total_sales: 0, total_paid: 0, last_date: null, count: 0 };
      }
      aggregated[s.customer_id].total_sales += Number(s.total_amount) || 0;
      aggregated[s.customer_id].total_paid += Number(s.amount_paid) || 0;
      aggregated[s.customer_id].count += 1;

      if (
        !aggregated[s.customer_id].last_date ||
        new Date(s.sale_date) > new Date(aggregated[s.customer_id].last_date!)
      ) {
        aggregated[s.customer_id].last_date = s.sale_date;
      }
    });

    payments.forEach((p) => {
      if (aggregated[p.customer_id]) {
        if (
          !aggregated[p.customer_id].last_date ||
          new Date(p.payment_date) > new Date(aggregated[p.customer_id].last_date!)
        ) {
          aggregated[p.customer_id].last_date = p.payment_date;
        }
      }
    });

    return customers.map((c) => {
      const agg = aggregated[c.id] || { total_sales: 0, total_paid: 0, last_date: null, count: 0 };
      const outstanding = Math.max(0, Math.round((agg.total_sales - agg.total_paid) * 100) / 100);

      return {
        ...c,
        total_sales: agg.total_sales,
        total_paid: agg.total_paid,
        outstanding_balance: outstanding,
        last_transaction_date: agg.last_date,
        sales_count: agg.count,
      };
    });
  },

  /**
   * Check if a customer with the same name already exists in ctc_tracker_customers
   */
  async checkDuplicateName(name: string, excludeId?: string): Promise<boolean> {
    const trimmed = name.trim().toLowerCase();
    let query = supabase.from('ctc_tracker_customers').select('id, name');

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) return false;

    return (data || []).some(
      (c: { name: string }) => c.name.trim().toLowerCase() === trimmed
    );
  },

  /**
   * Create a new customer in ctc_tracker_customers
   */
  async createCustomer(customer: {
    name: string;
    phone?: string | null;
    notes?: string | null;
  }): Promise<Customer> {
    const isDup = await this.checkDuplicateName(customer.name);
    if (isDup) {
      throw new Error(`A customer named "${customer.name.trim()}" already exists.`);
    }

    const { data, error } = await supabase
      .from('ctc_tracker_customers')
      .insert([
        {
          name: customer.name.trim(),
          phone: customer.phone ? customer.phone.trim() : null,
          notes: customer.notes ? customer.notes.trim() : null,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as Customer;
  },

  /**
   * Update an existing customer in ctc_tracker_customers
   */
  async updateCustomer(
    id: string,
    customer: { name: string; phone?: string | null; notes?: string | null }
  ): Promise<Customer> {
    const isDup = await this.checkDuplicateName(customer.name, id);
    if (isDup) {
      throw new Error(`Another customer named "${customer.name.trim()}" already exists.`);
    }

    const { data, error } = await supabase
      .from('ctc_tracker_customers')
      .update({
        name: customer.name.trim(),
        phone: customer.phone ? customer.phone.trim() : null,
        notes: customer.notes ? customer.notes.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Customer;
  },

  /**
   * Fetch complete ledger (Sales + Payments) for a specific customer
   */
  async getCustomerLedger(customerId: string): Promise<{
    customer: Customer;
    summary: { totalSales: number; totalPaid: number; outstanding: number };
    ledger: LedgerItem[];
    sales: Sale[];
    payments: Payment[];
  }> {
    // Fetch customer details
    const { data: customer, error: custError } = await supabase
      .from('ctc_tracker_customers')
      .select('*')
      .eq('id', customerId)
      .single();
    if (custError) throw custError;

    // Fetch customer sales
    const { data: salesData, error: salesError } = await supabase
      .from('ctc_tracker_sales')
      .select('*')
      .eq('customer_id', customerId)
      .order('sale_date', { ascending: false });
    if (salesError) throw salesError;
    const sales = (salesData as Sale[]) || [];

    // Fetch customer payments with linked sale
    const { data: paymentsData, error: payError } = await supabase
      .from('ctc_tracker_payments')
      .select('*, sale:ctc_tracker_sales(id, description, total_amount, amount_paid, payment_status, sale_date)')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false });
    if (payError) throw payError;
    const payments = (paymentsData as Payment[]) || [];

    // Calculate totals
    const totalSales = sales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
    const totalPaid = sales.reduce((acc, s) => acc + (Number(s.amount_paid) || 0), 0);
    const outstanding = Math.max(0, Math.round((totalSales - totalPaid) * 100) / 100);

    // Build chronological ledger
    const ledgerItems: LedgerItem[] = [];

    sales.forEach((s) => {
      ledgerItems.push({
        id: `sale-${s.id}`,
        type: 'sale',
        date: s.sale_date,
        description: s.description,
        totalAmount: Number(s.total_amount),
        amountPaid: Number(s.amount_paid),
        balance: Math.max(0, Number(s.total_amount) - Number(s.amount_paid)),
        paymentMethod: s.payment_method,
        notes: s.notes,
        saleId: s.id,
      });
    });

    payments.forEach((p) => {
      ledgerItems.push({
        id: `pay-${p.id}`,
        type: 'payment',
        date: p.payment_date,
        description: p.sale ? `Payment for ${p.sale.description}` : 'Payment received',
        paymentAmount: Number(p.amount),
        paymentMethod: p.payment_method,
        notes: p.notes,
        saleId: p.sale_id,
      });
    });

    // Sort ledger descending by date
    ledgerItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      customer: customer as Customer,
      summary: { totalSales, totalPaid, outstanding },
      ledger: ledgerItems,
      sales,
      payments,
    };
  },
};

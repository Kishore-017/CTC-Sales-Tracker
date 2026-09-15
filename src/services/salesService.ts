import { supabase } from '../lib/supabase';
import { Sale, SaleFormData, PaymentStatus } from '../types/database';
import { derivePaymentStatus } from '../lib/formatters';

export interface SalesFilterOptions {
  search?: string;
  status?: PaymentStatus | 'all';
  startDate?: string;
  endDate?: string;
  customerId?: string;
}

export const salesService = {
  /**
   * Fetch sales from ctc_tracker_sales with customer relation
   */
  async getSales(filters?: SalesFilterOptions): Promise<Sale[]> {
    let query = supabase
      .from('ctc_tracker_sales')
      .select('*, customer:ctc_tracker_customers(id, name, phone)')
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('payment_status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('sale_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('sale_date', filters.endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error querying sales:', error);
      throw error;
    }

    let results = (data as Sale[]) || [];

    // Client-side search for description or customer name
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      results = results.filter(
        (s) =>
          s.description.toLowerCase().includes(term) ||
          (s.customer?.name && s.customer.name.toLowerCase().includes(term)) ||
          (s.customer?.phone && s.customer.phone.includes(term)) ||
          (s.notes && s.notes.toLowerCase().includes(term))
      );
    }

    return results;
  },

  /**
   * Fetch single sale with all linked payments from ctc_tracker_payments
   */
  async getSaleById(saleId: string): Promise<Sale | null> {
    const { data, error } = await supabase
      .from('ctc_tracker_sales')
      .select('*, customer:ctc_tracker_customers(id, name, phone), payments:ctc_tracker_payments(*)')
      .eq('id', saleId)
      .single();

    if (error) {
      console.error('Error fetching sale by id:', error);
      return null;
    }

    return data as Sale;
  },

  /**
   * Create a new sale in ctc_tracker_sales and record initial payment if amount_paid > 0
   */
  async createSale(formData: SaleFormData, userId?: string): Promise<Sale> {
    const total = Number(formData.total_amount);
    const paid = Number(formData.amount_paid) || 0;

    // Strict validation
    if (!formData.customer_id) {
      throw new Error('Please select a customer.');
    }
    if (!formData.description.trim()) {
      throw new Error('Please enter a description for this sale.');
    }
    if (isNaN(total) || total <= 0) {
      throw new Error('Total amount must be greater than 0.');
    }
    if (paid < 0) {
      throw new Error('Amount paid cannot be negative.');
    }
    if (paid > total) {
      throw new Error('Amount paid cannot exceed total sale amount.');
    }
    if (!formData.sale_date) {
      throw new Error('Sale date is required.');
    }

    const calculatedStatus = derivePaymentStatus(total, paid);

    // 1. Insert the sale into ctc_tracker_sales
    const { data: saleData, error: saleError } = await supabase
      .from('ctc_tracker_sales')
      .insert([
        {
          customer_id: formData.customer_id,
          sale_date: formData.sale_date,
          description: formData.description.trim(),
          total_amount: total,
          amount_paid: paid,
          payment_status: calculatedStatus,
          payment_method: paid > 0 ? formData.payment_method : null,
          notes: formData.notes ? formData.notes.trim() : null,
          created_by: userId || null,
        },
      ])
      .select('*, customer:ctc_tracker_customers(id, name, phone)')
      .single();

    if (saleError) throw saleError;
    const newSale = saleData as Sale;

    // 2. If initial payment was made, record in ctc_tracker_payments table
    if (paid > 0) {
      const { error: payError } = await supabase.from('ctc_tracker_payments').insert([
        {
          sale_id: newSale.id,
          customer_id: formData.customer_id,
          payment_date: formData.sale_date,
          amount: paid,
          payment_method: formData.payment_method || 'cash',
          notes: formData.notes ? `Initial payment: ${formData.notes.trim()}` : 'Initial sale payment',
          created_by: userId || null,
        },
      ]);

      if (payError) {
        console.error('Warning: Failed to insert initial payment log:', payError);
      }
    }

    return newSale;
  },

  /**
   * Update sale details in ctc_tracker_sales
   */
  async updateSale(
    saleId: string,
    updates: {
      description?: string;
      sale_date?: string;
      notes?: string | null;
      total_amount?: number;
    }
  ): Promise<Sale> {
    if (updates.total_amount !== undefined) {
      const current = await this.getSaleById(saleId);
      if (current && updates.total_amount < Number(current.amount_paid)) {
        throw new Error(
          `Total amount cannot be less than already collected payments (₹${current.amount_paid}).`
        );
      }
    }

    const { data, error } = await supabase
      .from('ctc_tracker_sales')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', saleId)
      .select('*, customer:ctc_tracker_customers(id, name, phone)')
      .single();

    if (error) throw error;
    return data as Sale;
  },

  /**
   * Delete a sale and its cascaded payments from ctc_tracker_sales
   */
  async deleteSale(saleId: string): Promise<void> {
    const { error } = await supabase.from('ctc_tracker_sales').delete().eq('id', saleId);
    if (error) throw error;
  },
};

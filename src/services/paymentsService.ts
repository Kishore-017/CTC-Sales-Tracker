import { supabase } from '../lib/supabase';
import { Payment, PaymentFormData, Sale } from '../types/database';
import { derivePaymentStatus } from '../lib/formatters';

export interface PaymentFilterOptions {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  saleId?: string;
}

export const paymentsService = {
  /**
   * Fetch payment records from ctc_tracker_payments with relations
   */
  async getPayments(filters?: PaymentFilterOptions): Promise<Payment[]> {
    let query = supabase
      .from('ctc_tracker_payments')
      .select('*, customer:ctc_tracker_customers(id, name, phone), sale:ctc_tracker_sales(id, description, total_amount, amount_paid, payment_status, sale_date)')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters?.saleId) {
      query = query.eq('sale_id', filters.saleId);
    }

    if (filters?.startDate) {
      query = query.gte('payment_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('payment_date', filters.endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }

    return (data as Payment[]) || [];
  },

  /**
   * Fetch pending sales for a customer from ctc_tracker_sales
   */
  async getPendingSalesByCustomer(customerId: string): Promise<Sale[]> {
    const { data, error } = await supabase
      .from('ctc_tracker_sales')
      .select('*')
      .eq('customer_id', customerId)
      .neq('payment_status', 'paid')
      .order('sale_date', { ascending: true });

    if (error) throw error;
    return (data as Sale[]) || [];
  },

  /**
   * Record a payment into ctc_tracker_payments.
   * Updates ctc_tracker_sales amount_paid and status.
   */
  async recordPayment(formData: PaymentFormData, userId?: string): Promise<Payment> {
    const payAmount = Number(formData.amount);

    if (isNaN(payAmount) || payAmount <= 0) {
      throw new Error('Payment amount must be greater than 0.');
    }
    if (!formData.payment_date) {
      throw new Error('Payment date is required.');
    }
    if (!formData.sale_id) {
      throw new Error('Please select a sale to allocate this payment.');
    }

    // 1. Fetch current sale record from ctc_tracker_sales
    const { data: saleData, error: saleFetchError } = await supabase
      .from('ctc_tracker_sales')
      .select('*')
      .eq('id', formData.sale_id)
      .single();

    if (saleFetchError || !saleData) {
      throw new Error('Could not locate the selected sale record.');
    }

    const currentSale = saleData as Sale;
    const saleTotal = Number(currentSale.total_amount);
    const alreadyPaid = Number(currentSale.amount_paid);
    const remainingBalance = Math.max(0, Math.round((saleTotal - alreadyPaid) * 100) / 100);

    if (remainingBalance <= 0) {
      throw new Error('This sale is already fully paid.');
    }

    if (payAmount > remainingBalance) {
      throw new Error(
        `Payment of ₹${payAmount} exceeds remaining balance of ₹${remainingBalance}.`
      );
    }

    // 2. Insert payment record into ctc_tracker_payments
    const { data: payRecord, error: payInsertError } = await supabase
      .from('ctc_tracker_payments')
      .insert([
        {
          sale_id: formData.sale_id,
          customer_id: formData.customer_id,
          payment_date: formData.payment_date,
          amount: payAmount,
          payment_method: formData.payment_method,
          notes: formData.notes ? formData.notes.trim() : null,
          created_by: userId || null,
        },
      ])
      .select('*, customer:ctc_tracker_customers(id, name, phone), sale:ctc_tracker_sales(id, description, total_amount, amount_paid, payment_status, sale_date)')
      .single();

    if (payInsertError) throw payInsertError;

    // 3. Update the sale's amount_paid and payment_status in ctc_tracker_sales
    const newPaidTotal = Math.min(saleTotal, Math.round((alreadyPaid + payAmount) * 100) / 100);
    const newStatus = derivePaymentStatus(saleTotal, newPaidTotal);

    const { error: saleUpdateError } = await supabase
      .from('ctc_tracker_sales')
      .update({
        amount_paid: newPaidTotal,
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', formData.sale_id);

    if (saleUpdateError) {
      console.warn('Sale update warning:', saleUpdateError);
    }

    return payRecord as Payment;
  },

  /**
   * Delete a payment record from ctc_tracker_payments and adjust sale total
   */
  async deletePayment(paymentId: string): Promise<void> {
    const { data: payment, error: pError } = await supabase
      .from('ctc_tracker_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (pError || !payment) throw new Error('Payment record not found.');

    const { error: delError } = await supabase
      .from('ctc_tracker_payments')
      .delete()
      .eq('id', paymentId);

    if (delError) throw delError;

    const { data: remainingPayments } = await supabase
      .from('ctc_tracker_payments')
      .select('amount')
      .eq('sale_id', payment.sale_id);

    const newSum = (remainingPayments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    const { data: sale } = await supabase
      .from('ctc_tracker_sales')
      .select('total_amount')
      .eq('id', payment.sale_id)
      .single();

    if (sale) {
      const saleTotal = Number(sale.total_amount);
      const newStatus = derivePaymentStatus(saleTotal, newSum);
      await supabase
        .from('ctc_tracker_sales')
        .update({
          amount_paid: Math.min(saleTotal, newSum),
          payment_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.sale_id);
    }
  },
};

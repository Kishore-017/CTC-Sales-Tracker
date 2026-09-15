import React, { useState, useEffect } from 'react';
import {
  Wallet,
  DollarSign,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Search,
  Plus,
  Trash2,
} from 'lucide-react';
import { paymentsService } from '../../services/paymentsService';
import { customersService } from '../../services/customersService';
import { CustomerWithBalances, Payment, Sale, PaymentMethod } from '../../types/database';
import {
  formatINR,
  formatDate,
  calculateBalance,
  getTodayDateString,
  getPaymentMethodLabel,
} from '../../lib/formatters';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

interface MoneyViewProps {
  isRecordModalOpenInitially?: boolean;
  onCloseInitialRecordModal?: () => void;
}

export const MoneyView: React.FC<MoneyViewProps> = ({
  isRecordModalOpenInitially = false,
  onCloseInitialRecordModal,
}) => {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customersWithDues, setCustomersWithDues] = useState<CustomerWithBalances[]>([]);

  // Financial Metrics
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [todayCollection, setTodayCollection] = useState(0);
  const [monthCollection, setMonthCollection] = useState(0);

  // Filters for payment logs
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Record Payment Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(isRecordModalOpenInitially);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerPendingSales, setCustomerPendingSales] = useState<Sale[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete payment confirmation
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  useEffect(() => {
    if (isRecordModalOpenInitially) {
      setIsRecordModalOpen(true);
    }
  }, [isRecordModalOpenInitially]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allPayments, allCusts] = await Promise.all([
        paymentsService.getPayments({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        customersService.getCustomersWithBalances(),
      ]);

      setPayments(allPayments);

      // Filter customers with outstanding dues
      const duesList = allCusts.filter((c) => c.outstanding_balance > 0);
      setCustomersWithDues(duesList);

      // Calculate Metrics
      const todayStr = getTodayDateString();
      const now = new Date();
      const firstDayOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      let sumCollected = 0;
      let sumToday = 0;
      let sumMonth = 0;

      allPayments.forEach((p) => {
        const amt = Number(p.amount) || 0;
        sumCollected += amt;
        if (p.payment_date === todayStr) {
          sumToday += amt;
        }
        if (p.payment_date >= firstDayOfMonthStr) {
          sumMonth += amt;
        }
      });

      const sumOutstanding = duesList.reduce((acc, c) => acc + c.outstanding_balance, 0);

      setTotalCollected(sumCollected);
      setTotalOutstanding(sumOutstanding);
      setTodayCollection(sumToday);
      setMonthCollection(sumMonth);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load collections data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  // When customer changes in Record Payment Modal, load their pending sales
  useEffect(() => {
    if (selectedCustomerId) {
      paymentsService.getPendingSalesByCustomer(selectedCustomerId).then((sales) => {
        setCustomerPendingSales(sales);
        if (sales.length > 0) {
          setSelectedSaleId(sales[0].id);
          // Autofill remaining balance of that sale
          const bal = calculateBalance(Number(sales[0].total_amount), Number(sales[0].amount_paid));
          setPaymentAmount(String(bal));
        } else {
          setSelectedSaleId('');
          setPaymentAmount('');
        }
      });
    } else {
      setCustomerPendingSales([]);
      setSelectedSaleId('');
      setPaymentAmount('');
    }
  }, [selectedCustomerId]);

  // When selected sale changes, update autofill amount
  const handleSaleChange = (saleId: string) => {
    setSelectedSaleId(saleId);
    const found = customerPendingSales.find((s) => s.id === saleId);
    if (found) {
      const bal = calculateBalance(Number(found.total_amount), Number(found.amount_paid));
      setPaymentAmount(String(bal));
    }
  };

  const handleOpenRecordPayment = (customerId?: string) => {
    setPaymentDate(getTodayDateString());
    setPaymentMethod('cash');
    setPaymentNotes('');

    if (customerId) {
      setSelectedCustomerId(customerId);
    } else if (customersWithDues.length > 0) {
      setSelectedCustomerId(customersWithDues[0].id);
    } else {
      setSelectedCustomerId('');
    }

    setIsRecordModalOpen(true);
  };

  const handleCloseRecordModal = () => {
    setIsRecordModalOpen(false);
    if (onCloseInitialRecordModal) onCloseInitialRecordModal();
  };

  // Selected sale remaining balance
  const activeSale = customerPendingSales.find((s) => s.id === selectedSaleId);
  const activeSaleBalance = activeSale
    ? calculateBalance(Number(activeSale.total_amount), Number(activeSale.amount_paid))
    : 0;

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pAmt = Number(paymentAmount);

    if (!selectedCustomerId) {
      toast.error('Please select a customer.');
      return;
    }
    if (!selectedSaleId) {
      toast.error('Please select an invoice with an outstanding balance.');
      return;
    }
    if (isNaN(pAmt) || pAmt <= 0) {
      toast.error('Payment amount must be greater than 0.');
      return;
    }
    if (pAmt > activeSaleBalance) {
      toast.error(`Payment cannot exceed the invoice balance of ${formatINR(activeSaleBalance)}.`);
      return;
    }

    try {
      setSubmitting(true);
      await paymentsService.recordPayment({
        sale_id: selectedSaleId,
        customer_id: selectedCustomerId,
        payment_date: paymentDate,
        amount: pAmt,
        payment_method: paymentMethod,
        notes: paymentNotes,
      });

      toast.success(`Payment receipt of ${formatINR(pAmt)} recorded successfully.`);
      handleCloseRecordModal();
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Payment Audit
  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    try {
      setSubmitting(true);
      await paymentsService.deletePayment(paymentToDelete.id);
      toast.success('Payment receipt deleted and balance adjusted.');
      setIsDeleteOpen(false);
      setPaymentToDelete(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Payments List
  const filteredPayments = payments.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.customer?.name && p.customer.name.toLowerCase().includes(q)) ||
      (p.sale?.description && p.sale.description.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q)) ||
      p.payment_method.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
            Cash &amp; Bank Collections
          </span>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Money &amp; Collections
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track incoming payments, customer credit accounts, and cashflow
          </p>
        </div>

        <Button
          variant="success"
          size="md"
          onClick={() => handleOpenRecordPayment()}
          icon={<Plus className="w-4 h-4" />}
          className="font-bold shadow-md shadow-emerald-950/10"
        >
          + Record Payment
        </Button>
      </div>

      {/* ────────────────── 4 KPI CARDS ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Collection */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
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
              {formatINR(todayCollection)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Receipts recorded today
            </div>
          </div>
        </div>

        {/* KPI 2: This Month's Collection */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              This Month's Collection
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatINR(monthCollection)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Total monthly collections
            </div>
          </div>
        </div>

        {/* KPI 3: Total Outstanding */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Outstanding
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600 tracking-tight">
              {formatINR(totalOutstanding)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {customersWithDues.length} {customersWithDues.length === 1 ? 'customer' : 'customers'} with dues
            </div>
          </div>
        </div>

        {/* KPI 4: Total Lifetime Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Collected
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatINR(totalCollected)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Total payment history receipts
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────── OUTSTANDING CUSTOMERS LIST ────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Pending Customer Dues
            </h3>
            <p className="text-xs text-slate-500">
              Customers with outstanding balances requiring collection
            </p>
          </div>
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            {customersWithDues.length} Outstanding Accounts
          </span>
        </div>

        {customersWithDues.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
            All customer balances are fully settled! No pending dues.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {customersWithDues.map((cust) => (
              <div
                key={cust.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-brand-200 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{cust.name}</h4>
                    <span className="font-black text-amber-600 text-sm whitespace-nowrap">
                      {formatINR(cust.outstanding_balance)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {cust.phone ? <span>{cust.phone}</span> : <span>No phone on file</span>}
                  </div>
                  <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-200/60 pt-2">
                    <span>Total Billed: {formatINR(cust.total_sales)}</span>
                    <span>Paid: {formatINR(cust.total_paid)}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenRecordPayment(cust.id)}
                    className="w-full text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                    icon={<DollarSign className="w-3.5 h-3.5" />}
                  >
                    Collect Payment
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ────────────────── PAYMENT RECEIPTS AUDIT LOG ────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Payment Collection Log</h3>
            <p className="text-xs text-slate-500">
              Complete, immutable receipt history of all payments collected
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="From Date"
              className="text-xs w-36"
            />
            <span className="text-slate-400 text-xs">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="To Date"
              className="text-xs w-36"
            />
          </div>
        </div>

        <div className="max-w-md">
          <Input
            placeholder="Search payments by customer, method, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {loading ? (
          <LoadingSpinner text="Loading payment receipts..." />
        ) : filteredPayments.length === 0 ? (
          <EmptyState
            title="No payment receipts found"
            description="No payment collections match your search or date filters."
            actionLabel="+ Record Payment"
            onAction={() => handleOpenRecordPayment()}
          />
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Receipt Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Allocated Invoice</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Notes / Ref</th>
                  <th className="py-3 px-4 text-right">Amount Collected</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Date */}
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {formatDate(pay.payment_date)}
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {pay.customer?.name || 'Customer'}
                      {pay.customer?.phone && (
                        <div className="text-[11px] font-normal text-slate-400">
                          {pay.customer.phone}
                        </div>
                      )}
                    </td>

                    {/* Allocated Sale */}
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {pay.sale ? (
                        <div>
                          <span className="font-medium text-slate-800 truncate block">
                            {pay.sale.description}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            Invoice: {formatINR(pay.sale.total_amount)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Direct Payment</span>
                      )}
                    </td>

                    {/* Method */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 uppercase">
                        {getPaymentMethodLabel(pay.payment_method)}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                      {pay.notes || '—'}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap text-base">
                      {formatINR(pay.amount)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setPaymentToDelete(pay);
                          setIsDeleteOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete receipt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ────────────────── MODAL: RECORD PAYMENT ────────────────── */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={handleCloseRecordModal}
        title="Record Payment Collection"
        subtitle="Chelladurai Tradings Corporation"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordSubmit} className="space-y-4">
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Customer *
            </label>
            <Select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
            >
              <option value="">Select customer...</option>
              {customersWithDues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Due: {formatINR(c.outstanding_balance)}
                </option>
              ))}
            </Select>
          </div>

          {/* Pending Sales for Selected Customer */}
          {selectedCustomerId && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Allocate to Sale Invoice *
              </label>
              {customerPendingSales.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  No active pending sales found for this customer.
                </div>
              ) : (
                <Select
                  value={selectedSaleId}
                  onChange={(e) => handleSaleChange(e.target.value)}
                  required
                >
                  {customerPendingSales.map((s) => {
                    const bal = calculateBalance(Number(s.total_amount), Number(s.amount_paid));
                    return (
                      <option key={s.id} value={s.id}>
                        {formatDate(s.sale_date)}: {s.description} — Bal: {formatINR(bal)} (Total: {formatINR(s.total_amount)})
                      </option>
                    );
                  })}
                </Select>
              )}
            </div>
          )}

          {/* Payment Date and Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Payment Date *"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Input
                label="Amount (₹) *"
                type="number"
                step="0.01"
                min="0.01"
                max={activeSaleBalance}
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                helperText={
                  activeSale
                    ? `Max allowed: ${formatINR(activeSaleBalance)}`
                    : 'Select an invoice first'
                }
                required
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Select
              label="Payment Method *"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
              <option value="card">Card (Debit / Credit)</option>
              <option value="bank_transfer">Bank Transfer (NEFT / RTGS)</option>
              <option value="other">Other</option>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Input
              label="Notes / Transaction ID / Cheque # (Optional)"
              placeholder="e.g. Received via GPay from 9876543210"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>

          {/* Modal Actions */}
          <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={handleCloseRecordModal}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              type="submit"
              loading={submitting}
              disabled={!selectedSaleId || activeSaleBalance <= 0}
            >
              Record Collection
            </Button>
          </div>
        </form>
      </Modal>

      {/* ────────────────── DELETE PAYMENT CONFIRM ────────────────── */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeletePayment}
        title="Delete Payment Receipt?"
        message={`Are you sure you want to delete this payment receipt of ${formatINR(
          paymentToDelete?.amount
        )} recorded on ${formatDate(
          paymentToDelete?.payment_date
        )}? The associated sale invoice balance will increase automatically.`}
        confirmLabel="Delete Receipt"
        loading={submitting}
        variant="danger"
      />
    </div>
  );
};

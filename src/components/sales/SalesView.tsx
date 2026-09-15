import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  CreditCard,
  UserPlus,
} from 'lucide-react';
import { salesService } from '../../services/salesService';
import { customersService } from '../../services/customersService';
import { paymentsService } from '../../services/paymentsService';
import { Sale, Customer, PaymentStatus, PaymentMethod, Payment } from '../../types/database';
import {
  formatINR,
  formatDate,
  calculateBalance,
  derivePaymentStatus,
  getTodayDateString,
  getPaymentMethodLabel,
} from '../../lib/formatters';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

interface SalesViewProps {
  isAddModalOpenInitially?: boolean;
  onCloseInitialAddModal?: () => void;
  onCustomerSelect?: (customerId: string) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  isAddModalOpenInitially = false,
  onCloseInitialAddModal,
  onCustomerSelect,
}) => {
  const toast = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(isAddModalOpenInitially);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedSalePayments, setSelectedSalePayments] = useState<Payment[]>([]);

  // Inline Quick Add Customer inside Add Sale Modal
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustLoading, setQuickCustLoading] = useState(false);

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    customer_id: string;
    sale_date: string;
    description: string;
    total_amount: string;
    amount_paid: string;
    payment_method: PaymentMethod;
    notes: string;
  }>({
    customer_id: '',
    sale_date: getTodayDateString(),
    description: '',
    total_amount: '',
    amount_paid: '',
    payment_method: 'cash',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Record Payment Sub-modal inside View Sale Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payDate, setPayDate] = useState(getTodayDateString());
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  useEffect(() => {
    if (isAddModalOpenInitially) {
      setIsAddModalOpen(true);
    }
  }, [isAddModalOpenInitially]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [salesData, custList] = await Promise.all([
        salesService.getSales({
          search: searchQuery,
          status: statusFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        customersService.getCustomers(),
      ]);
      setSales(salesData);
      setCustomers(custList);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sales data from Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, statusFilter, startDate, endDate]);

  const resetForm = () => {
    setFormData({
      customer_id: customers[0]?.id || '',
      sale_date: getTodayDateString(),
      description: '',
      total_amount: '',
      amount_paid: '',
      payment_method: 'cash',
      notes: '',
    });
    setFormErrors({});
  };

  const handleOpenAddSale = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    if (onCloseInitialAddModal) onCloseInitialAddModal();
  };

  // Quick Customer Creation
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim()) {
      toast.error('Customer name is required.');
      return;
    }
    try {
      setQuickCustLoading(true);
      const newCust = await customersService.createCustomer({
        name: quickCustName,
        phone: quickCustPhone,
      });
      const updatedList = await customersService.getCustomers();
      setCustomers(updatedList);
      setFormData((prev) => ({ ...prev, customer_id: newCust.id }));
      setIsQuickAddCustomerOpen(false);
      setQuickCustName('');
      setQuickCustPhone('');
      toast.success(`Customer "${newCust.name}" added successfully.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add customer.');
    } finally {
      setQuickCustLoading(false);
    }
  };

  // Dynamic status & balance calculations for the Add Form
  const numTotal = Number(formData.total_amount) || 0;
  const numPaid = Number(formData.amount_paid) || 0;
  const calculatedBalance = calculateBalance(numTotal, numPaid);
  const calculatedStatus = derivePaymentStatus(numTotal, numPaid);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.customer_id) errors.customer_id = 'Please select a customer.';
    if (!formData.description.trim()) errors.description = 'Please enter a description (e.g. 20L Apex Emulsion, Primer).';
    if (!formData.total_amount || isNaN(numTotal) || numTotal <= 0) {
      errors.total_amount = 'Total amount must be greater than 0.';
    }
    if (numPaid < 0) {
      errors.amount_paid = 'Amount paid cannot be negative.';
    }
    if (numPaid > numTotal) {
      errors.amount_paid = 'Amount paid cannot exceed total sale amount.';
    }
    if (!formData.sale_date) {
      errors.sale_date = 'Sale date is required.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      await salesService.createSale({
        customer_id: formData.customer_id,
        sale_date: formData.sale_date,
        description: formData.description,
        total_amount: numTotal,
        amount_paid: numPaid,
        payment_method: numPaid > 0 ? formData.payment_method : null,
        notes: formData.notes,
      });

      toast.success('Sale recorded successfully!');
      handleCloseAddModal();
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record sale.');
    } finally {
      setSubmitting(false);
    }
  };

  // View Sale Details & Payments
  const handleOpenViewModal = async (sale: Sale) => {
    setSelectedSale(sale);
    setIsViewModalOpen(true);
    try {
      const pays = await paymentsService.getPayments({ saleId: sale.id });
      setSelectedSalePayments(pays);
    } catch (err) {
      console.error(err);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (sale: Sale) => {
    setSelectedSale(sale);
    setFormData({
      customer_id: sale.customer_id,
      sale_date: sale.sale_date,
      description: sale.description,
      total_amount: String(sale.total_amount),
      amount_paid: String(sale.amount_paid),
      payment_method: sale.payment_method || 'cash',
      notes: sale.notes || '',
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    const newTotal = Number(formData.total_amount);
    if (isNaN(newTotal) || newTotal < Number(selectedSale.amount_paid)) {
      toast.error(`Total amount cannot be less than collected amount (₹${selectedSale.amount_paid}).`);
      return;
    }

    try {
      setSubmitting(true);
      await salesService.updateSale(selectedSale.id, {
        description: formData.description.trim(),
        sale_date: formData.sale_date,
        notes: formData.notes.trim() || null,
        total_amount: newTotal,
      });

      toast.success('Sale details updated.');
      setIsEditModalOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update sale.');
    } finally {
      setSubmitting(false);
    }
  };

  // Destructive Delete
  const handleDeleteConfirm = async () => {
    if (!selectedSale) return;
    try {
      setSubmitting(true);
      await salesService.deleteSale(selectedSale.id);
      toast.success('Sale and payment logs deleted.');
      setIsDeleteConfirmOpen(false);
      setSelectedSale(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete sale.');
    } finally {
      setSubmitting(false);
    }
  };

  // Record Payment directly for this sale
  const handleRecordPaymentForSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    const pAmt = Number(payAmount);
    const saleBal = calculateBalance(Number(selectedSale.total_amount), Number(selectedSale.amount_paid));

    if (isNaN(pAmt) || pAmt <= 0) {
      toast.error('Payment amount must be greater than 0.');
      return;
    }
    if (pAmt > saleBal) {
      toast.error(`Payment cannot exceed the remaining balance of ₹${saleBal}.`);
      return;
    }

    try {
      setPaySubmitting(true);
      await paymentsService.recordPayment({
        sale_id: selectedSale.id,
        customer_id: selectedSale.customer_id,
        payment_date: payDate,
        amount: pAmt,
        payment_method: payMethod,
        notes: payNotes,
      });

      toast.success(`Payment of ₹${pAmt} recorded successfully.`);
      setIsPayModalOpen(false);
      setPayAmount('');
      setPayNotes('');

      // Refresh view modal details
      const refreshedSale = await salesService.getSaleById(selectedSale.id);
      if (refreshedSale) {
        setSelectedSale(refreshedSale);
        const pays = await paymentsService.getPayments({ saleId: refreshedSale.id });
        setSelectedSalePayments(pays);
      }
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setPaySubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
            Sales &amp; Invoices
          </span>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Sales Registry
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track customer sales, credit balances, and payment terms
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleOpenAddSale}
          icon={<Plus className="w-4 h-4" />}
          className="shadow-md shadow-brand-900/10 font-bold"
        >
          + Add Sale
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <Input
              placeholder="Search by customer, description, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Status Filter */}
          <div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partially Paid</option>
              <option value="credit">Credit (Pending)</option>
            </Select>
          </div>

          {/* Date Filter Range */}
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start"
              className="text-xs"
            />
            <span className="text-slate-400 text-xs">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End"
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Loading sales records..." />
        ) : sales.length === 0 ? (
          <EmptyState
            title="No sales found"
            description="No sales match your current search or date filters. Create a new sale to get started."
            actionLabel="+ Add New Sale"
            onAction={handleOpenAddSale}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sales.map((sale) => {
                  const balance = calculateBalance(Number(sale.total_amount), Number(sale.amount_paid));
                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {formatDate(sale.sale_date)}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {sale.customer ? (
                          <button
                            onClick={() => onCustomerSelect && onCustomerSelect(sale.customer_id)}
                            className="hover:text-brand-600 hover:underline text-left inline-flex items-center gap-1.5"
                          >
                            <span>{sale.customer.name}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400">Walk-in</span>
                        )}
                        {sale.customer?.phone && (
                          <div className="text-[11px] font-normal text-slate-400">
                            {sale.customer.phone}
                          </div>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={sale.description}>
                        <div className="font-medium text-slate-800 truncate">{sale.description}</div>
                        {sale.notes && (
                          <div className="text-[11px] text-slate-400 truncate">{sale.notes}</div>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                        {formatINR(sale.total_amount)}
                      </td>

                      {/* Paid */}
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {formatINR(sale.amount_paid)}
                      </td>

                      {/* Balance */}
                      <td className="py-3.5 px-4 text-right font-black whitespace-nowrap">
                        <span className={balance > 0 ? 'text-amber-600' : 'text-slate-400'}>
                          {formatINR(balance)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <StatusBadge status={sale.payment_status} size="sm" />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenViewModal(sale)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="View sale details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(sale)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Edit sale details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete sale"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ────────────────── MODAL: ADD SALE ────────────────── */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        title="Record New Sale"
        subtitle="Chelladurai Tradings Corporation"
        maxWidth="xl"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {/* Customer Selection with Inline Add Customer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Customer *
              </label>
              <button
                type="button"
                onClick={() => setIsQuickAddCustomerOpen(true)}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ New Customer</span>
              </button>
            </div>
            <Select
              value={formData.customer_id}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
              error={formErrors.customer_id}
            >
              <option value="">Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </Select>
          </div>

          {/* Quick Add Customer Drawer/Card inside Modal */}
          {isQuickAddCustomerOpen && (
            <div className="p-3.5 rounded-xl bg-brand-50/70 border border-brand-200 animate-in fade-in space-y-3">
              <div className="text-xs font-bold text-brand-900 flex items-center justify-between">
                <span>Add Customer Details</span>
                <button
                  type="button"
                  onClick={() => setIsQuickAddCustomerOpen(false)}
                  className="text-brand-500 hover:text-brand-700 text-xs"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Customer Full Name *"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="bg-white"
                />
                <Input
                  placeholder="Mobile / Phone (Optional)"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  className="bg-white"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleQuickAddCustomer}
                loading={quickCustLoading}
              >
                Save &amp; Select Customer
              </Button>
            </div>
          )}

          {/* Date and Description */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Input
                label="Sale Date *"
                type="date"
                value={formData.sale_date}
                onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                error={formErrors.sale_date}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Description *"
                placeholder="e.g. 20L Apex Emulsion, 5L Primer, Brushes"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                error={formErrors.description}
                required
              />
            </div>
          </div>

          {/* Amounts & Payment Status Calculation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="Total Amount (₹) *"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                error={formErrors.total_amount}
                required
              />
            </div>
            <div>
              <Input
                label="Amount Paid Upfront (₹)"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount_paid}
                onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                error={formErrors.amount_paid}
              />
            </div>
          </div>

          {/* Real-time Dynamic Calculation Preview Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Automatic Balance &amp; Status Calculation
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                <span className="block text-[11px] text-slate-500">Total Billed</span>
                <span className="font-black text-slate-900 text-sm">{formatINR(numTotal)}</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                <span className="block text-[11px] text-slate-500">Upfront Paid</span>
                <span className="font-bold text-emerald-600 text-sm">{formatINR(numPaid)}</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                <span className="block text-[11px] text-slate-500">Remaining Balance</span>
                <span className="font-black text-amber-600 text-sm">
                  {formatINR(calculatedBalance)}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-slate-200/60">
              <span className="text-slate-600 font-medium">Calculated Status:</span>
              <StatusBadge status={calculatedStatus} size="sm" />
            </div>
          </div>

          {/* Payment Method (If paid > 0) */}
          {numPaid > 0 && (
            <div>
              <Select
                label="Payment Method *"
                value={formData.payment_method}
                onChange={(e) =>
                  setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })
                }
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="card">Card (Debit / Credit)</option>
                <option value="bank_transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                <option value="other">Other</option>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Notes / Memo (Optional)
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any order specifics, delivery notes, or agreed credit terms..."
              className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="md" type="button" onClick={handleCloseAddModal}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" loading={submitting}>
              Save Sale
            </Button>
          </div>
        </form>
      </Modal>

      {/* ────────────────── MODAL: VIEW SALE & PAYMENTS BREAKDOWN ────────────────── */}
      {selectedSale && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title="Sale Details &amp; Payment Ledger"
          subtitle={`Invoice #${selectedSale.id.substring(0, 8)} • ${formatDate(selectedSale.sale_date)}`}
          maxWidth="xl"
        >
          <div className="space-y-5">
            {/* Customer & Sale Summary Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Customer
                  </span>
                  <h4 className="text-base font-black text-slate-900">
                    {selectedSale.customer?.name || 'Walk-in Customer'}
                  </h4>
                  {selectedSale.customer?.phone && (
                    <p className="text-xs text-slate-500">{selectedSale.customer.phone}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedSale.payment_status} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="block text-[11px] text-slate-500">Total Billed</span>
                  <span className="font-black text-slate-900 text-sm">
                    {formatINR(selectedSale.total_amount)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="block text-[11px] text-slate-500">Total Paid</span>
                  <span className="font-bold text-emerald-600 text-sm">
                    {formatINR(selectedSale.amount_paid)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <span className="block text-[11px] text-slate-500">Remaining Balance</span>
                  <span className="font-black text-amber-600 text-sm">
                    {formatINR(
                      calculateBalance(
                        Number(selectedSale.total_amount),
                        Number(selectedSale.amount_paid)
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Description: </span>
                <span>{selectedSale.description}</span>
              </div>
              {selectedSale.notes && (
                <div className="mt-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Notes: </span>
                  <span>{selectedSale.notes}</span>
                </div>
              )}
            </div>

            {/* Payment History Breakdown */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Payment Audit Trail</h4>
                  <p className="text-xs text-slate-500">
                    Chronological receipts recorded for this sale
                  </p>
                </div>

                {calculateBalance(
                  Number(selectedSale.total_amount),
                  Number(selectedSale.amount_paid)
                ) > 0 && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => {
                      setPayAmount('');
                      setPayDate(getTodayDateString());
                      setPayNotes('');
                      setIsPayModalOpen(true);
                    }}
                    icon={<CreditCard className="w-3.5 h-3.5" />}
                  >
                    + Collect Payment
                  </Button>
                )}
              </div>

              {selectedSalePayments.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                  No payment receipts recorded yet for this invoice.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedSalePayments.map((pay) => (
                    <div
                      key={pay.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/80 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {formatDate(pay.payment_date)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold uppercase text-slate-600">
                            {getPaymentMethodLabel(pay.payment_method)}
                          </span>
                        </div>
                        {pay.notes && (
                          <div className="text-slate-500 mt-0.5 truncate max-w-sm">{pay.notes}</div>
                        )}
                      </div>
                      <div className="font-black text-emerald-600 text-sm">
                        {formatINR(pay.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ────────────────── SUB-MODAL: RECORD PAYMENT FOR SALE ────────────────── */}
      {selectedSale && (
        <Modal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          title="Collect Payment"
          subtitle={`For Invoice #${selectedSale.id.substring(0, 8)} • Remaining Balance: ${formatINR(
            calculateBalance(Number(selectedSale.total_amount), Number(selectedSale.amount_paid))
          )}`}
          maxWidth="md"
        >
          <form onSubmit={handleRecordPaymentForSale} className="space-y-4">
            <Input
              label="Payment Date *"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              required
            />

            <Input
              label="Amount to Collect (₹) *"
              type="number"
              step="0.01"
              min="0.01"
              max={calculateBalance(
                Number(selectedSale.total_amount),
                Number(selectedSale.amount_paid)
              )}
              placeholder="Enter payment amount"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              required
              helperText={`Maximum collectable: ${formatINR(
                calculateBalance(Number(selectedSale.total_amount), Number(selectedSale.amount_paid))
              )}`}
            />

            <Select
              label="Payment Method *"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
              <option value="card">Card (Debit / Credit)</option>
              <option value="bank_transfer">Bank Transfer (NEFT / RTGS)</option>
              <option value="other">Other</option>
            </Select>

            <Input
              label="Notes / Receipt Reference (Optional)"
              placeholder="e.g. UPI Ref #9348924823 or Cheque #"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />

            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsPayModalOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="success" size="sm" type="submit" loading={paySubmitting}>
                Confirm Collection
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ────────────────── MODAL: EDIT SALE ────────────────── */}
      {selectedSale && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Sale Details"
          subtitle={`Invoice #${selectedSale.id.substring(0, 8)}`}
          maxWidth="lg"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input
              label="Sale Date *"
              type="date"
              value={formData.sale_date}
              onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
              required
            />

            <Input
              label="Description *"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />

            <Input
              label="Total Sale Amount (₹) *"
              type="number"
              step="0.01"
              value={formData.total_amount}
              onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
              helperText={`Cannot be less than ₹${selectedSale.amount_paid} (already paid)`}
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Notes
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={submitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ────────────────── MODAL: DELETE CONFIRM ────────────────── */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Sale Invoice?"
        message={`Are you sure you want to delete this sale for "${selectedSale?.customer?.name || 'Customer'}" (${formatINR(
          selectedSale?.total_amount
        )})? All associated payment receipts will also be deleted. This action cannot be undone.`}
        confirmLabel="Delete Sale"
        loading={submitting}
        variant="danger"
      />
    </div>
  );
};

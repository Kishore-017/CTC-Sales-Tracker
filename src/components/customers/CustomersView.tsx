import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Phone,
  ArrowRight,
  Edit2,
  DollarSign,
  Receipt,
  X,
} from 'lucide-react';
import { customersService, LedgerItem } from '../../services/customersService';
import { CustomerWithBalances, Customer } from '../../types/database';
import { formatINR, formatDate, getPaymentMethodLabel } from '../../lib/formatters';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

interface CustomersViewProps {
  initialCustomerId?: string | null;
  onClearInitialCustomer?: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  initialCustomerId,
  onClearInitialCustomer,
}) => {
  const toast = useToast();

  const [customers, setCustomers] = useState<CustomerWithBalances[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDueOnly, setFilterDueOnly] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithBalances | null>(null);

  // Detail Drawer State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailSummary, setDetailSummary] = useState<{
    totalSales: number;
    totalPaid: number;
    outstanding: number;
  } | null>(null);
  const [detailLedger, setDetailLedger] = useState<LedgerItem[]>([]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await customersService.getCustomersWithBalances();
      setCustomers(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customer list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Handle initial customer query from other views (e.g. clicked on customer from sales)
  useEffect(() => {
    if (initialCustomerId && customers.length > 0) {
      const found = customers.find((c) => c.id === initialCustomerId);
      if (found) {
        handleOpenDetail(found);
      }
      if (onClearInitialCustomer) onClearInitialCustomer();
    }
  }, [initialCustomerId, customers]);

  const handleOpenDetail = async (customer: CustomerWithBalances | Customer) => {
    setSelectedCustomer(customer as CustomerWithBalances);
    setIsDetailOpen(true);
    try {
      setDetailLoading(true);
      const ledgerData = await customersService.getCustomerLedger(customer.id);
      setDetailCustomer(ledgerData.customer);
      setDetailSummary(ledgerData.summary);
      setDetailLedger(ledgerData.ledger);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customer ledger.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormName('');
    setFormPhone('');
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (customer: CustomerWithBalances, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCustomer(customer);
    setFormName(customer.name);
    setFormPhone(customer.phone || '');
    setFormNotes(customer.notes || '');
    setIsEditModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Customer name is required.');
      return;
    }

    try {
      setSubmitting(true);
      const newCust = await customersService.createCustomer({
        name: formName,
        phone: formPhone,
        notes: formNotes,
      });

      toast.success(`Customer "${newCust.name}" added successfully.`);
      setIsAddModalOpen(false);
      loadCustomers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add customer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (!formName.trim()) {
      toast.error('Customer name is required.');
      return;
    }

    try {
      setSubmitting(true);
      await customersService.updateCustomer(selectedCustomer.id, {
        name: formName,
        phone: formPhone,
        notes: formNotes,
      });

      toast.success('Customer details updated.');
      setIsEditModalOpen(false);
      loadCustomers();
      if (detailCustomer && detailCustomer.id === selectedCustomer.id) {
        setDetailCustomer({ ...detailCustomer, name: formName, phone: formPhone, notes: formNotes });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update customer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered List
  const filteredCustomers = customers.filter((c) => {
    const term = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !term ||
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.notes && c.notes.toLowerCase().includes(term));

    const matchesDue = !filterDueOnly || c.outstanding_balance > 0;
    return matchesSearch && matchesDue;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
            Customer Directory &amp; Ledger
          </span>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Customer Accounts
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Maintain customer ledgers, sales volume, and pending dues
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleOpenAdd}
          icon={<Plus className="w-4 h-4" />}
          className="font-bold shadow-md shadow-brand-900/10"
        >
          + Add Customer
        </Button>
      </div>

      {/* Search & Dues Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="max-w-md w-full">
          <Input
            placeholder="Search by customer name or mobile number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterDueOnly(!filterDueOnly)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
              filterDueOnly
                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                filterDueOnly ? 'bg-amber-500' : 'bg-slate-300'
              }`}
            />
            <span>Show Only Customers with Dues</span>
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingSpinner text="Loading customer accounts..." />
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            title="No customers found"
            description={
              filterDueOnly
                ? 'No customers currently have outstanding balances.'
                : 'No customer profiles match your search criteria.'
            }
            actionLabel="+ Add New Customer"
            onAction={handleOpenAdd}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right">Total Sales</th>
                  <th className="py-3 px-4 text-right">Total Paid</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4">Last Transaction</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    onClick={() => handleOpenDetail(cust)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Customer Name */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-black text-xs group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                          {cust.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="group-hover:text-brand-600 transition-colors">
                            {cust.name}
                          </div>
                          <div className="text-[11px] font-normal text-slate-400">
                            {cust.sales_count} {cust.sales_count === 1 ? 'sale' : 'sales'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {cust.phone ? (
                        <span className="text-xs font-medium">{cust.phone}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Total Sales */}
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                      {formatINR(cust.total_sales)}
                    </td>

                    {/* Total Paid */}
                    <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                      {formatINR(cust.total_paid)}
                    </td>

                    {/* Outstanding */}
                    <td className="py-3.5 px-4 text-right font-black whitespace-nowrap">
                      <span
                        className={
                          cust.outstanding_balance > 0 ? 'text-amber-600' : 'text-slate-400'
                        }
                      >
                        {formatINR(cust.outstanding_balance)}
                      </span>
                    </td>

                    {/* Last Transaction */}
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(cust.last_transaction_date)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => handleOpenEdit(cust, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <span className="p-1.5 rounded-lg text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ────────────────── CUSTOMER DETAIL DRAWER / MODAL ────────────────── */}
      {isDetailOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDetailOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-2xl w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-brand-950/10">
                  {detailCustomer?.name.substring(0, 2).toUpperCase() || 'CU'}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {detailCustomer?.name || 'Customer Profile'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    {detailCustomer?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{detailCustomer.phone}</span>
                      </span>
                    )}
                    {detailCustomer?.notes && (
                      <>
                        <span>•</span>
                        <span className="italic truncate max-w-xs">{detailCustomer.notes}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedCustomer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(selectedCustomer)}
                    icon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </Button>
                )}
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Financial Summary Strip */}
            <div className="p-5 border-b border-slate-200 bg-white grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Sales
                </span>
                <span className="text-lg font-black text-slate-900 mt-1 block">
                  {formatINR(detailSummary?.totalSales || 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Total Paid
                </span>
                <span className="text-lg font-black text-emerald-600 mt-1 block">
                  {formatINR(detailSummary?.totalPaid || 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Outstanding
                </span>
                <span className="text-lg font-black text-amber-600 mt-1 block">
                  {formatINR(detailSummary?.outstanding || 0)}
                </span>
              </div>
            </div>

            {/* Complete Transaction History Ledger */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Transaction History Ledger</h4>
                  <p className="text-xs text-slate-500">
                    Chronological record of every sale invoice and payment receipt
                  </p>
                </div>
              </div>

              {detailLoading ? (
                <LoadingSpinner text="Loading customer ledger..." />
              ) : detailLedger.length === 0 ? (
                <EmptyState
                  title="No transaction history"
                  description="No sales or payments have been recorded for this customer yet."
                />
              ) : (
                <div className="space-y-3">
                  {detailLedger.map((item) => {
                    const isSale = item.type === 'sale';
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isSale
                            ? 'bg-white border-slate-200 shadow-sm'
                            : 'bg-emerald-50/50 border-emerald-200/80 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isSale
                                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                  : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                              }`}
                            >
                              {isSale ? (
                                <Receipt className="w-4 h-4" />
                              ) : (
                                <DollarSign className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {isSale ? 'Sale Invoice' : 'Payment Received'}
                                </span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs font-semibold text-slate-500">
                                  {formatDate(item.date)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>
                            </div>
                          </div>

                          <div className="text-right">
                            <div
                              className={`text-base font-black ${
                                isSale ? 'text-slate-900' : 'text-emerald-600'
                              }`}
                            >
                              {isSale ? '+' : '-'}
                              {formatINR(isSale ? item.totalAmount : item.paymentAmount)}
                            </div>
                            {item.paymentMethod && (
                              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                                {getPaymentMethodLabel(item.paymentMethod)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Breakdown for Sale */}
                        {isSale && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <div>
                              <span>Paid: </span>
                              <span className="font-semibold text-emerald-600">
                                {formatINR(item.amountPaid)}
                              </span>
                            </div>
                            <div>
                              <span>Balance: </span>
                              <span
                                className={`font-bold ${
                                  (item.balance || 0) > 0 ? 'text-amber-600' : 'text-slate-400'
                                }`}
                              >
                                {formatINR(item.balance)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODAL: ADD CUSTOMER ────────────────── */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Customer"
        subtitle="Chelladurai Tradings Corporation"
        maxWidth="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Input
            label="Customer Name *"
            placeholder="e.g. Ramesh Painter, Sri Murugan Constructions"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Mobile / Phone Number (Optional)"
            placeholder="e.g. +91 98765 43210"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            type="tel"
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Notes / Address / Credit Terms (Optional)
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. Contractor for commercial site, 15 days credit agreement"
              className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* ────────────────── MODAL: EDIT CUSTOMER ────────────────── */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer Details"
        subtitle={selectedCustomer?.name}
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Customer Name *"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />

          <Input
            label="Mobile / Phone Number"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            type="tel"
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Notes / Terms
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>
              Update Customer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

import { PaymentStatus, PaymentMethod } from '../types/database';

/**
 * Formats a numeric amount in standard Indian Rupee format (e.g. ₹1,25,000)
 */
export function formatINR(amount: number | null | undefined, includeDecimals = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(absAmount);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) into readable Indian date format: "14 Sep 2026"
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(d.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateString);
  }
}

/**
 * Formats date and time: "14 Sep 2026, 08:45 PM"
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(d.getTime())) return String(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateString);
  }
}

/**
 * Returns today's date in YYYY-MM-DD format for input[type="date"]
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes remaining balance safely, never negative
 */
export function calculateBalance(total: number, paid: number): number {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  const bal = Math.round((t - p) * 100) / 100;
  return bal < 0 ? 0 : bal;
}

/**
 * Automatically computes Payment Status according to business rules:
 * - Paid if paid >= total
 * - Partial if paid > 0 and paid < total
 * - Credit if paid = 0
 */
export function derivePaymentStatus(total: number, paid: number): PaymentStatus {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  if (p >= t && t > 0) return 'paid';
  if (p > 0 && p < t) return 'partial';
  return 'credit';
}

/**
 * Human-readable label for payment methods
 */
export function getPaymentMethodLabel(method: PaymentMethod | string | null | undefined): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'upi':
      return 'UPI';
    case 'card':
      return 'Card';
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'other':
      return 'Other';
    default:
      return '—';
  }
}

/**
 * Color metadata for status badges
 */
export function getPaymentStatusDetails(status: PaymentStatus) {
  switch (status) {
    case 'paid':
      return {
        label: 'Paid',
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        dot: 'bg-emerald-500',
      };
    case 'partial':
      return {
        label: 'Partially Paid',
        bg: 'bg-amber-50 border-amber-200 text-amber-700',
        dot: 'bg-amber-500',
      };
    case 'credit':
      return {
        label: 'Credit',
        bg: 'bg-rose-50 border-rose-200 text-rose-700',
        dot: 'bg-rose-500',
      };
    default:
      return {
        label: status,
        bg: 'bg-slate-50 border-slate-200 text-slate-700',
        dot: 'bg-slate-400',
      };
  }
}

export type UserRole = 'admin' | 'staff';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithBalances extends Customer {
  total_sales: number;
  total_paid: number;
  outstanding_balance: number;
  last_transaction_date: string | null;
  sales_count: number;
}

export type PaymentStatus = 'paid' | 'partial' | 'credit';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other';

export interface Sale {
  id: string;
  customer_id: string;
  sale_date: string;
  description: string;
  total_amount: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
  };
  payments?: Payment[];
}

export interface Payment {
  id: string;
  sale_id: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  sale?: {
    id: string;
    description: string;
    total_amount: number;
    amount_paid: number;
    payment_status: PaymentStatus;
    sale_date: string;
  };
  customer?: {
    id: string;
    name: string;
    phone: string | null;
  };
}

export interface SaleFormData {
  customer_id: string;
  sale_date: string;
  description: string;
  total_amount: number;
  amount_paid: number;
  payment_method: PaymentMethod | null;
  notes: string;
}

export interface PaymentFormData {
  sale_id: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  notes: string;
}

export interface KPISummary {
  todaySales: number;
  todayCollections: number;
  totalOutstanding: number;
  monthSales: number;
  todaySalesCount: number;
  pendingTransactionsCount: number;
}

export interface DailyChartPoint {
  date: string;
  displayDate: string;
  sales: number;
  collections: number;
}

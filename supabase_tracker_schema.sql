-- ============================================================================
-- CHELLADURAI TRADINGS CORPORATION (CTC) — SALES & MONEY TRACKER
-- Isolated Tracker Database Schema & Row Level Security (RLS)
--
-- IMPORTANT SAFETY GUARANTEE:
-- All tables and objects are strictly prefixed with "ctc_tracker_".
-- Zero existing website tables (admins, brands, categories, enquiries,
-- gallery, inventory, products, settings, users) are touched or modified.
-- Zero triggers are created on auth.users.
-- ============================================================================

-- Enable pgcrypto / uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TRACKER PROFILES TABLE (ISOLATED)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ctc_tracker_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctc_tracker_profiles_role ON public.ctc_tracker_profiles(role);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TRACKER CUSTOMERS TABLE (ISOLATED)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ctc_tracker_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctc_tracker_customers_name ON public.ctc_tracker_customers(name);
CREATE INDEX IF NOT EXISTS idx_ctc_tracker_customers_created_at ON public.ctc_tracker_customers(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRACKER SALES TABLE (ISOLATED)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ctc_tracker_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.ctc_tracker_customers(id) ON DELETE RESTRICT,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0 AND amount_paid <= total_amount),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'partial', 'credit')),
    payment_method TEXT CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'other', NULL)),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctc_tracker_sales_customer_id ON public.ctc_tracker_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_ctc_tracker_sales_date ON public.ctc_tracker_sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_ctc_tracker_sales_status ON public.ctc_tracker_sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_ctc_tracker_sales_created_at ON public.ctc_tracker_sales(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRACKER PAYMENTS TABLE (ISOLATED)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ctc_tracker_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.ctc_tracker_sales(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.ctc_tracker_customers(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'other')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctc_tracker_payments_sale_id ON public.ctc_tracker_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_ctc_tracker_payments_customer_id ON public.ctc_tracker_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_ctc_tracker_payments_date ON public.ctc_tracker_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_ctc_tracker_payments_created_at ON public.ctc_tracker_payments(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER ON ctc_tracker_payments ONLY: AUTO-SYNC SALE TOTALS
-- (Strictly scoped to ctc_tracker_payments table, zero touch on auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ctc_tracker_fn_sync_sale_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    target_sale_id UUID;
    total_paid_calc NUMERIC(12,2);
    sale_total NUMERIC(12,2);
    new_status TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_sale_id := OLD.sale_id;
    ELSE
        target_sale_id := NEW.sale_id;
    END IF;

    -- Fetch total sale amount
    SELECT total_amount INTO sale_total FROM public.ctc_tracker_sales WHERE id = target_sale_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Calculate sum of all recorded payments for this sale
    SELECT COALESCE(SUM(amount), 0.00) INTO total_paid_calc
    FROM public.ctc_tracker_payments
    WHERE sale_id = target_sale_id;

    -- Determine new payment status
    IF total_paid_calc >= sale_total THEN
        new_status := 'paid';
    ELSIF total_paid_calc > 0 THEN
        new_status := 'partial';
    ELSE
        new_status := 'credit';
    END IF;

    -- Update the ctc_tracker_sales record
    UPDATE public.ctc_tracker_sales
    SET 
        amount_paid = LEAST(total_paid_calc, sale_total),
        payment_status = new_status,
        updated_at = now()
    WHERE id = target_sale_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ctc_tracker_trg_sync_sale_payments ON public.ctc_tracker_payments;
CREATE TRIGGER ctc_tracker_trg_sync_sale_payments
AFTER INSERT OR UPDATE OR DELETE ON public.ctc_tracker_payments
FOR EACH ROW EXECUTE FUNCTION public.ctc_tracker_fn_sync_sale_on_payment();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY (RLS) POLICIES ON ctc_tracker_* TABLES ONLY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ctc_tracker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctc_tracker_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctc_tracker_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ctc_tracker_payments ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "ctc_tracker_auth_read_profiles" ON public.ctc_tracker_profiles;
CREATE POLICY "ctc_tracker_auth_read_profiles"
    ON public.ctc_tracker_profiles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "ctc_tracker_auth_insert_profiles" ON public.ctc_tracker_profiles;
CREATE POLICY "ctc_tracker_auth_insert_profiles"
    ON public.ctc_tracker_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "ctc_tracker_auth_update_profiles" ON public.ctc_tracker_profiles;
CREATE POLICY "ctc_tracker_auth_update_profiles"
    ON public.ctc_tracker_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Customers Policies
DROP POLICY IF EXISTS "ctc_tracker_auth_full_customers" ON public.ctc_tracker_customers;
CREATE POLICY "ctc_tracker_auth_full_customers"
    ON public.ctc_tracker_customers FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Sales Policies
DROP POLICY IF EXISTS "ctc_tracker_auth_full_sales" ON public.ctc_tracker_sales;
CREATE POLICY "ctc_tracker_auth_full_sales"
    ON public.ctc_tracker_sales FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Payments Policies
DROP POLICY IF EXISTS "ctc_tracker_auth_full_payments" ON public.ctc_tracker_payments;
CREATE POLICY "ctc_tracker_auth_full_payments"
    ON public.ctc_tracker_payments FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. REALTIME REPLICATION (ONLY FOR TRACKER TABLES)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ctc_tracker_customers REPLICA IDENTITY FULL;
ALTER TABLE public.ctc_tracker_sales REPLICA IDENTITY FULL;
ALTER TABLE public.ctc_tracker_payments REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ctc_tracker_customers, public.ctc_tracker_sales, public.ctc_tracker_payments;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

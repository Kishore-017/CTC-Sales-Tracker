# Chelladurai Tradings Corporation — Sales & Money Tracker (CTC)

A standalone business tracker for a paint & hardware shop to track **sales, customer balances, payments, collections, and financial summaries**.

Built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, **Supabase**, and **Recharts**.

---

## Quick Setup Instructions

### 1. Database Setup (One-Time in Supabase)
1. Open your **Supabase Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your existing CTC project.
3. Open the **SQL Editor** from the left sidebar.
4. Open or copy the contents of [`supabase_tracker_schema.sql`](./supabase_tracker_schema.sql) located in this directory.
5. Paste the script into the SQL Editor and click **RUN**.
   - This creates ONLY isolated tracker tables: `ctc_tracker_profiles`, `ctc_tracker_customers`, `ctc_tracker_sales`, and `ctc_tracker_payments`.
   - **Zero existing website tables are touched** (admins, brands, categories, enquiries, gallery, inventory, products, settings, users).
   - **Zero triggers on `auth.users`**.
   - Configures the automatic balance and payment status synchronization trigger on `ctc_tracker_payments`.
   - Enables Row Level Security (RLS) policies for authenticated users on `ctc_tracker_*` tables.
   - Enables Realtime ONLY for the tracker tables.

### 2. Create User Credentials in Supabase Auth
1. In the Supabase Dashboard, go to **Authentication** → **Users**.
2. Click **Add User** → **Create User**.
3. Enter your business email and password.
4. (Optional) Check "Auto-confirm user" so no verification email is required.
5. Upon your first sign-in, the application automatically initializes your profile in `ctc_tracker_profiles` with the `admin` role safely without any database triggers on `auth.users`.

### 3. Environment Variables
Ensure `.env` in the root folder contains your Supabase project credentials:
```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

### 4. Running the Tracker Locally
```bash
# Install dependencies (already installed)
npm install

# Start Vite Development Server
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Key Features & Business Logic

### 1. Dashboard
- **4 Main KPI Cards**:
  - Today's Sales
  - Today's Collection
  - Total Outstanding Amount
  - This Month's Sales
- **Secondary Badges**: Count of sales recorded today and pending credit accounts.
- **Trend Charts**: Dynamic Area chart of Billed Sales vs Collected Money over 7 Days, 30 Days, or This Month.
- **Paid vs Outstanding Visualization**: Real-time collections breakdown.
- **Recent Transactions Feed**: Combined stream of latest sales and payment receipts.

### 2. Sales Registry
- **+ Add Sale**:
  - Select customer (or click **+ New Customer** to add inline).
  - Enter description, sale date, total amount, and upfront amount paid.
  - **Dynamic Calculation**: Instantly computes `Balance = Total - Paid` and sets status:
    - `Paid` if Paid >= Total
    - `Partially Paid` if Paid > 0 and Paid < Total
    - `Credit` if Paid = 0
  - If upfront payment > 0, automatically creates an initial payment receipt in `payments` table.
- **Sales Table**: Filter by search, date range, or payment status (Paid, Partial, Credit).
- **View Sale**: Detailed invoice breakdown + chronological payment audit history + quick "+ Collect Payment" button.
- **Edit & Delete**: Allows updating sale details or deleting (with confirmation modal).

### 3. Customer Directory & Ledger
- **Customer List**: Name, phone, total sales volume, total amount collected, outstanding balance, and last transaction date.
- **Duplicate Prevention**: Warns if a customer with the same name already exists.
- **Filter Customers with Dues**: One-click filter to isolate accounts with pending balances.
- **Customer Ledger Drawer**: Chronological running ledger displaying every sale and payment transaction for the customer.

### 4. Money & Collections
- **Collections KPIs**: Today's collection, This month's collection, Total outstanding, Lifetime collected.
- **Pending Customer Dues List**: Card view of all customers with unpaid balances.
- **Record Payment**:
  - Select customer and invoice.
  - Validates that payment amount cannot exceed remaining invoice balance.
  - Updates sale balance without altering the original total amount.
  - Maintains permanent, tamper-proof payment receipt history.

### 5. Reports & Analytics
- **Period Filter**: Today, This Week, This Month, or Custom Date Range.
- **Financial Totals**: Total sales, collections received, outstanding balance, and invoice counts by status.
- **Visual Trends**: Bar chart of daily sales vs collections.
- **Toggleable Breakdown**: View ₹ Collections Ratio or Invoice Status Split.
- **Printable**: Formatted for browser printing and PDF export.

### 6. Settings
- Business entity details for Chelladurai Tradings Corporation.
- Operator account email and role badge.
- Supabase connection status check.
- Sign out action.

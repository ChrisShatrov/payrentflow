# Reports and Exports

This document describes the Reports area: dashboard-style reports, tax-ready summaries, statements, CSV exports, QuickBooks export, and reconciliation.

## Reports section

- **Location**: Admin → Reports (`/admin/reports`).
- **Filters**: Use the global date range (preset or custom), property, and unit. All reports and exports use the same filters so totals match across the dashboard, tax report, and CSV files.

## Report types

### Dashboard

- **Income summary**: Gross income from rent payments (completed/paid) in the selected period.
- **Expenses summary**: Total allowable expenses (from the Expenses feature) in the period.
- **Net operating income (NOI)**: Income minus expenses.
- **Cashflow**: Income minus expenses minus payouts.
- **Outstanding receivables**: Sum of unpaid/overdue statement balances (total due minus payments applied).
- **Failed / pending payments**: Count and amount of failed or pending payments.
- **Breakdown by property**: Income and expenses per property.
- **Ledger preview**: First 50 rows of the unified ledger (income from payments, expenses, payouts).

### Tax-ready reports

- **Annual summary**: Select a calendar year to see gross rental income, allowable expenses by category, and net income. Use for tax filing.
- **Category totals**: Same data grouped by category (income and expense). Export and on-screen totals use the same query.

### Statements

- **Owner statement**: Period-based summary of income, expenses, and payouts. Download as PDF or JSON. Uses the same date range and optional property filter.
- **P&L (Profit & Loss)**: Income by category, expenses by category, net income. Download as PDF or JSON.
- **Tenant statements**: Generated per unit and period from the **Statements** page. Download tenant rent statement PDFs there.

## Exports

All CSV exports use the current date range, property, and unit filters. Totals in the exported file match the dashboard for that range.

- **Transactions CSV**: Ledger rows (date, type, amount, category, property, unit, tenant, description).
- **Invoices CSV**: Statements (invoices) with unit, property, tenant, period, base rent, fees, total due, status, paid amount.
- **Payments CSV**: Payments with date, property, unit, tenant, amount, method, status.
- **Payouts CSV**: Payouts with date, amount, status.
- **Ledger CSV**: Same as transactions but with Debit and Credit columns for accountant use.

## QuickBooks export

1. Set your date range and optional property/unit filters.
2. Click **Export for QuickBooks**. Four CSVs are downloaded:
   - **quickbooks-customers.csv**: Tenants (Customer ID = profile id, Customer Name, Email).
   - **quickbooks-invoices.csv**: Statements as invoices (Invoice Number = statement id, Customer ID, Date, Amount).
   - **quickbooks-payments.csv**: Payments (Payment ID, Invoice Number, Customer ID, Amount, Date).
   - **quickbooks-account-mapping.csv**: Category name to QuickBooks account name mapping.

### How to import into QuickBooks

1. In QuickBooks Online: go to **Settings** (gear) → **Import data** (or **Lists** → **Chart of Accounts** / **Customers** as applicable).
2. Import **Customers** first: use `quickbooks-customers.csv`. Map columns if prompted (Customer ID, Customer Name, Email).
3. Import **Invoices**: use `quickbooks-invoices.csv`. Map Invoice Number, Customer ID (or Customer Name), Date, Amount. Ensure Customer ID/Name matches the customers you imported.
4. Import **Payments**: use `quickbooks-payments.csv`. Link to the imported invoices and customers as required by your QuickBooks version.
5. Use **account_mapping.csv** as a reference to map RentFlow categories to your QuickBooks chart of accounts (e.g. Rent → Rental Income, Repairs & maintenance → Repairs and Maintenance).

Exact menu names may vary by QuickBooks product and region; use the standard “Import” or “Import data” flow for Customers, Invoices, and Payments.

## Reconciliation

The **Reconciliation** tab highlights data-quality issues without blocking use:

- **Payment without statement**: A payment has no linked statement.
- **Orphaned payment**: A payment references a statement that no longer exists.
- **Unpaid or short statement**: Statement is unpaid/overdue/partial and the sum of payments is less than total due.
- **Expense missing category**: An expense has no category (assign one for accurate tax and P&L reports).

Use the **View** link next to each issue to go to Payments, Statements, or Reports to fix the data.

## Recording expenses and payouts

- **Expenses**: Use the `expenses` table to record property expenses (e.g. via Supabase dashboard, API, or a future Expenses UI). Each expense has a property, optional unit, amount, date, category, and description. Categories are seeded (Repairs & maintenance, Utilities, Insurance, etc.); you can add custom categories.
- **Payouts**: Use the `payouts` table to record payouts to the landlord (e.g. Stripe payouts). Each payout has amount, date, and status.

## Accuracy and consistency

- **Single source of truth**: Dashboard, tax report, and CSV exports use the same ledger and filters so totals match.
- **Rounding**: All amounts use two decimal places; reports and exports round consistently.
- **Permissions**: Only the logged-in landlord sees their own data; tenants do not have access to owner reports or ledger.

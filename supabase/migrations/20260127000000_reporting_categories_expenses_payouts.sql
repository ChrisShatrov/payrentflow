-- Reporting schema: categories, expenses, payouts
-- Used for accounting-grade reports, P&L, NOI, and ledger.

-- Categories (income and expense types)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_landlord_id ON categories(landlord_id);
CREATE INDEX idx_categories_type ON categories(type);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Landlords see system categories (landlord_id IS NULL) and their own
CREATE POLICY "Landlords can view categories"
  ON categories FOR SELECT
  USING (
    (landlord_id IS NULL AND is_system = true)
    OR
    (landlord_id = auth.uid() AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    ))
  );

-- Landlords can insert their own (non-system) categories
CREATE POLICY "Landlords can create own categories"
  ON categories FOR INSERT
  WITH CHECK (
    landlord_id = auth.uid()
    AND is_system = false
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Landlords can update/delete only their own
CREATE POLICY "Landlords can update own categories"
  ON categories FOR UPDATE
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete own categories"
  ON categories FOR DELETE
  USING (landlord_id = auth.uid());

-- Seed system categories (landlord_id NULL, is_system true)
INSERT INTO categories (id, landlord_id, name, type, is_system) VALUES
  (gen_random_uuid(), NULL, 'Rent', 'income', true),
  (gen_random_uuid(), NULL, 'Late fees', 'income', true),
  (gen_random_uuid(), NULL, 'Other income', 'income', true),
  (gen_random_uuid(), NULL, 'Repairs & maintenance', 'expense', true),
  (gen_random_uuid(), NULL, 'Utilities', 'expense', true),
  (gen_random_uuid(), NULL, 'Insurance', 'expense', true),
  (gen_random_uuid(), NULL, 'Property tax', 'expense', true),
  (gen_random_uuid(), NULL, 'Management', 'expense', true),
  (gen_random_uuid(), NULL, 'Other', 'expense', true);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_expenses_landlord_id ON expenses(landlord_id);
CREATE INDEX idx_expenses_property_id ON expenses(property_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view own expenses"
  ON expenses FOR SELECT
  USING (
    landlord_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Landlords can create own expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    landlord_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Landlords can update own expenses"
  ON expenses FOR UPDATE
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete own expenses"
  ON expenses FOR DELETE
  USING (landlord_id = auth.uid());

-- Payouts (e.g. Stripe payouts to landlord)
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  payout_date DATE NOT NULL,
  stripe_payout_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payouts_landlord_id ON payouts(landlord_id);
CREATE INDEX idx_payouts_payout_date ON payouts(payout_date);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view own payouts"
  ON payouts FOR SELECT
  USING (
    landlord_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Landlords can create own payouts"
  ON payouts FOR INSERT
  WITH CHECK (
    landlord_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Landlords can update own payouts"
  ON payouts FOR UPDATE
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete own payouts"
  ON payouts FOR DELETE
  USING (landlord_id = auth.uid());

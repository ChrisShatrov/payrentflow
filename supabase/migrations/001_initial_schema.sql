-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tenant')),
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create properties table
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create units table
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  tenant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  monthly_rent NUMERIC(10, 2) NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  allow_split_payment BOOLEAN DEFAULT FALSE,
  late_fee_type TEXT NOT NULL CHECK (late_fee_type IN ('flat', 'percent')) DEFAULT 'flat',
  late_fee_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(property_id, unit_number)
);

-- Create statements table
CREATE TABLE statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL, -- Format: MM/YYYY
  base_rent NUMERIC(10, 2) NOT NULL,
  additional_fees NUMERIC(10, 2) DEFAULT 0,
  late_fee NUMERIC(10, 2) DEFAULT 0,
  split_fee NUMERIC(10, 2) DEFAULT 0,
  total_due NUMERIC(10, 2) NOT NULL,
  pdf_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('paid', 'unpaid', 'overdue')) DEFAULT 'unpaid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(unit_id, period_month)
);

-- Create payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('ACH', 'Card')),
  stripe_payment_id TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  fee_amount NUMERIC(10, 2) DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('paid', 'failed', 'pending')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_properties_landlord_id ON properties(landlord_id);
CREATE INDEX idx_units_property_id ON units(property_id);
CREATE INDEX idx_units_tenant_id ON units(tenant_id);
CREATE INDEX idx_statements_unit_id ON statements(unit_id);
CREATE INDEX idx_statements_status ON statements(status);
CREATE INDEX idx_payments_unit_id ON payments(unit_id);
CREATE INDEX idx_payments_statement_id ON payments(statement_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
-- Users can create their own profile
CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for properties
-- Landlords can view their own properties
CREATE POLICY "Landlords can view own properties"
  ON properties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = properties.landlord_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Landlords can create their own properties
CREATE POLICY "Landlords can create own properties"
  ON properties FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = landlord_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Landlords can update their own properties
CREATE POLICY "Landlords can update own properties"
  ON properties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = properties.landlord_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Landlords can delete their own properties
CREATE POLICY "Landlords can delete own properties"
  ON properties FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = properties.landlord_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for units
-- Landlords can view units of their properties
CREATE POLICY "Landlords can view own units"
  ON units FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = units.property_id
      AND properties.landlord_id = auth.uid()
    )
  );

-- Tenants can view their own unit
CREATE POLICY "Tenants can view own unit"
  ON units FOR SELECT
  USING (tenant_id = auth.uid());

-- Landlords can create units in their properties
CREATE POLICY "Landlords can create units"
  ON units FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = units.property_id
      AND properties.landlord_id = auth.uid()
    )
  );

-- Landlords can update units in their properties
CREATE POLICY "Landlords can update own units"
  ON units FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = units.property_id
      AND properties.landlord_id = auth.uid()
    )
  );

-- Landlords can delete units in their properties
CREATE POLICY "Landlords can delete own units"
  ON units FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = units.property_id
      AND properties.landlord_id = auth.uid()
    )
  );

-- RLS Policies for statements
-- Landlords can view statements for their units
CREATE POLICY "Landlords can view own statements"
  ON statements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM units
      JOIN properties ON properties.id = units.property_id
      WHERE units.id = statements.unit_id
      AND properties.landlord_id = auth.uid()
    )
  );

-- Tenants can view statements for their unit
CREATE POLICY "Tenants can view own statements"
  ON statements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM units
      WHERE units.id = statements.unit_id
      AND units.tenant_id = auth.uid()
    )
  );

-- Service role can create statements (for cron jobs)
CREATE POLICY "Service role can create statements"
  ON statements FOR INSERT
  WITH CHECK (true);

-- Service role can update statements
CREATE POLICY "Service role can update statements"
  ON statements FOR UPDATE
  USING (true);

-- RLS Policies for payments
-- Landlords can view payments for their units
CREATE POLICY "Landlords can view own payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM units
      JOIN properties ON properties.id = units.property_id
      WHERE units.id = payments.unit_id
      AND properties.landlord_id = auth.uid()
    )
  );

-- Tenants can view payments for their unit
CREATE POLICY "Tenants can view own payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM units
      WHERE units.id = payments.unit_id
      AND units.tenant_id = auth.uid()
    )
  );

-- Service role can create payments (for Stripe webhooks)
CREATE POLICY "Service role can create payments"
  ON payments FOR INSERT
  WITH CHECK (true);

-- Service role can update payments
CREATE POLICY "Service role can update payments"
  ON payments FOR UPDATE
  USING (true);


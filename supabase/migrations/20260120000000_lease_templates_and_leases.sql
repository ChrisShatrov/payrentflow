-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create lease_templates table
CREATE TABLE lease_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body_html TEXT NOT NULL,
  variables_schema_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create template_versions table for version history
CREATE TABLE template_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES lease_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body_html TEXT NOT NULL,
  variables_schema_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, version)
);

-- Create leases table
CREATE TABLE leases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES lease_templates(id) ON DELETE RESTRICT,
  lease_data_json JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided')) DEFAULT 'draft',
  docusign_envelope_id TEXT,
  pdf_draft_url TEXT,
  pdf_signed_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lease_events table for audit log
CREATE TABLE lease_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('created', 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided', 'reminder_sent')),
  payload_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create docusign_integrations table for encrypted OAuth tokens
CREATE TABLE docusign_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_lease_templates_landlord_id ON lease_templates(landlord_id);
CREATE INDEX idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX idx_leases_landlord_id ON leases(landlord_id);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);
CREATE INDEX idx_leases_unit_id ON leases(unit_id);
CREATE INDEX idx_leases_template_id ON leases(template_id);
CREATE INDEX idx_leases_status ON leases(status);
CREATE INDEX idx_leases_docusign_envelope_id ON leases(docusign_envelope_id);
CREATE INDEX idx_lease_events_lease_id ON lease_events(lease_id);
CREATE INDEX idx_lease_events_type ON lease_events(type);
CREATE INDEX idx_docusign_integrations_landlord_id ON docusign_integrations(landlord_id);

-- Enable Row Level Security
ALTER TABLE lease_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE docusign_integrations ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is landlord of a property/unit
CREATE OR REPLACE FUNCTION public.landlord_owns_lease(lease_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  lease_landlord_id UUID;
BEGIN
  SELECT landlord_id INTO lease_landlord_id
  FROM public.leases
  WHERE id = lease_id_param;
  
  RETURN lease_landlord_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user is tenant of a lease
CREATE OR REPLACE FUNCTION public.tenant_owns_lease(lease_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  lease_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO lease_tenant_id
  FROM public.leases
  WHERE id = lease_id_param;
  
  RETURN lease_tenant_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RLS Policies for lease_templates
CREATE POLICY "Landlords can view own templates"
  ON lease_templates FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can create own templates"
  ON lease_templates FOR INSERT
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update own templates"
  ON lease_templates FOR UPDATE
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete own templates"
  ON lease_templates FOR DELETE
  USING (landlord_id = auth.uid());

-- RLS Policies for template_versions
CREATE POLICY "Landlords can view own template versions"
  ON template_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lease_templates
      WHERE lease_templates.id = template_versions.template_id
      AND lease_templates.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can create own template versions"
  ON template_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lease_templates
      WHERE lease_templates.id = template_versions.template_id
      AND lease_templates.landlord_id = auth.uid()
    )
  );

-- RLS Policies for leases
CREATE POLICY "Landlords can view own leases"
  ON leases FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Tenants can view own leases"
  ON leases FOR SELECT
  USING (tenant_id = auth.uid());

CREATE POLICY "Landlords can create own leases"
  ON leases FOR INSERT
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update own leases"
  ON leases FOR UPDATE
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete own leases"
  ON leases FOR DELETE
  USING (landlord_id = auth.uid());

-- Service role can update leases (for webhooks)
CREATE POLICY "Service role can update leases"
  ON leases FOR UPDATE
  USING (true);

-- RLS Policies for lease_events
CREATE POLICY "Landlords can view own lease events"
  ON lease_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases
      WHERE leases.id = lease_events.lease_id
      AND leases.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Tenants can view own lease events"
  ON lease_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases
      WHERE leases.id = lease_events.lease_id
      AND leases.tenant_id = auth.uid()
    )
  );

CREATE POLICY "Service role can create lease events"
  ON lease_events FOR INSERT
  WITH CHECK (true);

-- RLS Policies for docusign_integrations
CREATE POLICY "Landlords can view own DocuSign integration"
  ON docusign_integrations FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can create own DocuSign integration"
  ON docusign_integrations FOR INSERT
  WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update own DocuSign integration"
  ON docusign_integrations FOR UPDATE
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete own DocuSign integration"
  ON docusign_integrations FOR DELETE
  USING (landlord_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_lease_templates_updated_at
  BEFORE UPDATE ON lease_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leases_updated_at
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_docusign_integrations_updated_at
  BEFORE UPDATE ON docusign_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Encryption/Decryption helper functions for DocuSign tokens
-- Note: These use pgcrypto. In production, consider using Supabase Vault or application-level encryption
-- For now, we'll use pgcrypto with a key stored in environment (handled in Edge Functions)

-- Function to encrypt text (will be called from Edge Functions with encryption key)
-- The actual encryption will be done in application code for better security
-- This table structure supports encrypted storage, but encryption/decryption happens in Edge Functions

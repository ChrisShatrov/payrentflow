-- Create tenant_invites table to track invitations
CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  invite_token TEXT UNIQUE NOT NULL,
  landlord_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  move_in_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_invites_token ON public.tenant_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON public.tenant_invites(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_landlord ON public.tenant_invites(landlord_id);

-- Enable RLS
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Landlords can view own invites"
  ON public.tenant_invites FOR SELECT
  USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can create own invites"
  ON public.tenant_invites FOR INSERT
  WITH CHECK (landlord_id = auth.uid());

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role can manage invites"
  ON public.tenant_invites FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.tenant_invites IS 'Tracks tenant invitations sent by landlords. Used to validate invite tokens and prevent reuse.';

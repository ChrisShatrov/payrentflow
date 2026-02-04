-- Tenant notifications (e.g. "You've been assigned to Unit X") for in-app bell dropdown
CREATE TABLE IF NOT EXISTS public.tenant_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'unit_assigned',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_notifications_tenant_id ON public.tenant_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_notifications_created_at ON public.tenant_notifications(created_at DESC);

ALTER TABLE public.tenant_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own notifications"
  ON public.tenant_notifications FOR SELECT
  USING (tenant_id = auth.uid());

-- Only admins (landlords) can insert when they assign a tenant to a unit
CREATE POLICY "Admins can insert tenant notifications"
  ON public.tenant_notifications FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE public.tenant_notifications IS 'In-app notifications for tenants (e.g. unit assigned). Tenants see only their own.';

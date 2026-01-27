-- Create table to store dismissed notifications by tenants
CREATE TABLE IF NOT EXISTS public.dismissed_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL, -- The notification ID (e.g., "overdue-{statement_id}")
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, notification_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dismissed_notifications_tenant_id ON public.dismissed_notifications(tenant_id);

-- Add RLS policies
ALTER TABLE public.dismissed_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can only see their own dismissed notifications
CREATE POLICY "Tenants can view their own dismissed notifications"
  ON public.dismissed_notifications
  FOR SELECT
  USING (auth.uid() = tenant_id);

-- Policy: Tenants can insert their own dismissed notifications
CREATE POLICY "Tenants can dismiss their own notifications"
  ON public.dismissed_notifications
  FOR INSERT
  WITH CHECK (auth.uid() = tenant_id);

-- Policy: Tenants can delete their own dismissed notifications (in case they want to restore)
CREATE POLICY "Tenants can delete their own dismissed notifications"
  ON public.dismissed_notifications
  FOR DELETE
  USING (auth.uid() = tenant_id);

COMMENT ON TABLE public.dismissed_notifications IS 'Stores notification IDs that tenants have dismissed, so they never see them again';

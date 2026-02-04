-- Ledger RPC: unified income (from payments), expenses, and payouts for reporting.
-- Caller must pass landlord_id = auth.uid() so RLS is enforced via application.

CREATE OR REPLACE FUNCTION get_ledger_entries(
  p_landlord_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_property_id UUID DEFAULT NULL,
  p_unit_id UUID DEFAULT NULL,
  p_entry_types TEXT[] DEFAULT NULL  -- e.g. '{income,expense,payout}' or NULL for all
)
RETURNS TABLE (
  entry_type TEXT,
  entry_date DATE,
  amount NUMERIC,
  category_id UUID,
  category_name TEXT,
  property_id UUID,
  property_name TEXT,
  unit_id UUID,
  unit_number TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Restrict to caller's own data
  IF p_landlord_id IS NULL OR p_landlord_id != auth.uid() THEN
    RETURN;
  END IF;

  -- Income: from payments (completed or paid) on units belonging to landlord's properties
  IF p_entry_types IS NULL OR 'income' = ANY(p_entry_types) THEN
    RETURN QUERY
    SELECT
      'income'::TEXT,
      (p.paid_at AT TIME ZONE 'UTC')::DATE,
      ROUND(COALESCE(p.statement_amount, p.amount - COALESCE(p.fee_amount, 0))::NUMERIC, 2),
      NULL::UUID,
      'Rent'::TEXT,
      prop.id,
      prop.name,
      u.id,
      u.unit_number,
      u.tenant_id,
      prof.full_name,
      ('Payment ' || (p.paid_at AT TIME ZONE 'UTC')::TEXT)::TEXT,
      p.id,
      'payment'::TEXT,
      p.created_at
    FROM payments p
    JOIN units u ON u.id = p.unit_id
    JOIN properties prop ON prop.id = u.property_id
    LEFT JOIN profiles prof ON prof.id = u.tenant_id
    WHERE prop.landlord_id = p_landlord_id
      AND p.status IN ('completed', 'paid')
      AND p.paid_at IS NOT NULL
      AND (p_date_from IS NULL OR (p.paid_at AT TIME ZONE 'UTC')::DATE >= p_date_from)
      AND (p_date_to IS NULL OR (p.paid_at AT TIME ZONE 'UTC')::DATE <= p_date_to)
      AND (p_property_id IS NULL OR prop.id = p_property_id)
      AND (p_unit_id IS NULL OR u.id = p_unit_id);
  END IF;

  -- Expenses
  IF p_entry_types IS NULL OR 'expense' = ANY(p_entry_types) THEN
    RETURN QUERY
    SELECT
      'expense'::TEXT,
      e.expense_date,
      ROUND(e.amount::NUMERIC, 2),
      e.category_id,
      c.name,
      e.property_id,
      prop.name,
      e.unit_id,
      u.unit_number,
      u.tenant_id,
      prof.full_name,
      e.description,
      e.id,
      'expense'::TEXT,
      e.created_at
    FROM expenses e
    JOIN categories c ON c.id = e.category_id
    JOIN properties prop ON prop.id = e.property_id
    LEFT JOIN units u ON u.id = e.unit_id
    LEFT JOIN profiles prof ON prof.id = u.tenant_id
    WHERE e.landlord_id = p_landlord_id
      AND (p_date_from IS NULL OR e.expense_date >= p_date_from)
      AND (p_date_to IS NULL OR e.expense_date <= p_date_to)
      AND (p_property_id IS NULL OR e.property_id = p_property_id)
      AND (p_unit_id IS NULL OR e.unit_id = p_unit_id);
  END IF;

  -- Payouts (as outflow: positive amount in table, we return as positive; UI will show as negative for cashflow)
  IF p_entry_types IS NULL OR 'payout' = ANY(p_entry_types) THEN
    RETURN QUERY
    SELECT
      'payout'::TEXT,
      po.payout_date,
      ROUND(po.amount::NUMERIC, 2),
      NULL::UUID,
      'Payout'::TEXT,
      NULL::UUID,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT,
      NULL::UUID,
      NULL::TEXT,
      ('Payout ' || po.status)::TEXT,
      po.id,
      'payout'::TEXT,
      po.created_at
    FROM payouts po
    WHERE po.landlord_id = p_landlord_id
      AND (p_date_from IS NULL OR po.payout_date >= p_date_from)
      AND (p_date_to IS NULL OR po.payout_date <= p_date_to);
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION get_ledger_entries IS 'Unified ledger for reporting: income from payments, expenses, payouts. Call with landlord_id = auth.uid().';

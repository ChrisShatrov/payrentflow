-- Add DELETE policy for leases table
DROP POLICY IF EXISTS "Landlords can delete own leases" ON leases;

CREATE POLICY "Landlords can delete own leases"
  ON leases FOR DELETE
  USING (landlord_id = auth.uid());

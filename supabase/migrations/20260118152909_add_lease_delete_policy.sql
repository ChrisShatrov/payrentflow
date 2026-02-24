-- Add DELETE policy for leases table (runs before 20260120000000 which creates leases, so only run if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leases') THEN
    DROP POLICY IF EXISTS "Landlords can delete own leases" ON leases;
    CREATE POLICY "Landlords can delete own leases"
      ON leases FOR DELETE
      USING (landlord_id = auth.uid());
  END IF;
END $$;

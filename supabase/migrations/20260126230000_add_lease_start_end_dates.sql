-- Add start_date and end_date to leases for reminder queries and display
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Backfill from lease_data_json (ISO YYYY-MM-DD or US M/D/YYYY)
DO $$
DECLARE
  r RECORD;
  sd TEXT;
  ed TEXT;
  parts TEXT[];
BEGIN
  FOR r IN SELECT id, lease_data_json, start_date AS cur_start, end_date AS cur_end FROM leases
  LOOP
    sd := r.lease_data_json->>'lease_start_date';
    ed := r.lease_data_json->>'lease_end_date';
    IF sd IS NOT NULL AND r.cur_start IS NULL THEN
      BEGIN
        IF sd ~ '^\d{4}-\d{2}-\d{2}' THEN
          UPDATE leases SET start_date = (regexp_match(sd, '^(\d{4}-\d{2}-\d{2})'))[1]::date WHERE id = r.id;
        ELSIF sd ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
          parts := string_to_array(sd, '/');
          UPDATE leases SET start_date = (parts[3] || '-' || lpad(parts[1], 2, '0') || '-' || lpad(parts[2], 2, '0'))::date WHERE id = r.id;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
    IF ed IS NOT NULL AND r.cur_end IS NULL THEN
      BEGIN
        IF ed ~ '^\d{4}-\d{2}-\d{2}' THEN
          UPDATE leases SET end_date = (regexp_match(ed, '^(\d{4}-\d{2}-\d{2})'))[1]::date WHERE id = r.id;
        ELSIF ed ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
          parts := string_to_array(ed, '/');
          UPDATE leases SET end_date = (parts[3] || '-' || lpad(parts[1], 2, '0') || '-' || lpad(parts[2], 2, '0'))::date WHERE id = r.id;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_leases_start_date ON leases(start_date);
CREATE INDEX IF NOT EXISTS idx_leases_end_date ON leases(end_date);
CREATE INDEX IF NOT EXISTS idx_leases_status_end_date ON leases(status, end_date);

-- Schedule monthly statement generation using pg_cron
-- Runs daily at 2 AM UTC to check if statements need to be generated (5 days before due date)
-- 
-- IMPORTANT: This migration requires:
-- 1. pg_cron extension to be enabled in Supabase (may need to enable in dashboard)
-- 2. pg_net extension for HTTP requests (may need to enable in dashboard)
-- 3. Service role key - Get it from: Supabase Dashboard > Settings > API > service_role key
--    Replace 'YOUR_SERVICE_ROLE_KEY' below with your actual key before running
--
-- Alternative: Use external cron service (cron-job.org, GitHub Actions, etc.) to call:
-- POST https://heismaqehgqxcrndtqmz.supabase.co/functions/v1/generate-monthly-statements
-- Headers: Authorization: Bearer <SERVICE_ROLE_KEY>

-- Enable pg_cron extension (if available)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not available. Use external cron service instead.';
END $$;

-- Enable pg_net extension for HTTP requests (if available)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_net extension not available. Use external cron service instead.';
END $$;

-- Schedule the job (only if extensions are available)
-- Note: For Supabase, you may need to use the anon key or service role key from vault
-- See: https://supabase.com/docs/guides/functions/schedule-functions
-- 
-- IMPORTANT: Before running this, replace 'YOUR_SERVICE_ROLE_KEY' with your actual service role key
-- You can find it in: Supabase Dashboard > Settings > API > service_role key

DO $$
BEGIN
  -- Check if extensions are available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    
    -- Unschedule existing job if it exists (ignore error if doesn't exist)
    BEGIN
      PERFORM cron.unschedule('generate-monthly-statements');
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- Job doesn't exist, that's fine
    END;
    
    -- Schedule new job
    -- The command is a SQL statement that will be executed by the cron job
    PERFORM cron.schedule(
      'generate-monthly-statements',
      '0 2 * * *', -- Daily at 2 AM UTC
      'select net.http_post(
        ''https://heismaqehgqxcrndtqmz.supabase.co/functions/v1/generate-monthly-statements'',
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          ''Authorization'', ''Bearer YOUR_SERVICE_ROLE_KEY''
        ),
        body := ''{}''::jsonb
      ) as request_id;'
    );
    
    RAISE NOTICE 'Scheduled generate-monthly-statements to run daily at 2 AM UTC';
    RAISE NOTICE 'IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY with actual service role key before running';
  ELSE
    RAISE NOTICE 'pg_cron or pg_net not available. Please use external cron service instead.';
    RAISE NOTICE 'See migration comments for external cron setup instructions.';
  END IF;
END $$;

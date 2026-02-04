-- Schedule lease reminder job (lease needs signing, lease about to expire)
-- Runs daily at 3 AM UTC. Requires pg_cron and pg_net (see schedule_monthly_statements).
-- Replace YOUR_SERVICE_ROLE_KEY and PROJECT_REF with your Supabase project values.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    BEGIN
      PERFORM cron.unschedule('schedule-lease-reminders');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'schedule-lease-reminders',
      '0 3 * * *',
      'select net.http_post(
        ''https://PROJECT_REF.supabase.co/functions/v1/schedule-lease-reminders'',
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          ''Authorization'', ''Bearer YOUR_SERVICE_ROLE_KEY''
        ),
        body := ''{}''::jsonb
      ) as request_id;'
    );

    RAISE NOTICE 'Scheduled schedule-lease-reminders to run daily at 3 AM UTC';
    RAISE NOTICE 'Replace PROJECT_REF and YOUR_SERVICE_ROLE_KEY before running';
  ELSE
    RAISE NOTICE 'pg_cron or pg_net not available. Use external cron to POST to schedule-lease-reminders';
  END IF;
END $$;

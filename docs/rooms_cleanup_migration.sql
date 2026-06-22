-- Server-side cleanup for stale Watch Together rooms
-- Run once in Supabase → SQL Editor
--
-- 1. Database → Extensions → enable "pg_cron" (if not already on)
-- 2. Run this entire script

CREATE OR REPLACE FUNCTION public.cleanup_stale_party_rooms(retention_hours integer DEFAULT 12)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.rooms
  WHERE scheduled_start_time < NOW() - (retention_hours || ' hours')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_party_rooms(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_party_rooms(integer) TO service_role;

-- One-time cleanup of rooms already older than 12 hours
SELECT public.cleanup_stale_party_rooms(12) AS deleted_now;

-- Hourly cleanup (remove old job first if re-running this script)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'cleanup-stale-party-rooms';

SELECT cron.schedule(
  'cleanup-stale-party-rooms',
  '0 * * * *',
  $$SELECT public.cleanup_stale_party_rooms(12);$$
);
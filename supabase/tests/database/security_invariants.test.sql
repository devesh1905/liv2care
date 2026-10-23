-- Security rules that must hold for the whole database, so a future migration cannot quietly break them:
-- row-level security everywhere, no browser access to server-only tables and functions, a private report bucket,
-- and security-definer functions that cannot be tricked through the search path.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- ---------- row-level security and table rights ----------
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'row-level security is on for every table in public');

select is(
  (select count(*)::int from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'),
  0, 'the anonymous role has no rights on any table');

select is(
  (select count(*)::int
   from (values ('journeys'), ('journey_events'), ('patients'), ('consents'), ('decisions'), ('messages'), ('tasks'),
                ('bookings'), ('booking_links'), ('ai_usage'), ('profiles'), ('partners')) t(name)
   where has_table_privilege('authenticated', 'public.' || t.name, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || t.name, 'UPDATE')
      or has_table_privilege('authenticated', 'public.' || t.name, 'DELETE')),
  0, 'signed-in users cannot write the tables that only the server writes');

select is(
  (select count(*)::int
   from (values ('booking_links'), ('ai_usage'), ('patient_contacts'), ('home_visits')) t(name), (values ('anon'), ('authenticated')) r(role)
   where has_table_privilege(r.role, 'public.' || t.name, 'SELECT')),
  0, 'link hashes and AI usage counters cannot be read by the browser roles at all');

select is(has_table_privilege('anon', 'public.journey_status', 'SELECT'), false, 'anonymous users cannot read the status view');
select is(has_table_privilege('anon', 'public.kpi_summary', 'SELECT'), false, 'anonymous users cannot read the KPI view');

-- ---------- functions ----------
select is(
  (select count(*)::int from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('start_journey', 'apply_journey_event', 'log_journey_event', 'log_report_access',
                       'issue_booking_link', 'resolve_booking_link', 'ai_consume')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  0, 'the server-only functions cannot be called with the browser roles');

select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '') from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
     and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname not in ('current_app_role', 'current_partner_id', 'is_journey_doctor', 'clinician_can_review',
                           'can_read_clinical', 'partner_serves', 'can_see_patient', 'can_upload_report_path',
                           'can_read_report_file')),
  '', 'signed-in users can call only the access-check helpers');

select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '') from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')),
  '', 'anonymous users can call no function in public');

select is(
  (select count(*)::int from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')),
  0, 'every security-definer function pins its search path');

-- ---------- report storage ----------
select is((select public from storage.buckets where id = 'reports'), false, 'the reports bucket is private');
select is((select file_size_limit from storage.buckets where id = 'reports'), 5242880::bigint, 'report files are limited to 5 MB');
select is((select allowed_mime_types from storage.buckets where id = 'reports'), array['application/pdf'], 'only PDF files are accepted');

-- ---------- the audit table ----------
select is(
  (select count(*)::int from pg_trigger t where t.tgrelid = 'public.journey_events'::regclass and not t.tgisinternal),
  2, 'the audit table has its two insert-only guards (rows and truncate)');
select is(
  (select count(*)::int from pg_trigger t where t.tgrelid = 'public.journeys'::regclass and not t.tgisinternal and t.tgname = 'journeys_stage_guard'),
  1, 'the stage guard trigger is in place');

select * from finish();
rollback;

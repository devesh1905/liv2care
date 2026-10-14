-- Option 1 where the patient sends the existing report: the journey waits at stage 0, then PATIENT_UPLOAD moves it to the
-- clinician's queue and the report is recorded against the treating doctor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

set local role service_role;

do $$ begin
  perform set_config('t.j', public.start_journey(gen_random_uuid(), 'P-9201', 'Upload Person', 52::smallint, '98•••• 2222', 'en', 'existing_report', false,
      '00000000-0000-4000-8000-000000000001', 'consent')::text, true);
end $$;

select is((select stage from public.journeys where id = current_setting('t.j')::uuid), 0::smallint, 'an existing-report journey without a file waits at the first stage');
select is((select count(*)::int from public.reports where journey_id = current_setting('t.j')::uuid), 0, 'no report yet');

select lives_ok(
  $$select public.apply_journey_event(current_setting('t.j')::uuid, 'PATIENT_UPLOAD', 0::smallint, false, 2::smallint, false, null, 'patient',
      '{}'::jsonb, null, null, null,
      '{"kind":"lab","partner_id":null,"storage_path":"journeys/x/patient-1.pdf","file_name":"report.pdf"}'::jsonb,
      '{"owner":"Clinician","description":"Review and write the summary","hours":24}'::jsonb)$$,
  'the patient upload moves the journey on');
select is((select stage from public.journeys where id = current_setting('t.j')::uuid), 2::smallint, 'the journey is now in the clinician''s queue');
select is(
  (select uploaded_by from public.reports where journey_id = current_setting('t.j')::uuid),
  '00000000-0000-4000-8000-000000000001'::uuid, 'the report is recorded against the treating doctor');
select ok(
  (select detail ? 'report_id' from public.journey_events where journey_id = current_setting('t.j')::uuid and event = 'PATIENT_UPLOAD' and actor_role = 'patient'),
  'the audit row says the patient sent it');
select is((select owner from public.tasks where journey_id = current_setting('t.j')::uuid and done_at is null), 'Clinician', 'the pending action is the clinician''s');

select * from finish();
rollback;

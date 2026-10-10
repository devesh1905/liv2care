-- The transition functions: service role only, atomic, audited, optimistic.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- P-1001 is at stage 3 (clinician reviewed), waiting for the doctor.
do $$ begin perform set_config('t.j1', (select j.id::text from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-1001'), true); end $$;

set local role service_role;
select is(
  (select stage from public.journeys where id = current_setting('t.j1')::uuid), 3::smallint, 'starts at stage 3');

select lives_ok(
  $$select public.apply_journey_event(current_setting('t.j1')::uuid, 'APPROVE_VCTE', 3::smallint, false, 4::smallint, false,
      '00000000-0000-4000-8000-000000000001', 'doctor', '{}'::jsonb, null, null, null, null, null, null, '{"kind":"vcte_approve"}'::jsonb)$$,
  'service role applies a move');
select is((select stage from public.journeys where id = current_setting('t.j1')::uuid), 4::smallint, 'stage moved');
select is(
  (select count(*)::int from public.journey_events where journey_id = current_setting('t.j1')::uuid and event = 'APPROVE_VCTE' and from_stage = 3 and to_stage = 4),
  1, 'the move wrote one audit row');
select throws_ok(
  $$select public.apply_journey_event(current_setting('t.j1')::uuid, 'APPROVE_VCTE', 3::smallint, false, 4::smallint, false,
      '00000000-0000-4000-8000-000000000001', 'doctor', '{}'::jsonb, null, null, null, null, null, null, '{"kind":"vcte_approve"}'::jsonb)$$,
  '40001', null, 'a stale move is rejected');
select is(
  (select count(*)::int from public.journey_events where journey_id = current_setting('t.j1')::uuid and event = 'APPROVE_VCTE'),
  1, 'the rejected move wrote nothing');

select lives_ok(
  $$select public.apply_journey_event(current_setting('t.j1')::uuid, 'MARK_MISSED', 4::smallint, false, 4::smallint, true,
      null, 'ops', '{}'::jsonb)$$,
  'the missed flag moves through the same function');
select ok((select missed from public.journeys where id = current_setting('t.j1')::uuid), 'missed flag set');

-- Starting a journey needs the doctor and a consent.
select throws_ok(
  $$select public.start_journey(gen_random_uuid(), 'P-9001', 'Test Person', 40::smallint, '98•••• 0000', 'en', 'order_tests', false,
      '00000000-0000-4000-8000-000000000002', 'consent')$$,
  '42501', null, 'only the doctor starts a journey');
select throws_ok(
  $$select public.start_journey(gen_random_uuid(), 'P-9001', 'Test Person', 40::smallint, '98•••• 0000', 'en', 'order_tests', false,
      '00000000-0000-4000-8000-000000000001', '')$$,
  '23514', null, 'a journey needs consent');
select lives_ok(
  $$select public.start_journey(gen_random_uuid(), 'P-9001', 'Test Person', 40::smallint, '98•••• 0000', 'en', 'existing_report', false,
      '00000000-0000-4000-8000-000000000001', 'Pathway and report sharing',
      '{"storage_path":"intake/x/r.pdf","file_name":"r.pdf"}'::jsonb)$$,
  'doctor starts a journey with consent');
select is(
  (select stage from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-9001'), 2::smallint,
  'an existing-report journey starts at report received');

select throws_ok(
  $$select public.start_journey(gen_random_uuid(), 'P-9002', 'Test Person', 40::smallint, '98•••• 0000', 'en', 'existing_report', false,
      '00000000-0000-4000-8000-000000000001', 'Pathway and report sharing')$$,
  '23514', null, 'the existing-report route needs a report');

select * from finish();
rollback;

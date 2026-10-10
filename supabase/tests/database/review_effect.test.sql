-- The clinician's review is created with the stage change, needs typed text, and never reaches the audit row.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- P-1004 is at stage 2 (lab report received) and unassigned.
do $$ begin perform set_config('t.j', (select j.id::text from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-1004'), true); end $$;

set local role service_role;

select throws_ok(
  $$select public.apply_journey_event(current_setting('t.j')::uuid, 'CLINICIAN_SUBMIT', 2::smallint, false, 3::smallint, false,
      '00000000-0000-4000-8000-000000000002', 'clinician')$$,
  '23514', null, 'a clinician submission without a review is refused');
select throws_ok(
  $$select public.apply_journey_event(current_setting('t.j')::uuid, 'CLINICIAN_SUBMIT', 2::smallint, false, 3::smallint, false,
      '00000000-0000-4000-8000-000000000002', 'clinician', '{}'::jsonb, null, null, null, null, null,
      '{"fib4_text":"  ","summary":"typed"}'::jsonb)$$,
  '23514', null, 'a blank FIB-4 text is refused');
select is((select stage from public.journeys where id = current_setting('t.j')::uuid), 2::smallint, 'the refused submissions changed nothing');

select lives_ok(
  $$select public.apply_journey_event(current_setting('t.j')::uuid, 'CLINICIAN_SUBMIT', 2::smallint, false, 3::smallint, false,
      '00000000-0000-4000-8000-000000000002', 'clinician', '{"recommends_vcte":true}'::jsonb, null, null, null, null,
      '{"owner":"Doctor","description":"Decide on FibroScan","hours":24}'::jsonb,
      '{"fib4_text":"2.5","summary":"Typed by the clinician SECRETWORD","recommends_vcte":true}'::jsonb)$$,
  'a typed review is accepted');
select is((select stage from public.journeys where id = current_setting('t.j')::uuid), 3::smallint, 'the journey moved to reviewed');
select is((select clinician_id::text from public.journeys where id = current_setting('t.j')::uuid), '00000000-0000-4000-8000-000000000002', 'the clinician is recorded on the journey');
select is(
  (select count(*)::int from public.reviews where journey_id = current_setting('t.j')::uuid and fib4_text = '2.5' and recommends_vcte and report_id is not null),
  1, 'one review row, linked to the lab report');
select is(
  (select count(*)::int from public.journey_events where journey_id = current_setting('t.j')::uuid and detail::text like '%SECRETWORD%'),
  0, 'the audit rows carry no clinical text');

select throws_ok(
  $$select public.apply_journey_event(current_setting('t.j')::uuid, 'APPROVE_VCTE', 3::smallint, false, 4::smallint, false,
      '00000000-0000-4000-8000-000000000001', 'doctor', '{}'::jsonb, null, null, null, null, null,
      '{"fib4_text":"1","summary":"x"}'::jsonb, '{"kind":"vcte_approve"}'::jsonb)$$,
  '23514', null, 'no other event may carry a review');

select * from finish();
rollback;

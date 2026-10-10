-- The treating doctor's decisions are saved with the stage change, must match the event, and keep the audit row clean.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- P-1001 is at stage 3 (clinician reviewed); P-1006 is at stage 6 (FibroScan report received).
do $$ begin
  perform set_config('t.a', (select j.id::text from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-1001'), true);
  perform set_config('t.b', (select j.id::text from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-1006'), true);
end $$;

set local role service_role;

-- ---- approve ----
select throws_ok(
  $$select public.apply_journey_event(current_setting('t.a')::uuid, 'APPROVE_VCTE', 3::smallint, false, 4::smallint, false,
      '00000000-0000-4000-8000-000000000001', 'doctor')$$,
  '23514', null, 'an approval without a decision record is refused');
select throws_ok(
  $$select public.apply_journey_event(current_setting('t.a')::uuid, 'APPROVE_VCTE', 3::smallint, false, 4::smallint, false,
      '00000000-0000-4000-8000-000000000001', 'doctor', '{}'::jsonb, null, null, null, null, null, null, '{"kind":"vcte_decline","reason":"Cost or access"}'::jsonb)$$,
  '23514', null, 'a decision of the wrong kind is refused');
select is((select stage from public.journeys where id = current_setting('t.a')::uuid), 3::smallint, 'the refused decisions changed nothing');

select lives_ok(
  $$select public.apply_journey_event(current_setting('t.a')::uuid, 'APPROVE_VCTE', 3::smallint, false, 4::smallint, false,
      '00000000-0000-4000-8000-000000000001', 'doctor', '{}'::jsonb, null, null, null, null, null, null, '{"kind":"vcte_approve"}'::jsonb)$$,
  'an approval with its decision record is accepted');
select is((select count(*)::int from public.decisions where journey_id = current_setting('t.a')::uuid and kind = 'vcte_approve'), 1, 'the approval is on record');

-- ---- a next step: routine follow-up books the clinic straight away ----
select lives_ok(
  $$select public.apply_journey_event(current_setting('t.b')::uuid, 'CHOOSE_NEXT_STEP', 6::smallint, false, 8::smallint, false,
      '00000000-0000-4000-8000-000000000001', 'doctor', '{"step":"routine","months":12}'::jsonb, 'routine', null,
      '{"partner_id":"00000000-0000-4000-8000-0000000000e1","kind":"routine","slot_label":"In 12 months"}'::jsonb, null,
      '{"owner":"Clinic","description":"Mark the visit attended","hours":24}'::jsonb, null,
      '{"kind":"next_step","next_step":"routine","follow_up_months":12}'::jsonb)$$,
  'routine follow-up with a booking and a decision');
select is((select stage from public.journeys where id = current_setting('t.b')::uuid), 8::smallint, 'the journey is at follow-up booked');
select is((select next_step::text from public.journeys where id = current_setting('t.b')::uuid), 'routine', 'the next step is on the journey');
select is(
  (select follow_up_months::int from public.decisions where journey_id = current_setting('t.b')::uuid and kind = 'next_step'), 12,
  'the follow-up months are on record');
select is((select slot_label from public.bookings where journey_id = current_setting('t.b')::uuid and kind = 'routine'), 'In 12 months', 'the follow-up booking exists');

-- ---- the audit rows carry the step and months only ----
select is(
  (select count(*)::int from public.journey_events where journey_id = current_setting('t.b')::uuid and event = 'CHOOSE_NEXT_STEP'
     and detail = '{"step":"routine","months":12}'::jsonb), 1, 'the audit row has logistics only');

-- ---- other events cannot carry a decision ----
select throws_ok(
  $$select public.apply_journey_event(current_setting('t.b')::uuid, 'MARK_ATTENDED', 8::smallint, false, 9::smallint, false,
      '00000000-0000-4000-8000-000000000001', 'doctor', '{}'::jsonb, null, null, null, null, null, null, '{"kind":"vcte_approve"}'::jsonb)$$,
  '23514', null, 'an attendance record cannot carry a decision');

reset role;
select * from finish();
rollback;

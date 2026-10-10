-- Side effects of a transition (booking, slot, report, pending action) and report storage rules.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Journey P-1002 starts at stage 0 (tests ordered). Lab a1 is Sunrise Diagnostics.
do $$ begin
  perform set_config('t.j', (select j.id::text from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-1002'), true);
  perform set_config('t.s1', (select id::text from public.slots where partner_id = '00000000-0000-4000-8000-0000000000a1' order by starts_at limit 1), true);
  perform set_config('t.s2', (select id::text from public.slots where partner_id = '00000000-0000-4000-8000-0000000000a1' order by starts_at offset 1 limit 1), true);
end $$;

set local role service_role;

-- ---- BOOK takes the slot, makes a booking, replaces the pending action ----
select lives_ok(
  $$select public.apply_journey_event(current_setting('t.j')::uuid, 'BOOK', 0::smallint, false, 1::smallint, false, null, 'patient',
      '{}'::jsonb, null, null,
      jsonb_build_object('partner_id', '00000000-0000-4000-8000-0000000000a1', 'slot_id', current_setting('t.s1'), 'kind', 'lab', 'slot_label', 'Tomorrow 9:00 am'),
      null,
      '{"owner":"Lab","description":"Upload the report","hours":24}'::jsonb)$$,
  'BOOK with a slot');
select ok((select taken from public.slots where id = current_setting('t.s1')::uuid), 'the slot is taken');
select is((select count(*)::int from public.bookings where journey_id = current_setting('t.j')::uuid and status = 'booked'), 1, 'one live booking');
select is((select count(*)::int from public.tasks where journey_id = current_setting('t.j')::uuid and done_at is null), 1, 'one open pending action');
select is((select owner from public.tasks where journey_id = current_setting('t.j')::uuid and done_at is null), 'Lab', 'the pending action is the lab''s');

-- ---- the same slot cannot be booked twice ----
do $$ begin
  perform set_config('t.j2', public.start_journey(gen_random_uuid(), 'P-9101', 'Second Person', 41::smallint, '98•••• 1111', 'en', 'order_tests', false,
      '00000000-0000-4000-8000-000000000001', 'consent')::text, true);
end $$;
select throws_ok(
  $$select public.apply_journey_event(current_setting('t.j2')::uuid, 'BOOK', 0::smallint, false, 1::smallint, false, null, 'patient',
      '{}'::jsonb, null, null,
      jsonb_build_object('partner_id', '00000000-0000-4000-8000-0000000000a1', 'slot_id', current_setting('t.s1'), 'kind', 'lab', 'slot_label', 'x'))$$,
  '23505', null, 'a taken slot is refused');
select is((select stage from public.journeys where id = current_setting('t.j2')::uuid), 0::smallint, 'the refused booking changed nothing');

-- ---- missed, then reschedule frees the old slot ----
select lives_ok(
  $$select public.apply_journey_event(current_setting('t.j')::uuid, 'MARK_MISSED', 1::smallint, false, 1::smallint, true, null, 'ops')$$,
  'MARK_MISSED');
select is((select status::text from public.bookings where journey_id = current_setting('t.j')::uuid), 'missed', 'the booking is marked missed');
select lives_ok(
  $$select public.apply_journey_event(current_setting('t.j')::uuid, 'RESCHEDULE', 1::smallint, true, 1::smallint, false, null, 'patient',
      '{}'::jsonb, null, null,
      jsonb_build_object('partner_id', '00000000-0000-4000-8000-0000000000a1', 'slot_id', current_setting('t.s2'), 'kind', 'lab', 'slot_label', 'Tomorrow 11:30 am'))$$,
  'RESCHEDULE to another slot');
select ok(not (select taken from public.slots where id = current_setting('t.s1')::uuid), 'the old slot is free again');
select ok((select taken from public.slots where id = current_setting('t.s2')::uuid), 'the new slot is taken');
select is((select count(*)::int from public.bookings where journey_id = current_setting('t.j')::uuid and status = 'booked'), 1, 'one live booking after reschedule');

-- ---- the lab uploads: report row, booking attended, stage 2, audit row carries the report id ----
select lives_ok(
  $$select public.apply_journey_event(current_setting('t.j')::uuid, 'LAB_UPLOAD', 1::smallint, false, 2::smallint, false,
      '00000000-0000-4000-8000-000000000003', 'lab', '{}'::jsonb, null, null, null,
      '{"kind":"lab","partner_id":"00000000-0000-4000-8000-0000000000a1","storage_path":"journeys/x/r.pdf","file_name":"r.pdf","lab_values":{"platelets":200}}'::jsonb,
      '{"owner":"Clinician","description":"Review and write the summary","hours":24}'::jsonb)$$,
  'LAB_UPLOAD with a report');
select is((select count(*)::int from public.reports where journey_id = current_setting('t.j')::uuid), 1, 'the report row exists');
select is((select status::text from public.bookings where journey_id = current_setting('t.j')::uuid and status <> 'cancelled'), 'attended', 'the visit is attended');
select ok(
  (select detail ? 'report_id' and not (detail ? 'lab_values') from public.journey_events
   where journey_id = current_setting('t.j')::uuid and event = 'LAB_UPLOAD'),
  'the audit row names the report and carries no values');
reset role;

-- ---- report storage ----
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true); end $$;
set local role authenticated;
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('reports', 'intake/00000000-0000-4000-8000-000000000001/a.pdf', auth.uid()::text)$$,
  'doctor can upload an existing report to their own intake folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('reports', 'intake/00000000-0000-4000-8000-000000000099/a.pdf', auth.uid()::text)$$,
  '42501', null, 'doctor cannot write into someone else''s intake folder');
reset role;

do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'reports'), 0, 'ops cannot read report files');
reset role;

select * from finish();
rollback;

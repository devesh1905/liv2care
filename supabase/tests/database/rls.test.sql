-- RLS tests: each role sees only what it should. Run with `npm run test:db` (needs the local Supabase stack).
-- Seed users: 1 doctor, 2 clinician, 3 lab (Sunrise), 4 centre (Hepatic Imaging), 5 ops.
begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

-- Baseline as the table owner: the seed has six patients, seven reports, four reviews.
select is((select count(*)::int from public.journeys), 6, 'seed: six journeys');
select is((select count(*)::int from public.reports), 7, 'seed: seven reports');
select is((select count(*)::int from public.reviews), 4, 'seed: four reviews');

do $$ begin perform set_config('t.j2', (select j.id::text from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-1002'), true); end $$;

-- ============ anonymous ============
set local role anon;
select throws_ok('select * from public.patients', '42501', null, 'anon cannot read patients');
select throws_ok('select * from public.journey_status', '42501', null, 'anon cannot read journey_status');
reset role;

-- ============ treating doctor ============
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.journeys), 6, 'doctor: sees own journeys');
select is((select count(*)::int from public.patients), 6, 'doctor: sees own patients');
select is((select count(*)::int from public.reports), 7, 'doctor: reads reports');
select is((select count(*)::int from public.reviews), 4, 'doctor: reads reviews');
select is((select count(*)::int from public.decisions), 4, 'doctor: reads decisions');
select is((select count(*)::int from public.journey_status), 6, 'doctor: dashboard view');
select throws_ok($$insert into public.reports (journey_id, kind, uploaded_by, storage_path, file_name)
  select id, 'lab', auth.uid(), 'x', 'x.pdf' from public.journeys limit 1$$, '42501', null, 'doctor cannot upload reports');
select throws_ok($$update public.journeys set stage = 9$$, '42501', null, 'doctor cannot write the stage');
select throws_ok($$delete from public.journey_events$$, '42501', null, 'doctor cannot delete audit rows');
select throws_ok($$insert into public.journey_events (journey_id, actor_role, event) select id, 'doctor', 'X' from public.journeys limit 1$$,
  '42501', null, 'doctor cannot write audit rows directly');
select throws_ok($$insert into public.journeys (patient_id, doctor_id, route, stage) select id, auth.uid(), 'order_tests', 0 from public.patients limit 1$$,
  '42501', null, 'journeys are created only through start_journey');
select throws_ok($$select public.apply_journey_event(id, 'X', 0::smallint, false, 1::smallint, false, auth.uid(), 'doctor') from public.journeys limit 1$$,
  '42501', null, 'doctor cannot call the transition function');
reset role;

-- ============ telemedicine clinician ============
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.journeys), 5, 'clinician: queue (P-1004) plus journeys they reviewed');
select is((select count(*)::int from public.journeys where stage = 0), 0, 'clinician: does not see journeys that have no report yet');
select is((select count(*)::int from public.reviews), 4, 'clinician: reads reviews');
select is((select count(*)::int from public.reports), 7, 'clinician: reads reports of journeys in scope');
select is((select count(*)::int from public.decisions), 0, 'clinician: no doctor decisions');
select is((select count(*)::int from public.messages), 0, 'clinician: no messages');
select is((select count(*)::int from public.journey_status), 0, 'clinician: no dashboard view');
select throws_ok($$update public.reviews set summary = 'changed'$$, '42501', null, 'clinician cannot edit a sent review');
reset role;

-- ============ lab (Sunrise Diagnostics) ============
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.journeys), 5, 'lab: only journeys booked at its own lab');
select is((select count(*)::int from public.patients where code = 'P-1002'), 0, 'lab: cannot see a patient it has no booking for');
select is((select count(*)::int from public.reviews), 0, 'lab: cannot read reviews');
select is((select count(*)::int from public.reports where kind = 'fibroscan'), 0, 'lab: cannot read FibroScan reports');
select is((select count(*)::int from public.decisions), 0, 'lab: cannot read decisions');
select is((select count(*)::int from public.messages), 0, 'lab: cannot read messages');
select is((select count(*)::int from public.journey_events), 0, 'lab: cannot read the audit log');
select is((select count(*)::int from public.journey_status), 0, 'lab: no dashboard view');
select lives_ok($$insert into public.reports (journey_id, kind, uploaded_by, partner_id, storage_path, file_name)
  select j.id, 'lab', auth.uid(), public.current_partner_id(), 'x', 'x.pdf'
  from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-1004'$$, 'lab: can upload for a journey booked with it');
select throws_ok($$insert into public.reports (journey_id, kind, uploaded_by, partner_id, storage_path, file_name)
  select current_setting('t.j2')::uuid, 'lab', auth.uid(), public.current_partner_id(), 'x', 'x.pdf'$$,
  '42501', null, 'lab: cannot upload for a patient with no booking');
select throws_ok($$insert into public.reports (journey_id, kind, uploaded_by, partner_id, storage_path, file_name)
  select j.id, 'fibroscan', auth.uid(), public.current_partner_id(), 'x', 'x.pdf'
  from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-1004'$$,
  '42501', null, 'lab: cannot upload a FibroScan report');
select is((select count(*)::int from public.slots where partner_id = public.current_partner_id()), 9, 'lab: sees its own slots');
select lives_ok($$update public.slots set taken = true where partner_id = public.current_partner_id()$$, 'lab: manages its own slots');
select is((select count(*)::int from public.slots where taken and partner_id <> public.current_partner_id()), 0, 'lab: slot update did not touch other partners');
reset role;
select is((select count(*)::int from public.slots where taken and partner_id <> '00000000-0000-4000-8000-0000000000a1'), 0, 'lab: other partners slots unchanged (checked as owner)');

-- ============ diagnostic centre (Hepatic Imaging Centre) ============
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.journeys), 1, 'centre: only journeys booked at its own centre');
select is((select count(*)::int from public.reviews), 0, 'centre: cannot read reviews');
select is((select count(*)::int from public.reports where kind = 'lab'), 0, 'centre: cannot read lab reports');
reset role;

-- ============ operations ============
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.journey_status), 6, 'ops: sees every journey through journey_status');
select is((select count(*)::int from public.journeys), 0, 'ops: no direct access to journeys');
select is((select count(*)::int from public.reports), 0, 'ops: cannot read reports');
select is((select count(*)::int from public.reviews), 0, 'ops: cannot read reviews');
select is((select count(*)::int from public.decisions), 0, 'ops: cannot read decisions');
select ok((select count(*) from public.journey_events) > 0, 'ops: reads the audit log');
select ok((select count(*) from public.messages) > 0, 'ops: reads the message log');
select ok((select count(*) from public.tasks) > 0, 'ops: reads pending actions');
reset role;
select hasnt_column('public', 'journey_status', 'decline_reason', 'journey_status has no decline reason');
select hasnt_column('public', 'journey_status', 'lab_values', 'journey_status has no lab values');

-- ============ audit table and stage guard (checked as the table owner) ============
select throws_ok($$update public.journey_events set event = 'X'$$, '42501', 'journey_events is insert-only', 'audit rows cannot be updated');
select throws_ok($$delete from public.journey_events$$, '42501', 'journey_events is insert-only', 'audit rows cannot be deleted');
select throws_ok($$update public.journeys set stage = 9$$, '42501', null, 'stage cannot change outside a transition');

select * from finish();
rollback;

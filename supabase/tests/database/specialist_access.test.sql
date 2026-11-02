-- The specialist (seed user 6, at the hepatology site d1) sees only patients referred to their own site: the reports and the
-- clinician's notes for those, nothing else. Run with `npm run test:db` (needs the local Supabase stack).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- As the table owner: refer P-1006 to the specialist's site, and note how many reports and reviews that journey has.
do $$
declare v_journey uuid;
begin
  select j.id into v_journey from public.journeys j join public.patients p on p.id = j.patient_id where p.code = 'P-1006';
  insert into public.bookings (journey_id, partner_id, kind, status, slot_label)
  values (v_journey, '00000000-0000-4000-8000-0000000000d1', 'specialist', 'booked', 'Tomorrow 11:30 am');
  perform set_config('t.j', v_journey::text, true);
  perform set_config('t.reports', (select count(*)::text from public.reports where journey_id = v_journey), true);
  perform set_config('t.reviews', (select count(*)::text from public.reviews where journey_id = v_journey), true);
end $$;

select ok(current_setting('t.reports')::int > 0, 'seed: the referred journey has reports');
select throws_ok($$update public.profiles set partner_id = null where id = '00000000-0000-4000-8000-000000000006'$$, '23514', null,
  'profiles: a specialist must belong to a specialist site');

do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated"}', true); end $$;
set local role authenticated;
select is(public.current_app_role()::text, 'specialist', 'specialist: role');
select is((select count(*)::int from public.journeys), 1, 'specialist: only the journey referred to their site');
select is((select count(*)::int from public.patients), 1, 'specialist: only the referred patient');
select is((select count(*)::int from public.reports), current_setting('t.reports')::int, 'specialist: reads the referred patient''s reports');
select is((select count(*)::int from public.reviews), current_setting('t.reviews')::int, 'specialist: reads the clinician''s notes for that patient');
select is((select count(*)::int from public.decisions), 0, 'specialist: no doctor decisions');
select is((select count(*)::int from public.messages), 0, 'specialist: no messages');
select is((select count(*)::int from public.journey_events), 0, 'specialist: no audit log');
select is((select count(*)::int from public.journey_status), 0, 'specialist: no dashboard view');
select throws_ok($$insert into public.reports (journey_id, kind, uploaded_by, partner_id, storage_path, file_name)
  values (current_setting('t.j')::uuid, 'fibroscan', auth.uid(), public.current_partner_id(), 'x.pdf', 'x.pdf')$$,
  '42501', null, 'specialist: cannot upload a report');
select throws_ok($$update public.journeys set stage = 9$$, '42501', null, 'specialist: cannot write the stage');

select * from finish();
rollback;

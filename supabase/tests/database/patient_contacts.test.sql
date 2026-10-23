-- The patient's phone number is server-only and is erased when the journey closes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

set local role service_role;

do $$ begin
  perform set_config('t.j', public.start_journey(gen_random_uuid(), 'P-9301', 'Contact Person', 52::smallint, '98•••• 3333', 'en', 'order_tests', false,
      '00000000-0000-4000-8000-000000000001', 'consent')::text, true);
  insert into public.patient_contacts (patient_id, phone_cipher)
  select patient_id, 'v1.test' from public.journeys where id = current_setting('t.j')::uuid;
end $$;

select is((select count(*)::int from public.patient_contacts), 1, 'the server can store a contact');

-- a home-visit address hangs off a booking and goes with the number
insert into public.bookings (id, journey_id, partner_id, kind, status)
values ('00000000-0000-4000-8000-00000000f001', current_setting('t.j')::uuid, '00000000-0000-4000-8000-0000000000a1', 'lab', 'booked');
insert into public.home_visits (booking_id, address_cipher) values ('00000000-0000-4000-8000-00000000f001', 'v1.test');
select is((select count(*)::int from public.home_visits), 1, 'the server can store a home-visit address');

-- a stage that is not the end keeps it
select set_config('app.transition', 'on', true);
update public.journeys set stage = 5 where id = current_setting('t.j')::uuid;
select is((select count(*)::int from public.patient_contacts), 1, 'a journey in progress keeps the number');

-- closing the journey erases it
update public.journeys set stage = 9 where id = current_setting('t.j')::uuid;
select is((select count(*)::int from public.patient_contacts), 0, 'a completed journey erases the number');
select is((select count(*)::int from public.home_visits), 0, 'a completed journey erases the home-visit address');

do $$ begin
  perform set_config('t.k', public.start_journey(gen_random_uuid(), 'P-9302', 'Declined Person', 50::smallint, '98•••• 4444', 'en', 'order_tests', false,
      '00000000-0000-4000-8000-000000000001', 'consent')::text, true);
  insert into public.patient_contacts (patient_id, phone_cipher)
  select patient_id, 'v1.test' from public.journeys where id = current_setting('t.k')::uuid;
  perform set_config('app.transition', 'on', true);
  update public.journeys set stage = 10 where id = current_setting('t.k')::uuid;
end $$;
select is((select count(*)::int from public.patient_contacts), 0, 'a journey that is not approved erases the number too');

reset role;

set local role authenticated;
select throws_ok($$select * from public.patient_contacts$$, '42501', null, 'signed-in users cannot read it');
reset role;
set local role anon;
select throws_ok($$select * from public.patient_contacts$$, '42501', null, 'anonymous users cannot read it');
reset role;

select * from finish();
rollback;

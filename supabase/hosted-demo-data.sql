-- Sample patients for a HOSTED demo, so every page has something to show: the six fake patients P-1001 to P-1006 at
-- different points of the pathway, with their reviews, decisions, bookings, messages and pending actions.
--
-- Run it in the Supabase dashboard SQL editor AFTER supabase/hosted-setup.sql (it needs the five staff users, which it finds
-- by their demo emails). It adds no accounts and no passwords, invents nobody real, and is safe to run twice: if the
-- patients already exist it does nothing. To open the sample reports, also upload the placeholder PDFs, see README.md.

-- ---------- the six prototype patients (P-1001 .. P-1006) ----------
do $$
declare
  doc uuid;
  clin uuid;
  lab_user uuid;
  centre_user uuid;
  lab constant uuid := '00000000-0000-4000-8000-0000000000a1';
  lab_slot constant text := 'Tomorrow 9:00 am';
  r record;
  v_patient uuid;
  v_journey uuid;
  v_report uuid;
  v_clock timestamptz;
  v_owner text;
  v_what text;
  v_centre uuid;
  v_centre_slot text;
  v_kpa numeric;
  v_next_step public.next_step;
  v_idle_hours int;
begin
  -- The staff users you created in the dashboard, found by their demo emails (the ids are different on a hosted project).
  select id into doc from auth.users where email = 'doctor@demo.liv2care.test';
  select id into clin from auth.users where email = 'clinician@demo.liv2care.test';
  select id into lab_user from auth.users where email = 'lab@demo.liv2care.test';
  select id into centre_user from auth.users where email = 'centre@demo.liv2care.test';
  if doc is null or clin is null or lab_user is null or centre_user is null then
    raise exception 'Create the five demo staff users and run supabase/hosted-setup.sql first.';
  end if;
  if exists (select 1 from public.patients where code = 'P-1001') then
    raise notice 'The sample patients are already there; nothing was added.';
    return;
  end if;

  for r in
    select * from (values
      ('P-1001', 'Ramesh Kulkarni', 58, 3, 182, 52, 44, 5),
      ('P-1002', 'Sunita Rao',       52, 0, null, null, null, 30),
      ('P-1003', 'Arjun Nair',       61, 5, 182, 52, 44, 8),
      ('P-1004', 'Meera Joshi',      49, 2, 96, 88, 71, 3),
      ('P-1005', 'Imran Sheikh',     55, 9, 182, 52, 44, 60),
      ('P-1006', 'Lakshmi Iyer',     63, 6, 182, 52, 44, 4)
    ) as t(code, pname, age, stage, plt, ast, alt, idle_h)
  loop
    v_clock := now() - interval '70 hours';
    v_idle_hours := r.idle_h;
    v_centre := case r.code when 'P-1005' then '00000000-0000-4000-8000-0000000000b2'::uuid
                            when 'P-1006' then '00000000-0000-4000-8000-0000000000b3'::uuid
                            else '00000000-0000-4000-8000-0000000000b1'::uuid end;
    v_centre_slot := case r.code when 'P-1005' then 'Mon 10:00 am' when 'P-1006' then 'Tomorrow 11:30 am' else 'Sat 9:30 am' end;
    v_kpa := case r.code when 'P-1005' then 5.8 when 'P-1006' then 9.4 end;
    v_next_step := case when r.code = 'P-1005' then 'routine'::public.next_step end;

    insert into public.patients (code, name, age, phone_masked, language)
    values (r.code, r.pname, r.age, '98•••• ' || (1000 + (random() * 8999)::int), 'en')
    returning id into v_patient;

    perform set_config('app.transition', 'on', true);
    insert into public.journeys (patient_id, doctor_id, route, ultrasound, stage, next_step, created_at, updated_at)
    values (v_patient, doc, 'order_tests', false, r.stage, v_next_step, v_clock, now() - make_interval(hours => v_idle_hours))
    returning id into v_journey;

    insert into public.consents (patient_id, journey_id, scope, recorded_by, given_at)
    values (v_patient, v_journey, 'Liver-risk assessment pathway and sharing reports with the platform clinician', doc, v_clock);

    insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, detail, created_at)
    values (v_journey, doc, 'doctor', 'JOURNEY_STARTED', null, 0, '{"route":"order_tests","ultrasound":false}', v_clock);
    insert into public.messages (journey_id, channel, body, created_at)
    values (v_journey, 'WhatsApp', 'Your doctor has requested some blood tests. Tap to book an appointment at a nearby lab: liv2care.demo/b/' || lower(r.code), v_clock);

    if r.stage >= 1 then
      v_clock := v_clock + interval '6 hours';
      insert into public.bookings (journey_id, partner_id, kind, status, slot_label, created_at)
      values (v_journey, lab, 'lab', case when r.stage >= 2 then 'attended'::public.booking_status else 'booked'::public.booking_status end, lab_slot, v_clock);
      insert into public.journey_events (journey_id, actor_role, event, from_stage, to_stage, detail, created_at)
      values (v_journey, 'patient', 'BOOK', 0, 1, jsonb_build_object('partner', 'Sunrise Diagnostics', 'slot', lab_slot), v_clock);
    end if;

    if r.stage >= 2 then
      v_clock := v_clock + interval '6 hours';
      insert into public.reports (journey_id, kind, uploaded_by, partner_id, storage_path, file_name, lab_values, created_at)
      values (v_journey, 'lab', lab_user, lab, 'seed/' || lower(r.code) || '-lab-report.pdf', 'lab-report.pdf',
              jsonb_build_object('platelets', r.plt, 'ast', r.ast, 'alt', r.alt), v_clock)
      returning id into v_report;
      insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, detail, created_at)
      values (v_journey, lab_user, 'lab', 'LAB_UPLOAD', 1, 2, '{"partner":"Sunrise Diagnostics"}', v_clock);
    end if;

    if r.stage >= 3 then
      v_clock := v_clock + interval '5 hours';
      update public.journeys set clinician_id = clin where id = v_journey;
      insert into public.reviews (journey_id, report_id, clinician_id, fib4_text, summary, recommends_vcte, created_at)
      values (v_journey, v_report, clin, '2.5',
              'Mildly raised transaminases with platelets in the normal range. Platform clinician suggests transient elastography for a closer look.',
              true, v_clock);
      insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, detail, created_at)
      values (v_journey, clin, 'clinician', 'CLINICIAN_SUBMIT', 2, 3, '{"recommends_vcte":true}', v_clock);
    end if;

    if r.stage >= 4 then
      v_clock := v_clock + interval '4 hours';
      insert into public.decisions (journey_id, doctor_id, kind, created_at) values (v_journey, doc, 'vcte_approve', v_clock);
      insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, created_at)
      values (v_journey, doc, 'doctor', 'APPROVE_VCTE', 3, 4, v_clock);
      insert into public.messages (journey_id, channel, body, created_at)
      values (v_journey, 'WhatsApp', 'Your doctor has recommended a FibroScan. Tap to book at a nearby diagnostic centre: liv2care.demo/b/' || lower(r.code), v_clock);
    end if;

    if r.stage >= 5 then
      v_clock := v_clock + interval '3 hours';
      insert into public.bookings (journey_id, partner_id, kind, status, slot_label, created_at)
      values (v_journey, v_centre, 'centre', case when r.stage >= 6 then 'attended'::public.booking_status else 'booked'::public.booking_status end, v_centre_slot, v_clock);
      insert into public.journey_events (journey_id, actor_role, event, from_stage, to_stage, detail, created_at)
      values (v_journey, 'patient', 'BOOK', 4, 5, jsonb_build_object('slot', v_centre_slot), v_clock);
    end if;

    if r.stage >= 6 then
      v_clock := v_clock + interval '3 hours';
      insert into public.reports (journey_id, kind, uploaded_by, partner_id, storage_path, file_name, lab_values, created_at)
      values (v_journey, 'fibroscan', centre_user, v_centre, 'seed/' || lower(r.code) || '-fibroscan.pdf', 'fibroscan.pdf',
              jsonb_build_object('kpa', v_kpa), v_clock);
      insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, created_at)
      values (v_journey, centre_user, 'centre', 'CENTRE_UPLOAD', 5, 6, v_clock);
    end if;

    if r.stage = 9 then
      v_clock := v_clock + interval '2 hours';
      insert into public.decisions (journey_id, doctor_id, kind, next_step, follow_up_months, created_at)
      values (v_journey, doc, 'next_step', 'routine', 12, v_clock);
      insert into public.bookings (journey_id, partner_id, kind, status, slot_label, created_at)
      values (v_journey, '00000000-0000-4000-8000-0000000000e1', 'routine', 'attended', 'In 12 months', v_clock);
      insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, detail, created_at)
      values (v_journey, doc, 'doctor', 'CHOOSE_NEXT_STEP', 6, 8, '{"step":"routine","months":12}', v_clock);
      insert into public.journey_events (journey_id, actor_role, event, from_stage, to_stage, created_at)
      values (v_journey, 'lab', 'MARK_ATTENDED', 8, 9, v_clock + interval '1 hour');
    end if;

    -- The one pending action for journeys that are still open (mirrors the prototype's "next action").
    select owner, what into v_owner, v_what from (values
      (0, 'Patient', 'Book the lab'), (1, 'Lab', 'Upload the report'), (2, 'Clinician', 'Review and write the summary'),
      (3, 'Doctor', 'Decide on FibroScan'), (5, 'Centre', 'Upload the FibroScan report'),
      (6, 'Doctor', 'Review report and pick the next step')
    ) as n(stage, owner, what) where n.stage = r.stage;
    if v_owner is not null then
      insert into public.tasks (journey_id, owner, description, due_at, created_at)
      values (v_journey, v_owner, v_what, now() - make_interval(hours => v_idle_hours) + interval '24 hours',
              now() - make_interval(hours => v_idle_hours));
    end if;
  end loop;
end $$;

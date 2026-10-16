-- Option 1 where the patient sends the existing report. The doctor enrols without a file; the journey waits at the first
-- stage (route existing_report, stage 0) until the patient uploads through their private link (event PATIENT_UPLOAD).
-- The patient is not a user, so the report is recorded against the treating doctor and the audit row names the patient.

create or replace function public.start_journey(
  p_journey_id uuid,
  p_patient_code text,
  p_patient_name text,
  p_patient_age smallint,
  p_phone_masked text,
  p_language text,
  p_route public.journey_route,
  p_ultrasound boolean,
  p_actor uuid,
  p_consent_scope text,
  p_report jsonb default null,
  p_first_task jsonb default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_patient uuid;
  v_stage smallint := case when p_route = 'existing_report' and p_report is not null then 2 else 0 end;
begin
  if (select role from public.profiles where id = p_actor) is distinct from 'doctor' then
    raise exception 'only the treating doctor starts a journey' using errcode = '42501';
  end if;
  if coalesce(trim(p_consent_scope), '') = '' then
    raise exception 'patient consent is required' using errcode = '23514';
  end if;

  insert into public.patients (code, name, age, phone_masked, language)
  values (coalesce(nullif(p_patient_code, ''), 'P-' || nextval('public.patient_code_seq')), p_patient_name, p_patient_age, p_phone_masked, p_language)
  returning id into v_patient;

  perform set_config('app.transition', 'on', true);
  insert into public.journeys (id, patient_id, doctor_id, route, ultrasound, stage)
  values (p_journey_id, v_patient, p_actor, p_route, p_ultrasound, v_stage);

  insert into public.consents (patient_id, journey_id, scope, recorded_by)
  values (v_patient, p_journey_id, p_consent_scope, p_actor);

  insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, detail)
  values (p_journey_id, p_actor, 'doctor', 'JOURNEY_STARTED', null, v_stage,
          jsonb_build_object('route', p_route, 'ultrasound', p_ultrasound));

  if p_report is not null then
    insert into public.reports (journey_id, kind, uploaded_by, storage_path, file_name, lab_values)
    values (p_journey_id, 'lab', p_actor, p_report ->> 'storage_path', p_report ->> 'file_name', p_report -> 'lab_values');
    insert into public.journey_events (journey_id, actor_id, actor_role, event, detail)
    values (p_journey_id, p_actor, 'doctor', 'EXISTING_REPORT_UPLOADED', '{}'::jsonb);
  end if;

  if p_first_task is not null then
    insert into public.tasks (journey_id, owner, description, due_at)
    values (p_journey_id, p_first_task ->> 'owner', p_first_task ->> 'description',
            now() + make_interval(hours => coalesce((p_first_task ->> 'hours')::int, 24)));
  end if;
  return p_journey_id;
end $$;


create or replace function public.apply_journey_event(
  p_journey uuid,
  p_event text,
  p_expected_stage smallint,
  p_expected_missed boolean,
  p_to_stage smallint,
  p_to_missed boolean,
  p_actor uuid,
  p_actor_role text,
  p_detail jsonb default '{}'::jsonb,
  p_next_step public.next_step default null,
  p_decline_reason text default null,
  p_booking jsonb default null,
  p_report jsonb default null,
  p_next_task jsonb default null,
  p_review jsonb default null,
  p_decision jsonb default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_journey public.journeys;
  v_event bigint;
  v_report uuid;
  v_lab_report uuid;
  v_expected text;
begin
  select * into v_journey from public.journeys where id = p_journey for update;
  if not found then
    raise exception 'journey not found' using errcode = 'P0002';
  end if;
  -- Optimistic check: the TypeScript side decided against a state that has since moved.
  if v_journey.stage <> p_expected_stage or v_journey.missed <> p_expected_missed then
    raise exception 'journey changed, reload and retry' using errcode = '40001';
  end if;

  -- Bookings: take the slot, keep one live booking per journey.
  if p_event = 'RESCHEDULE' then
    update public.slots set taken = false
    where id in (select slot_id from public.bookings where journey_id = p_journey and status = 'missed' and slot_id is not null);
    update public.bookings set status = 'cancelled' where journey_id = p_journey and status = 'missed';
  end if;
  if p_booking is not null then
    if (p_booking ->> 'slot_id') is not null then
      update public.slots set taken = true
      where id = (p_booking ->> 'slot_id')::uuid and not taken and partner_id = (p_booking ->> 'partner_id')::uuid;
      if not found then
        raise exception 'slot is no longer available' using errcode = '23505';
      end if;
    end if;
    insert into public.bookings (journey_id, partner_id, slot_id, kind, slot_label)
    values (p_journey, (p_booking ->> 'partner_id')::uuid, (p_booking ->> 'slot_id')::uuid,
            (p_booking ->> 'kind')::public.partner_kind, p_booking ->> 'slot_label');
  end if;
  if p_event = 'MARK_MISSED' then
    update public.bookings set status = 'missed' where journey_id = p_journey and status = 'booked';
  elsif p_event in ('LAB_UPLOAD', 'CENTRE_UPLOAD', 'MARK_ATTENDED') then
    update public.bookings set status = 'attended' where journey_id = p_journey and status = 'booked';
  end if;

  if p_report is not null then
    insert into public.reports (journey_id, kind, uploaded_by, partner_id, storage_path, file_name, lab_values)
    values (p_journey, (p_report ->> 'kind')::public.report_kind, coalesce(p_actor, v_journey.doctor_id), (p_report ->> 'partner_id')::uuid,
            p_report ->> 'storage_path', p_report ->> 'file_name', p_report -> 'lab_values')
    returning id into v_report;
  end if;

  -- The clinician's review: typed by hand, stored here and nowhere else. The audit row below carries no clinical text.
  if p_event = 'CLINICIAN_SUBMIT' then
    if p_review is null
       or coalesce(trim(p_review ->> 'fib4_text'), '') = ''
       or coalesce(trim(p_review ->> 'summary'), '') = '' then
      raise exception 'a review needs the FIB-4 text and a summary' using errcode = '23514';
    end if;
    select id into v_lab_report from public.reports where journey_id = p_journey and kind = 'lab' order by created_at desc limit 1;
    insert into public.reviews (journey_id, report_id, clinician_id, fib4_text, summary, recommends_vcte)
    values (p_journey, v_lab_report, p_actor, trim(p_review ->> 'fib4_text'), trim(p_review ->> 'summary'),
            coalesce((p_review ->> 'recommends_vcte')::boolean, false));
  elsif p_review is not null then
    raise exception 'only a clinician submission carries a review' using errcode = '23514';
  end if;

  -- The treating doctor's decision (approve, decline with a preset reason, re-review, next step), saved with the stage change.
  if p_event in ('APPROVE_VCTE', 'DECLINE_VCTE', 'REQUEST_REREVIEW', 'CHOOSE_NEXT_STEP') then
    v_expected := 'next_step';
    if p_event = 'APPROVE_VCTE' then v_expected := 'vcte_approve';
    elsif p_event = 'DECLINE_VCTE' then v_expected := 'vcte_decline';
    elsif p_event = 'REQUEST_REREVIEW' then v_expected := 'rereview';
    end if;
    if p_decision is null or (p_decision ->> 'kind') is distinct from v_expected then
      raise exception 'this decision needs a matching decision record' using errcode = '23514';
    end if;
    insert into public.decisions (journey_id, doctor_id, kind, reason, next_step, follow_up_months)
    values (p_journey, p_actor, (p_decision ->> 'kind')::public.decision_kind, p_decision ->> 'reason',
            (p_decision ->> 'next_step')::public.next_step, (p_decision ->> 'follow_up_months')::smallint);
  elsif p_decision is not null then
    raise exception 'only a doctor decision carries a decision record' using errcode = '23514';
  end if;

  perform set_config('app.transition', 'on', true);
  update public.journeys
  set stage = p_to_stage,
      missed = p_to_missed,
      next_step = coalesce(p_next_step, next_step),
      decline_reason = coalesce(p_decline_reason, decline_reason),
      clinician_id = case when p_event = 'CLINICIAN_SUBMIT' then p_actor else clinician_id end,
      updated_at = now()
  where id = p_journey;

  -- One open pending action at a time (the prototype's "next action").
  update public.tasks set done_at = now() where journey_id = p_journey and done_at is null;
  if p_next_task is not null then
    insert into public.tasks (journey_id, owner, description, due_at)
    values (p_journey, p_next_task ->> 'owner', p_next_task ->> 'description',
            now() + make_interval(hours => coalesce((p_next_task ->> 'hours')::int, 24)));
  end if;

  insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, detail)
  values (p_journey, p_actor, p_actor_role, p_event, p_expected_stage, p_to_stage,
          case when v_report is null then p_detail else p_detail || jsonb_build_object('report_id', v_report) end)
  returning id into v_event;
  return v_event;
end $$;


-- The only writers of journeys.stage / journeys.missed. Called by src/lib/journey/transition.ts with the
-- service-role key, after the TypeScript state machine has approved the move. Each call changes the journey
-- and appends its audit row in one transaction.

create function public.start_journey(
  p_patient_code text,
  p_patient_name text,
  p_patient_age smallint,
  p_phone_masked text,
  p_language text,
  p_route public.journey_route,
  p_ultrasound boolean,
  p_actor uuid,
  p_consent_scope text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_patient uuid;
  v_journey uuid;
  v_stage smallint := case when p_route = 'existing_report' then 2 else 0 end;
begin
  if (select role from public.profiles where id = p_actor) is distinct from 'doctor' then
    raise exception 'only the treating doctor starts a journey' using errcode = '42501';
  end if;
  if coalesce(trim(p_consent_scope), '') = '' then
    raise exception 'patient consent is required' using errcode = '23514';
  end if;

  insert into public.patients (code, name, age, phone_masked, language)
  values (p_patient_code, p_patient_name, p_patient_age, p_phone_masked, p_language)
  returning id into v_patient;

  perform set_config('app.transition', 'on', true);
  insert into public.journeys (patient_id, doctor_id, route, ultrasound, stage)
  values (v_patient, p_actor, p_route, p_ultrasound, v_stage)
  returning id into v_journey;

  insert into public.consents (patient_id, journey_id, scope, recorded_by)
  values (v_patient, v_journey, p_consent_scope, p_actor);

  insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, detail)
  values (v_journey, p_actor, 'doctor', 'JOURNEY_STARTED', null, v_stage,
          jsonb_build_object('route', p_route, 'ultrasound', p_ultrasound));
  return v_journey;
end $$;

create function public.apply_journey_event(
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
  p_decline_reason text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_journey public.journeys;
  v_event bigint;
begin
  select * into v_journey from public.journeys where id = p_journey for update;
  if not found then
    raise exception 'journey not found' using errcode = 'P0002';
  end if;
  -- Optimistic check: the TypeScript side decided against a state that has since moved.
  if v_journey.stage <> p_expected_stage or v_journey.missed <> p_expected_missed then
    raise exception 'journey changed, reload and retry' using errcode = '40001';
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

  insert into public.journey_events (journey_id, actor_id, actor_role, event, from_stage, to_stage, detail)
  values (p_journey, p_actor, p_actor_role, p_event, p_expected_stage, p_to_stage, p_detail)
  returning id into v_event;
  return v_event;
end $$;

-- Report access is audited too (who opened which report). Called by the server when it serves a report.
create function public.log_report_access(p_journey uuid, p_report uuid, p_actor uuid, p_actor_role text)
returns bigint
language sql security definer set search_path = '' as $$
  insert into public.journey_events (journey_id, actor_id, actor_role, event, detail)
  values (p_journey, p_actor, p_actor_role, 'REPORT_ACCESSED', jsonb_build_object('report_id', p_report))
  returning id
$$;

revoke execute on function
  public.start_journey(text, text, smallint, text, text, public.journey_route, boolean, uuid, text),
  public.apply_journey_event(uuid, text, smallint, boolean, smallint, boolean, uuid, text, jsonb, public.next_step, text),
  public.log_report_access(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function
  public.start_journey(text, text, smallint, text, text, public.journey_route, boolean, uuid, text),
  public.apply_journey_event(uuid, text, smallint, boolean, smallint, boolean, uuid, text, jsonb, public.next_step, text),
  public.log_report_access(uuid, uuid, uuid, text)
to service_role;

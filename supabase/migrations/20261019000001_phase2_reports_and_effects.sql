-- Phase 2: private report storage, and transition functions that carry their side effects
-- (booking, report row, booking status, pending-action task) in the same transaction as the stage change.

-- ---------- private bucket for report PDFs ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];

-- Paths: intake/<doctor id>/<file>.pdf (Option 1, before a journey exists) or journeys/<journey id>/<file>.pdf.
create function public.can_upload_report_path(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := storage.foldername(object_name);
begin
  if parts[1] = 'intake' then
    return parts[2] = auth.uid()::text and public.current_app_role() = 'doctor';
  end if;
  if parts[1] = 'journeys' and parts[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return public.partner_serves(parts[2]::uuid);
  end if;
  return false;
end $$;

-- Same rule as the reports table: the doctor and clinician in scope, or the user who uploaded it.
create function public.can_read_report_file(object_name text, owner_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner_uid = auth.uid()
    or exists (
      select 1 from public.reports r
      where r.storage_path = object_name and public.can_read_clinical(r.journey_id)
    )
$$;

create policy reports_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and public.can_upload_report_path(name));

create policy reports_files_read on storage.objects for select to authenticated
  using (bucket_id = 'reports' and public.can_read_report_file(name, owner_id::uuid));

grant execute on function public.can_upload_report_path(text), public.can_read_report_file(text, uuid) to authenticated;

-- Patient codes for new journeys (the seed uses P-1001 to P-1006).
create sequence public.patient_code_seq start 1007;

-- ---------- transition functions with effects ----------

drop function public.start_journey(text, text, smallint, text, text, public.journey_route, boolean, uuid, text);
drop function public.apply_journey_event(uuid, text, smallint, boolean, smallint, boolean, uuid, text, jsonb, public.next_step, text);

-- p_report: {storage_path, file_name, lab_values?} for Option 1.  p_first_task: {owner, description, hours}.
create function public.start_journey(
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
  v_stage smallint := case when p_route = 'existing_report' then 2 else 0 end;
begin
  if (select role from public.profiles where id = p_actor) is distinct from 'doctor' then
    raise exception 'only the treating doctor starts a journey' using errcode = '42501';
  end if;
  if coalesce(trim(p_consent_scope), '') = '' then
    raise exception 'patient consent is required' using errcode = '23514';
  end if;
  if p_route = 'existing_report' and p_report is null then
    raise exception 'an existing lab report is required for this route' using errcode = '23514';
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

-- p_booking: {partner_id, slot_id, kind, slot_label}  (BOOK, RESCHEDULE)
-- p_report : {kind, partner_id, storage_path, file_name, lab_values?}  (LAB_UPLOAD, CENTRE_UPLOAD)
-- p_next_task: {owner, description, hours} replaces the open pending action.
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
  p_decline_reason text default null,
  p_booking jsonb default null,
  p_report jsonb default null,
  p_next_task jsonb default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_journey public.journeys;
  v_event bigint;
  v_report uuid;
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
    values (p_journey, (p_report ->> 'kind')::public.report_kind, p_actor, (p_report ->> 'partner_id')::uuid,
            p_report ->> 'storage_path', p_report ->> 'file_name', p_report -> 'lab_values')
    returning id into v_report;
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

-- Audit rows for actions that do not move the journey (reminders, report access).
create function public.log_journey_event(p_journey uuid, p_event text, p_actor uuid, p_actor_role text, p_detail jsonb default '{}'::jsonb)
returns bigint
language sql security definer set search_path = '' as $$
  insert into public.journey_events (journey_id, actor_id, actor_role, event, detail)
  values (p_journey, p_actor, p_actor_role, p_event, p_detail)
  returning id
$$;

revoke execute on function
  public.start_journey(uuid, text, text, smallint, text, text, public.journey_route, boolean, uuid, text, jsonb, jsonb),
  public.apply_journey_event(uuid, text, smallint, boolean, smallint, boolean, uuid, text, jsonb, public.next_step, text, jsonb, jsonb, jsonb),
  public.log_journey_event(uuid, text, uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function
  public.start_journey(uuid, text, text, smallint, text, text, public.journey_route, boolean, uuid, text, jsonb, jsonb),
  public.apply_journey_event(uuid, text, smallint, boolean, smallint, boolean, uuid, text, jsonb, public.next_step, text, jsonb, jsonb, jsonb),
  public.log_journey_event(uuid, text, uuid, text, jsonb)
to service_role;

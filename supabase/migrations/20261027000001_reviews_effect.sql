-- A clinician submission carries the review (FIB-4 text, summary, recommendation) and stores it in the same
-- transaction as the stage change. The audit row never contains the clinical text.

drop function public.apply_journey_event(uuid, text, smallint, boolean, smallint, boolean, uuid, text, jsonb, public.next_step, text, jsonb, jsonb, jsonb);

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
  p_next_task jsonb default null,
  p_review jsonb default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_journey public.journeys;
  v_event bigint;
  v_report uuid;
  v_lab_report uuid;
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

revoke execute on function public.apply_journey_event(uuid, text, smallint, boolean, smallint, boolean, uuid, text, jsonb, public.next_step, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_journey_event(uuid, text, smallint, boolean, smallint, boolean, uuid, text, jsonb, public.next_step, text, jsonb, jsonb, jsonb, jsonb) to service_role;

-- Roles are enforced here, not in the UI.
--   doctor    : their own journeys, reports, reviews, decisions
--   clinician : reports and reviews for journeys in the review queue or assigned to them
--   lab/centre: slots and uploads for their own partner; journeys they hold a booking for (no clinical reads)
--   ops       : audit, bookings, messages, tasks and the journey_status view (no clinical columns, no reports/reviews)
-- Clients get no UPDATE/DELETE on anything; stage changes go through the service-role transition functions.

-- ---------- helpers (security definer, so policies do not recurse into each other) ----------

create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.current_partner_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select partner_id from public.profiles where id = auth.uid()
$$;

create function public.is_journey_doctor(jid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.journeys j where j.id = jid and j.doctor_id = auth.uid())
$$;

-- The clinician sees a journey waiting for review (stage 2, unassigned) or one they already reviewed.
create function public.clinician_can_review(jid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_app_role() = 'clinician'
    and exists (
      select 1 from public.journeys j
      where j.id = jid and (j.clinician_id = auth.uid() or (j.clinician_id is null and j.stage = 2))
    )
$$;

create function public.can_read_clinical(jid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_journey_doctor(jid) or public.clinician_can_review(jid)
$$;

create function public.partner_serves(jid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_partner_id() is not null
    and exists (
      select 1 from public.bookings b where b.journey_id = jid and b.partner_id = public.current_partner_id()
    )
$$;

create function public.can_see_patient(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_app_role() = 'ops'
    or exists (
      select 1 from public.journeys j
      where j.patient_id = pid
        and (j.doctor_id = auth.uid() or public.clinician_can_review(j.id) or public.partner_serves(j.id))
    )
$$;

-- ---------- table privileges: read-mostly for clients ----------

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.partners, public.profiles, public.slots, public.patients, public.journeys,
  public.consents, public.journey_events, public.bookings, public.reports, public.reviews,
  public.decisions, public.messages, public.tasks to authenticated;

-- Writes a signed-in user may make directly (each is also limited by a policy below).
grant insert, update, delete on public.slots to authenticated;
grant insert on public.reports to authenticated;
grant insert on public.reviews to authenticated;

-- ---------- policies ----------

create policy partners_read on public.partners for select to authenticated using (true);
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy slots_read on public.slots for select to authenticated using (true);

create policy slots_partner_write on public.slots for all to authenticated
  using (partner_id = public.current_partner_id())
  with check (partner_id = public.current_partner_id());

create policy patients_read on public.patients for select to authenticated
  using (public.can_see_patient(id));

-- Ops reads the journey_status view instead of this table.
create policy journeys_read on public.journeys for select to authenticated
  using (doctor_id = auth.uid() or public.clinician_can_review(id) or public.partner_serves(id));

create policy consents_read on public.consents for select to authenticated
  using (public.is_journey_doctor(journey_id) or public.current_app_role() = 'ops');

create policy events_read on public.journey_events for select to authenticated
  using (
    public.current_app_role() = 'ops'
    or public.is_journey_doctor(journey_id)
    or public.clinician_can_review(journey_id)
  );

create policy bookings_read on public.bookings for select to authenticated
  using (
    public.current_app_role() = 'ops'
    or public.is_journey_doctor(journey_id)
    or partner_id = public.current_partner_id()
  );

-- Clinical: labs and centres can add a report for a journey they hold a booking for, and read back only their own upload.
create policy reports_read on public.reports for select to authenticated
  using (public.can_read_clinical(journey_id) or uploaded_by = auth.uid());

create policy reports_upload on public.reports for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and partner_id = public.current_partner_id()
    and public.partner_serves(journey_id)
    and ((kind = 'lab' and public.current_app_role() = 'lab') or (kind = 'fibroscan' and public.current_app_role() = 'centre'))
  );

create policy reviews_read on public.reviews for select to authenticated
  using (public.can_read_clinical(journey_id));

create policy reviews_write on public.reviews for insert to authenticated
  with check (clinician_id = auth.uid() and public.clinician_can_review(journey_id));

create policy decisions_read on public.decisions for select to authenticated
  using (public.is_journey_doctor(journey_id));

create policy messages_read on public.messages for select to authenticated
  using (public.current_app_role() = 'ops' or public.is_journey_doctor(journey_id));

create policy tasks_read on public.tasks for select to authenticated
  using (public.current_app_role() = 'ops' or public.is_journey_doctor(journey_id));

-- ---------- journey_status: what ops (and the doctor's dashboard) may see ----------
-- No clinical columns: no decline reason, no reports, no reviews. Runs with the owner's rights,
-- so the filter below is the access rule.

create view public.journey_status as
select
  j.id as journey_id,
  p.code as patient_code,
  p.name as patient_name,
  p.age as patient_age,
  p.language as patient_language,
  j.route,
  j.ultrasound,
  j.stage,
  j.missed,
  j.next_step,
  j.doctor_id,
  j.created_at,
  j.updated_at
from public.journeys j
join public.patients p on p.id = j.patient_id
where public.current_app_role() = 'ops'
   or (public.current_app_role() = 'doctor' and j.doctor_id = auth.uid());

revoke all on public.journey_status from anon;
grant select on public.journey_status to authenticated;

-- Functions that run privileged logic are never callable from the browser.
revoke execute on all functions in schema public from anon, authenticated, public;
grant execute on function
  public.current_app_role(), public.current_partner_id(), public.is_journey_doctor(uuid),
  public.clinician_can_review(uuid), public.can_read_clinical(uuid), public.partner_serves(uuid),
  public.can_see_patient(uuid)
to authenticated;

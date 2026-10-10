-- Headline numbers for the operations screen, computed from journeys, audit rows, messages and pending actions.
-- Counts and timings only: no clinical columns. Like journey_status, the view runs with the owner's rights and the
-- filter is the access rule, so only operations gets numbers (everyone else gets a row of zeros).

create view public.kpi_summary as
select
  count(*)::int as patients,
  -- the primary KPI: journeys that reached "complete" (next step booked and attended)
  count(*) filter (where j.stage = 9)::int as completed,
  -- lab booking completion: of patients whose tests were ordered, how many booked a lab
  count(*) filter (where j.route = 'order_tests')::int as lab_ordered,
  count(*) filter (where j.route = 'order_tests' and j.stage >= 1)::int as lab_booked,
  -- FibroScan: approved, booked, done (journeys where the doctor declined are left out)
  count(*) filter (where j.stage between 4 and 9)::int as fibroscan_approved,
  count(*) filter (where j.stage between 5 and 9)::int as fibroscan_booked,
  count(*) filter (where j.stage between 6 and 9)::int as fibroscan_done,
  count(*) filter (where j.missed)::int as missed_now,
  (select count(*)::int from public.journey_events e where e.event = 'MARK_MISSED' and public.current_app_role() = 'ops') as missed_total,
  (select count(*)::int from public.tasks t where t.done_at is null and t.due_at < now() and public.current_app_role() = 'ops') as overdue_actions,
  (select count(*)::int from public.messages m where m.body like 'Reminder:%' and public.current_app_role() = 'ops') as reminders_sent,
  -- report turnaround: hours from the lab report arriving to the clinician's review being sent
  (select round(avg(extract(epoch from (r.at - u.at)) / 3600.0)::numeric, 1)
     from (select journey_id, min(created_at) as at from public.journey_events
           where event in ('LAB_UPLOAD', 'EXISTING_REPORT_UPLOADED') group by journey_id) u
     join (select journey_id, min(created_at) as at from public.journey_events
           where event = 'CLINICIAN_SUBMIT' group by journey_id) r using (journey_id)
     where public.current_app_role() = 'ops') as report_turnaround_hours,
  -- doctor coordination effort: doctor actions per patient (a proxy until real time tracking exists)
  case when count(*) = 0 then null
       else round(((select count(*) from public.journey_events e where e.actor_role = 'doctor' and e.event <> 'JOURNEY_STARTED' and public.current_app_role() = 'ops')::numeric)
                  / count(*), 1) end as doctor_actions_per_patient
from public.journeys j
where public.current_app_role() = 'ops';

revoke all on public.kpi_summary from anon;
grant select on public.kpi_summary to authenticated;

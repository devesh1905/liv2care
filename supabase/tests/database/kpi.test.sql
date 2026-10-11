-- The KPI view: correct numbers for the seeded patients, and only operations gets them.
-- Seed: six patients at stages 3, 0, 5, 2, 9 and 6 (P-1001 to P-1006), one open action already overdue (P-1002).
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- ============ operations ============
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true); end $$;
set local role authenticated;

select is((select patients from public.kpi_summary), 6, 'ops: six patients');
select is((select completed from public.kpi_summary), 1, 'ops: one journey complete');
select is((select lab_ordered from public.kpi_summary), 6, 'ops: six patients had tests ordered');
select is((select lab_booked from public.kpi_summary), 5, 'ops: five of them booked a lab');
select is((select fibroscan_approved from public.kpi_summary), 3, 'ops: three FibroScans approved');
select is((select fibroscan_booked from public.kpi_summary), 3, 'ops: three FibroScans booked');
select is((select fibroscan_done from public.kpi_summary), 2, 'ops: two FibroScans done');
select is((select missed_now from public.kpi_summary), 0, 'ops: nobody is missing a visit');
select is((select overdue_actions from public.kpi_summary), 1, 'ops: one action is overdue');
select is((select reminders_sent from public.kpi_summary), 0, 'ops: no reminders sent yet');
select is((select report_turnaround_hours from public.kpi_summary), 5.0, 'ops: report turnaround is 5 hours');
select is((select doctor_actions_per_patient from public.kpi_summary), 0.7, 'ops: 4 doctor actions over 6 patients');
reset role;

-- ============ everyone else gets nothing ============
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select patients from public.kpi_summary), 0, 'doctor: no patient count');
select is((select overdue_actions from public.kpi_summary), 0, 'doctor: no overdue count');
select is((select report_turnaround_hours from public.kpi_summary), null, 'doctor: no turnaround');
reset role;

set local role anon;
select throws_ok('select * from public.kpi_summary', '42501', null, 'anon cannot read the KPI view');
reset role;

select hasnt_column('public', 'kpi_summary', 'patient_name', 'the KPI view has no patient names');

select * from finish();
rollback;

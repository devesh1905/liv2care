-- One-time setup for a HOSTED Supabase project, run in the dashboard SQL editor after `supabase db push`
-- and after you have created the five staff users under Authentication -> Users.
--
-- It adds: partners (labs, centres, evaluation sites, specialists), open slots, and a profile row for each staff user.
-- It adds NO patients and NO passwords. Safe to run more than once.
--
-- The staff users must already exist with these emails (change the list below if you used different ones):
--   doctor@demo.liv2care.test, clinician@demo.liv2care.test, lab@demo.liv2care.test,
--   centre@demo.liv2care.test, ops@demo.liv2care.test

-- ---------- partners ----------
insert into public.partners (id, kind, name, area, distance_km) values
  ('00000000-0000-4000-8000-0000000000a1', 'lab', 'Sunrise Diagnostics', 'Andheri', 2),
  ('00000000-0000-4000-8000-0000000000a2', 'lab', 'MediLab Central', 'Dadar', 5),
  ('00000000-0000-4000-8000-0000000000a3', 'lab', 'CityCare Labs', 'Thane', 8),
  ('00000000-0000-4000-8000-0000000000b1', 'centre', 'Hepatic Imaging Centre', 'Powai', 3),
  ('00000000-0000-4000-8000-0000000000b2', 'centre', 'Metro Scan Centre', 'Dadar', 6),
  ('00000000-0000-4000-8000-0000000000b3', 'centre', 'Liver Care Diagnostics', 'Thane', 10),
  ('00000000-0000-4000-8000-0000000000c1', 'eval', 'Metro Scan Centre (further evaluation)', 'Dadar', 6),
  ('00000000-0000-4000-8000-0000000000c2', 'eval', 'CityCare Labs (further evaluation)', 'Thane', 8),
  ('00000000-0000-4000-8000-0000000000d1', 'specialist', 'Hepatology OPD, Dr. A. Mehta', 'Andheri', 4),
  ('00000000-0000-4000-8000-0000000000d2', 'specialist', 'Gastro and Liver Clinic', 'Dadar', 7),
  ('00000000-0000-4000-8000-0000000000e1', 'routine', 'Your diabetes clinic', 'Andheri', 1)
on conflict (id) do nothing;

-- ---------- slots: the next three days at 9:00, 11:30 and 16:00 India time ----------
insert into public.slots (partner_id, starts_at)
select p.id, ((date_trunc('day', now() at time zone 'Asia/Kolkata') + (d || ' days')::interval + t) at time zone 'Asia/Kolkata')
from public.partners p
cross join generate_series(1, 3) d
cross join (values (interval '9 hours'), (interval '11 hours 30 minutes'), (interval '16 hours')) as times(t)
where p.kind in ('lab', 'centre', 'eval', 'specialist')
on conflict (partner_id, starts_at) do nothing;

-- ---------- profiles: connect each staff user to a role ----------
insert into public.profiles (id, role, display_name, partner_id)
select u.id, v.role::public.app_role, v.display_name, v.partner_id::uuid
from auth.users u
join (values
  ('doctor@demo.liv2care.test',    'doctor',    'Dr. Anita Menon',             null),
  ('clinician@demo.liv2care.test', 'clinician', 'Dr. S. Kapoor',               null),
  ('lab@demo.liv2care.test',       'lab',       'Sunrise Diagnostics desk',    '00000000-0000-4000-8000-0000000000a1'),
  ('centre@demo.liv2care.test',    'centre',    'Hepatic Imaging Centre desk', '00000000-0000-4000-8000-0000000000b1'),
  ('ops@demo.liv2care.test',       'ops',       'Operations desk',             null)
) as v(email, role, display_name, partner_id) on v.email = u.email
on conflict (id) do nothing;

-- Check: should list five rows, one per role.
select p.role, p.display_name, u.email from public.profiles p join auth.users u on u.id = p.id order by p.role;

-- Liv2care schema. Fake data only.
-- Stage numbers mirror src/lib/journey/stages.ts (0 = tests ordered ... 9 = complete, 10 = FibroScan not approved).
-- journeys.stage is written only by the apply_journey_event / start_journey functions (see the transition migration).

create type public.app_role as enum ('doctor', 'clinician', 'lab', 'centre', 'ops');
create type public.partner_kind as enum ('lab', 'centre', 'eval', 'specialist', 'routine');
create type public.journey_route as enum ('order_tests', 'existing_report');
create type public.next_step as enum ('routine', 'eval', 'specialist');
create type public.booking_status as enum ('booked', 'missed', 'attended', 'cancelled');
create type public.report_kind as enum ('lab', 'fibroscan');
create type public.decision_kind as enum ('vcte_approve', 'vcte_decline', 'rereview', 'next_step');

-- Staff accounts. Lab and centre users belong to one partner.
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  kind public.partner_kind not null,
  name text not null,
  area text not null,
  distance_km numeric(4, 1) not null check (distance_km >= 0)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  display_name text not null,
  partner_id uuid references public.partners (id),
  check ((role in ('lab', 'centre')) = (partner_id is not null))
);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  starts_at timestamptz not null,
  taken boolean not null default false,
  unique (partner_id, starts_at)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  age smallint not null check (age between 0 and 120),
  phone_masked text not null,
  language text not null default 'en' check (language in ('en', 'hi'))
);

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  doctor_id uuid not null references public.profiles (id),
  clinician_id uuid references public.profiles (id),
  route public.journey_route not null,
  ultrasound boolean not null default false,
  stage smallint not null check (stage between 0 and 10),
  missed boolean not null default false,
  next_step public.next_step,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journeys_doctor_idx on public.journeys (doctor_id);
create index journeys_patient_idx on public.journeys (patient_id);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  journey_id uuid not null references public.journeys (id),
  scope text not null,
  given_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles (id)
);

-- Audit log. Insert-only. Never put lab values, FIB-4 or summary text in `detail`.
create table public.journey_events (
  id bigint generated always as identity primary key,
  journey_id uuid not null references public.journeys (id),
  actor_id uuid references public.profiles (id),
  actor_role text not null,
  event text not null,
  from_stage smallint,
  to_stage smallint,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index journey_events_journey_idx on public.journey_events (journey_id, created_at);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id),
  partner_id uuid not null references public.partners (id),
  slot_id uuid references public.slots (id),
  kind public.partner_kind not null,
  status public.booking_status not null default 'booked',
  slot_label text,
  created_at timestamptz not null default now()
);
create index bookings_journey_idx on public.bookings (journey_id);
create index bookings_partner_idx on public.bookings (partner_id);

-- Clinical: readable only by the treating doctor and the telemedicine clinician.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id),
  kind public.report_kind not null,
  uploaded_by uuid not null references public.profiles (id),
  partner_id uuid references public.partners (id),
  storage_path text not null,
  file_name text not null,
  lab_values jsonb,
  created_at timestamptz not null default now()
);
create index reports_journey_idx on public.reports (journey_id);

-- Clinical: FIB-4 and the summary are typed by the clinician. The app never calculates them.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id),
  report_id uuid references public.reports (id),
  clinician_id uuid not null references public.profiles (id),
  fib4_text text not null,
  summary text not null,
  recommends_vcte boolean not null default false,
  created_at timestamptz not null default now()
);
create index reviews_journey_idx on public.reviews (journey_id);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id),
  doctor_id uuid not null references public.profiles (id),
  kind public.decision_kind not null,
  reason text,
  next_step public.next_step,
  follow_up_months smallint,
  created_at timestamptz not null default now()
);
create index decisions_journey_idx on public.decisions (journey_id);

-- Mocked messages: stored and shown in the message log, never sent.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id),
  channel text not null check (channel in ('WhatsApp', 'SMS')),
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_journey_idx on public.messages (journey_id);

-- Pending actions with a due time (replaces the prototype's idleH).
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id),
  owner text not null check (owner in ('Patient', 'Lab', 'Clinician', 'Doctor', 'Centre', 'Clinic')),
  description text not null,
  due_at timestamptz not null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_journey_idx on public.tasks (journey_id);

-- ---------- guards ----------

-- The audit table accepts inserts only, for every role including the owner.
create function public.journey_events_insert_only() returns trigger
language plpgsql as $$
begin
  raise exception 'journey_events is insert-only' using errcode = '42501';
end $$;

create trigger journey_events_no_update_delete
  before update or delete on public.journey_events
  for each row execute function public.journey_events_insert_only();
create trigger journey_events_no_truncate
  before truncate on public.journey_events
  for each statement execute function public.journey_events_insert_only();

-- Nothing writes the stage except the transition functions, which set app.transition for their own transaction.
create function public.journeys_guard_stage() returns trigger
language plpgsql as $$
begin
  if (new.stage is distinct from old.stage or new.missed is distinct from old.missed)
     and coalesce(current_setting('app.transition', true), '') <> 'on' then
    raise exception 'journeys.stage can only change through journey transition' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger journeys_stage_guard
  before update on public.journeys
  for each row execute function public.journeys_guard_stage();

alter table public.partners enable row level security;
alter table public.profiles enable row level security;
alter table public.slots enable row level security;
alter table public.patients enable row level security;
alter table public.journeys enable row level security;
alter table public.consents enable row level security;
alter table public.journey_events enable row level security;
alter table public.bookings enable row level security;
alter table public.reports enable row level security;
alter table public.reviews enable row level security;
alter table public.decisions enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;

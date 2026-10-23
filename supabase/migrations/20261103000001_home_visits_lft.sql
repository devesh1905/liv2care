-- Home blood collection: a lab can open "home visit" slots. The patient's address is kept encrypted (like their phone number),
-- readable by the server only, and erased when the journey closes.
-- LFT: whether the doctor included liver function tests in the order.

alter table public.slots add column home boolean not null default false;
alter table public.slots drop constraint slots_partner_id_starts_at_key;
alter table public.slots add constraint slots_partner_start_home_key unique (partner_id, starts_at, home);

alter table public.journeys add column lft boolean not null default false;

create table public.home_visits (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  address_cipher text not null,
  created_at timestamptz not null default now()
);

alter table public.home_visits enable row level security;
revoke all on public.home_visits from anon, authenticated;

create or replace function public.erase_contact_when_closed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stage in (9, 10) and old.stage is distinct from new.stage then
    delete from public.patient_contacts where patient_id = new.patient_id;
    delete from public.home_visits where booking_id in (select id from public.bookings where journey_id = new.id);
  end if;
  return new;
end $$;

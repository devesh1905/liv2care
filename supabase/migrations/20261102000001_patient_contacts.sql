-- The patient's phone number, so the app can send them their links. Kept apart from `patients` (which only ever shows a masked
-- number), stored encrypted by the app (AES-256-GCM, key in the server settings), readable by the server only, and deleted
-- the moment the journey is closed (completed or not approved).

create table public.patient_contacts (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  phone_cipher text not null,
  created_at timestamptz not null default now()
);

alter table public.patient_contacts enable row level security;
revoke all on public.patient_contacts from anon, authenticated;

create function public.erase_contact_when_closed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.stage in (9, 10) and old.stage is distinct from new.stage then
    delete from public.patient_contacts where patient_id = new.patient_id;
  end if;
  return new;
end $$;

revoke execute on function public.erase_contact_when_closed() from public, anon, authenticated;

create trigger journeys_erase_contact
after update of stage on public.journeys
for each row execute function public.erase_contact_when_closed();

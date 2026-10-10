-- Patients have no account. They act through a hashed, expiring booking link (/book/<token>).
-- Only the server (service role) reads this table; the token itself is never stored.

create table public.booking_links (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index booking_links_journey_idx on public.booking_links (journey_id);

alter table public.booking_links enable row level security;
revoke all on public.booking_links from anon, authenticated;

-- A new link replaces any earlier one for the same journey.
create function public.issue_booking_link(p_journey uuid, p_token_hash text, p_hours integer default 168)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_expires timestamptz := now() + make_interval(hours => p_hours);
begin
  update public.booking_links set revoked_at = now() where journey_id = p_journey and revoked_at is null;
  insert into public.booking_links (journey_id, token_hash, expires_at) values (p_journey, p_token_hash, v_expires);
  return v_expires;
end $$;

-- Returns the journey for a live link, or null (unknown, expired or revoked).
create function public.resolve_booking_link(p_token_hash text) returns uuid
language sql stable security definer set search_path = '' as $$
  select journey_id from public.booking_links
  where token_hash = p_token_hash and revoked_at is null and expires_at > now()
$$;

revoke execute on function public.issue_booking_link(uuid, text, integer), public.resolve_booking_link(text)
from public, anon, authenticated;
grant execute on function public.issue_booking_link(uuid, text, integer), public.resolve_booking_link(text) to service_role;

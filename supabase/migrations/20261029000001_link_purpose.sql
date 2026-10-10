-- A patient has two kinds of link: a booking link (replaced each time a new one is sent, 7 days) and a progress link
-- (/patient/<token>, stays valid for weeks, so the patient can check their journey any time). Each kind replaces only
-- its own earlier links.

alter table public.booking_links add column purpose text not null default 'book' check (purpose in ('book', 'view'));

drop function public.issue_booking_link(uuid, text, integer);
drop function public.resolve_booking_link(text);

create function public.issue_booking_link(p_journey uuid, p_token_hash text, p_hours integer default 168, p_purpose text default 'book')
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_expires timestamptz := now() + make_interval(hours => p_hours);
begin
  update public.booking_links set revoked_at = now()
  where journey_id = p_journey and purpose = p_purpose and revoked_at is null;
  insert into public.booking_links (journey_id, token_hash, expires_at, purpose) values (p_journey, p_token_hash, v_expires, p_purpose);
  return v_expires;
end $$;

-- Returns the journey for a live link of the given kind, or null (unknown, expired, revoked, or the wrong kind).
create function public.resolve_booking_link(p_token_hash text, p_purpose text default 'book') returns uuid
language sql stable security definer set search_path = '' as $$
  select journey_id from public.booking_links
  where token_hash = p_token_hash and purpose = p_purpose and revoked_at is null and expires_at > now()
$$;

revoke execute on function public.issue_booking_link(uuid, text, integer, text), public.resolve_booking_link(text, text)
from public, anon, authenticated;
grant execute on function public.issue_booking_link(uuid, text, integer, text), public.resolve_booking_link(text, text) to service_role;

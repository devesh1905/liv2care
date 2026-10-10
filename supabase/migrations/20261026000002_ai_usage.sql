-- Daily cap on calls to the AI booking helper. One row per day and key (for example 'global' or a link).
-- Only the server reads or writes it.

create table public.ai_usage (
  day date not null default current_date,
  usage_key text not null,
  calls integer not null default 0,
  primary key (day, usage_key)
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Counts one call and returns true while the key is under its cap for today; returns false (and counts nothing) once it is not.
create function public.ai_consume(p_key text, p_cap integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_calls integer;
begin
  insert into public.ai_usage (day, usage_key, calls) values (current_date, p_key, 0)
  on conflict (day, usage_key) do nothing;

  update public.ai_usage set calls = calls + 1
  where day = current_date and usage_key = p_key and calls < p_cap
  returning calls into v_calls;
  return v_calls is not null;
end $$;

revoke execute on function public.ai_consume(text, integer) from public, anon, authenticated;
grant execute on function public.ai_consume(text, integer) to service_role;

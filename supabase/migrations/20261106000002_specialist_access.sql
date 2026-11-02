-- The specialist works for one specialist site (a partner of kind 'specialist'), like a lab or a FibroScan centre desk.
alter table public.profiles drop constraint if exists profiles_check;
alter table public.profiles add constraint profiles_partner_check
  check ((role in ('lab', 'centre', 'specialist')) = (partner_id is not null));

-- Clinical reads: the treating doctor, the clinician, and now the specialist for a patient referred to their own site (a
-- booking at their partner). Reports, report files and the clinician's reviews all go through this function. Labs and
-- FibroScan centres still read no clinical data.
create or replace function public.can_read_clinical(jid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_journey_doctor(jid)
    or public.clinician_can_review(jid)
    or (public.current_app_role() = 'specialist' and public.partner_serves(jid))
$$;

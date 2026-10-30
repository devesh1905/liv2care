-- The treating doctor can flag a patient's tests as urgent. Logistics only: it puts the patient first in the lab's, the
-- centre's and the clinician's lists and asks the patient to book soon. It carries no clinical value.
alter table public.journeys add column urgent boolean not null default false;

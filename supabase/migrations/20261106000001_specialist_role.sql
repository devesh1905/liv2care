-- A sixth staff role: the specialist (hepatologist or gastroenterologist) the treating doctor refers a patient to after the
-- clinician's FibroScan summary. A new enum value cannot be used in the transaction that adds it, so the access rules that
-- name it are in the next migration.
alter type public.app_role add value if not exists 'specialist';

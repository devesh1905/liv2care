-- The daily cap on the AI helper: counts calls, refuses past the cap, service role only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

set local role service_role;
select is(public.ai_consume('t-key', 2), true, 'first call is allowed');
select is(public.ai_consume('t-key', 2), true, 'second call is allowed');
select is(public.ai_consume('t-key', 2), false, 'third call is over the cap');
select is((select calls from public.ai_usage where usage_key = 't-key' and day = current_date), 2, 'a refused call is not counted');
select is(public.ai_consume('other-key', 2), true, 'keys are counted separately');
reset role;

set local role authenticated;
select throws_ok($$select public.ai_consume('t-key', 99)$$, '42501', null, 'signed-in users cannot call it');
reset role;

select * from finish();
rollback;

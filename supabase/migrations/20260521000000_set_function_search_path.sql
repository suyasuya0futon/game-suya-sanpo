alter function public.submit_score(integer, integer)
set search_path = public, pg_temp;

alter function public.set_score_name(uuid, uuid, text)
set search_path = public, pg_temp;

alter function public.get_my_rank(uuid, integer, integer, timestamptz)
set search_path = public, pg_temp;

create table if not exists public.developers (
  user_id uuid primary key,
  display_name text not null default 'suyasuya0futon',
  created_at timestamptz not null default now()
);

alter table public.developers
  add column if not exists display_name text not null default 'suyasuya0futon';

alter table public.developers enable row level security;

revoke all on table public.developers from anon, authenticated;

alter table public.scores
  add column if not exists user_id uuid,
  add column if not exists is_developer boolean not null default false;

create or replace view public.public_rankings as
select
  row_number() over (order by score desc, loop_count, created_at, id) as rank,
  score,
  loop_count,
  coalesce(name, 'nanashi'::text) as name,
  created_at,
  id,
  is_developer
from public.scores;

create or replace function public.is_developer()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.developers
    where developers.user_id = auth.uid()
  );
$function$;

create or replace function public.submit_score(p_score integer, p_loop_count integer)
returns table(inserted boolean, id uuid, token uuid, created_at timestamp with time zone)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_id uuid;
  v_token uuid;
  v_created_at timestamptz;
  v_row_count integer;
  v_cap constant integer := 100;
  v_user_id uuid := auth.uid();
  v_is_developer boolean;
  v_developer_name text;
begin
  if p_score is null or p_score < 0 or p_score > 9999999 then
    raise exception 'invalid score';
  end if;
  if p_loop_count is null or p_loop_count < 1 or p_loop_count > 9999 then
    raise exception 'invalid loop_count';
  end if;

  select developers.display_name into v_developer_name
  from public.developers
  where developers.user_id = v_user_id;
  v_is_developer := v_developer_name is not null;

  -- 並行 submit を直列化
  perform pg_advisory_xact_lock(742031);

  select count(*) into v_row_count from public.scores;
  if v_row_count >= v_cap then
    declare
      v_bot_score integer;
      v_bot_loop integer;
    begin
      select score, loop_count into v_bot_score, v_bot_loop
      from public.scores
      order by score asc, loop_count desc, created_at desc, id desc
      limit 1;

      if not (
        p_score > v_bot_score
        or (p_score = v_bot_score and p_loop_count < v_bot_loop)
      ) then
        return query select false, null::uuid, null::uuid, null::timestamptz;
        return;
      end if;
    end;
  end if;

  insert into public.scores (score, loop_count, user_id, is_developer, name)
    values (p_score, p_loop_count, v_user_id, v_is_developer, case when v_is_developer then v_developer_name else null end)
    returning scores.id, scores.token, scores.created_at into v_id, v_token, v_created_at;

  if v_row_count >= v_cap then
    delete from public.scores
    where id = (
      select id from public.scores
      order by score asc, loop_count desc, created_at desc, id desc
      limit 1
    );
  end if;

  return query select true, v_id, v_token, v_created_at;
end;
$function$;

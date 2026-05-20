create or replace view public.public_rankings as
select
  row_number() over (order by score desc, loop_count, created_at, id) as rank,
  score,
  loop_count,
  coalesce(name, 'nanashi'::text) as name,
  created_at,
  id
from public.scores;

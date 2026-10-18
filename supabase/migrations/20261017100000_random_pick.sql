-- im bored. — pick a random activity in the database
--
-- With thousands of activities, sending every eligible activity to the
-- browser is too slow. This function applies the filters, Chaos Mode and the
-- "not the same one twice" rule, and picks one activity at random, weighted
-- by votes exactly like src/lib/activities/engine.ts:
--   weight = 0.2 + (upvotes + 1) / (upvotes + downvotes + 2)
-- It uses weighted random sampling (Efraimidis–Spirakis): the row with the
-- smallest -ln(u) / weight wins, where u is uniform in (0, 1].
--
-- Runs with the caller's permissions, so RLS still limits it to published rows.
--
-- Activities can also have a second category (for example music and social),
-- and they show up under either one.

alter table public.activities
  add column secondary_category text
    check (secondary_category in ('creative','brain','physical','outdoors','indoors','gaming','learn','mischief','social','music','productivity')),
  add constraint activities_categories_differ check (secondary_category is distinct from category);

create index activities_published_secondary_idx
  on public.activities (secondary_category, duration_minutes)
  where status = 'published' and secondary_category is not null;

create or replace function public.pick_random_activity(
  p_max_minutes integer default null,
  p_locations text[] default null,
  p_energy text default null,
  p_cost text default null,
  p_category text default null,
  p_chaos boolean default false,
  p_exclude uuid default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  with eligible as (
    select a.*
    from public.activities a
    where a.status = 'published'
      and (p_max_minutes is null or a.duration_minutes <= p_max_minutes)
      and (p_locations is null or a.location = any (p_locations))
      and (p_energy is null or a.energy_level = p_energy)
      and (p_cost is null or a.cost_type = p_cost)
      and (p_category is null or a.category = p_category or a.secondary_category = p_category)
  ),
  stats as (
    select count(*) as n, count(*) filter (where is_chaos) as n_chaos from eligible
  ),
  mode as (
    select n, n_chaos,
           (coalesce(p_chaos, false) and n_chaos > 0) as chaos_only,
           (coalesce(p_chaos, false) and n_chaos = 0 and n > 0) as chaos_fallback
    from stats
  ),
  candidates as (
    select e.*
    from eligible e, mode m
    where (not m.chaos_only or e.is_chaos)
      and (
        p_exclude is null
        or e.id <> p_exclude
        or (case when m.chaos_only then m.n_chaos else m.n end) <= 1
      )
  ),
  pick as (
    select c.*
    from candidates c
    order by -ln(1.0 - random()) / (0.2 + (c.upvotes + 1)::float8 / (c.upvotes + c.downvotes + 2))
    limit 1
  )
  select jsonb_build_object(
    'eligible', m.n,
    'chaos_fallback', m.chaos_fallback,
    'activity', (
      select jsonb_build_object(
        'id', p.id, 'title', p.title, 'description', p.description, 'category', p.category, 'secondary_category', p.secondary_category,
        'duration_minutes', p.duration_minutes, 'difficulty', p.difficulty, 'location', p.location,
        'energy_level', p.energy_level, 'cost_type', p.cost_type, 'people_type', p.people_type,
        'xp_reward', p.xp_reward, 'is_chaos', p.is_chaos, 'is_featured', p.is_featured,
        'safety_note', p.safety_note, 'upvotes', p.upvotes, 'downvotes', p.downvotes,
        'video_query', p.video_query
      )
      from pick p
    )
  )
  from mode m;
$$;

revoke execute on function public.pick_random_activity(integer, text[], text, text, text, boolean, uuid) from public;
grant execute on function public.pick_random_activity(integer, text[], text, text, text, boolean, uuid) to anon, authenticated;

-- Helps the category + published filter used by the generator.
create index activities_published_category_idx
  on public.activities (category, duration_minutes)
  where status = 'published';

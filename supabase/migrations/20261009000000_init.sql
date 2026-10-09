-- im bored. initial schema
--
-- Security model (see README "Database security"):
-- * Browsers talk to Postgres through Supabase's anon/authenticated roles, so
--   every table has RLS enabled and explicit, minimal grants. Supabase grants
--   ALL on new public tables to anon/authenticated by default; we revoke that
--   first and grant back only what each table needs.
-- * XP, streaks, completions, payments and moderation are only changed through
--   SECURITY DEFINER functions that check auth.uid() (or are restricted to
--   service_role). Clients cannot write those columns directly.
-- * Server-only tables: payment_events, moderation_audit_log, admin_users.
--   They have RLS enabled with no client write policies; admins may read
--   payment_events and the audit log through RLS.
-- * Daily challenge dates use UTC.

-- ─────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.utc_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'utc')::date;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Administrators (server-only). Add rows with the SQL editor; see README.
-- ─────────────────────────────────────────────────────────────────────────

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

-- Answers only for the caller, so nobody can probe other accounts.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Profiles
-- ─────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Usernames are stored normalised (lowercase), which makes the unique
  -- constraint case-insensitive.
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (display_name is null or char_length(display_name) between 1 and 40),
  avatar_url text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)),
  show_on_leaderboard boolean not null default true,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Column-level grant: users can never touch is_suspended, ids or timestamps.
grant update (username, display_name, avatar_url, show_on_leaderboard) on public.profiles to authenticated;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- Activities
-- ─────────────────────────────────────────────────────────────────────────

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 1000),
  category text not null check (category in ('creative','brain','physical','outdoors','indoors','gaming','learn','mischief','social','music','productivity')),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  difficulty text not null check (difficulty in ('easy','medium','hard','insane')),
  location text not null check (location in ('indoors','outdoors','computer','anywhere')),
  energy_level text not null check (energy_level in ('low','medium','high')),
  cost_type text not null check (cost_type in ('free','paid')),
  people_type text not null check (people_type in ('alone','with_friends','either')),
  xp_reward integer not null check (xp_reward between 0 and 1000),
  is_chaos boolean not null default false,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  safety_note text check (safety_note is null or char_length(safety_note) <= 300),
  source text not null default 'seed' check (source in ('seed','submission','admin')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activities_published_filter_idx
  on public.activities (category, energy_level, cost_type, duration_minutes)
  where status = 'published';
create index activities_published_featured_idx
  on public.activities (is_featured) where status = 'published';

create trigger activities_updated_at before update on public.activities
  for each row execute function public.set_updated_at();

alter table public.activities enable row level security;
revoke all on public.activities from anon, authenticated;
grant select on public.activities to anon, authenticated;

create policy "activities: public reads published" on public.activities
  for select to anon, authenticated using (status = 'published' or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- Favourites
-- ─────────────────────────────────────────────────────────────────────────

create table public.user_favourites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create index user_favourites_activity_idx on public.user_favourites (activity_id);

alter table public.user_favourites enable row level security;
revoke all on public.user_favourites from anon, authenticated;
grant select, insert, delete on public.user_favourites to authenticated;

create policy "favourites: read own" on public.user_favourites
  for select to authenticated using (user_id = auth.uid());
create policy "favourites: add own published" on public.user_favourites
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.activities a where a.id = activity_id and a.status = 'published')
  );
create policy "favourites: remove own" on public.user_favourites
  for delete to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- Progress, completions and streaks
-- ─────────────────────────────────────────────────────────────────────────

create table public.user_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  activities_completed integer not null default 0 check (activities_completed >= 0),
  daily_challenges_completed integer not null default 0 check (daily_challenges_completed >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  -- UTC calendar date of the most recent qualifying completion.
  last_active_date date,
  -- When total_xp last increased; the leaderboard tie-breaker (earlier wins).
  xp_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_progress_leaderboard_idx on public.user_progress (total_xp desc, xp_updated_at asc, user_id asc);

alter table public.user_progress enable row level security;
revoke all on public.user_progress from anon, authenticated;
grant select on public.user_progress to authenticated;

create policy "progress: read own" on public.user_progress
  for select to authenticated using (user_id = auth.uid());

-- Each activity awards XP once per account (documented in README).
create table public.activity_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete restrict,
  xp_awarded integer not null check (xp_awarded >= 0),
  completed_at timestamptz not null default now(),
  unique (user_id, activity_id)
);

create index activity_completions_user_idx on public.activity_completions (user_id, completed_at desc);

alter table public.activity_completions enable row level security;
revoke all on public.activity_completions from anon, authenticated;
grant select on public.activity_completions to authenticated;

create policy "completions: read own" on public.activity_completions
  for select to authenticated using (user_id = auth.uid());

-- Internal: atomically add XP and update the streak. Not callable by clients.
-- Streak rule (UTC days): completing anything on the day after the last
-- active day extends the streak; the same day leaves it unchanged; any gap
-- resets it to 1.
create or replace function public._award_progress(
  p_user uuid,
  p_xp integer,
  p_activity_increment integer,
  p_daily_increment integer,
  p_today date default null
)
returns public.user_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, public.utc_today());
  v_result public.user_progress;
begin
  insert into public.user_progress as up (
    user_id, total_xp, activities_completed, daily_challenges_completed,
    current_streak, longest_streak, last_active_date, xp_updated_at
  )
  values (p_user, p_xp, p_activity_increment, p_daily_increment, 1, 1, v_today, now())
  on conflict (user_id) do update set
    total_xp = up.total_xp + excluded.total_xp,
    activities_completed = up.activities_completed + excluded.activities_completed,
    daily_challenges_completed = up.daily_challenges_completed + excluded.daily_challenges_completed,
    current_streak = case
      when up.last_active_date = v_today then greatest(up.current_streak, 1)
      when up.last_active_date = v_today - 1 then up.current_streak + 1
      else 1
    end,
    longest_streak = greatest(up.longest_streak, case
      when up.last_active_date = v_today then greatest(up.current_streak, 1)
      when up.last_active_date = v_today - 1 then up.current_streak + 1
      else 1
    end),
    last_active_date = greatest(coalesce(up.last_active_date, v_today), v_today),
    xp_updated_at = case when excluded.total_xp > 0 then now() else up.xp_updated_at end,
    updated_at = now()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.complete_activity(p_activity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_activity record;
  v_completion_id uuid;
  v_progress public.user_progress;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_suspended) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  select id, xp_reward into v_activity
  from public.activities
  where id = p_activity_id and status = 'published';
  if not found then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  -- The unique constraint makes this the single point of truth under
  -- concurrency: only one request can insert, and only that one awards XP.
  insert into public.activity_completions (user_id, activity_id, xp_awarded)
  values (v_uid, v_activity.id, v_activity.xp_reward)
  on conflict (user_id, activity_id) do nothing
  returning id into v_completion_id;

  if v_completion_id is null then
    select * into v_progress from public.user_progress where user_id = v_uid;
    return jsonb_build_object('awarded', false, 'xp_awarded', 0, 'progress', to_jsonb(v_progress));
  end if;

  v_progress := public._award_progress(v_uid, v_activity.xp_reward, 1, 0);
  return jsonb_build_object('awarded', true, 'xp_awarded', v_activity.xp_reward, 'progress', to_jsonb(v_progress));
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Daily challenges (UTC dates)
-- ─────────────────────────────────────────────────────────────────────────

create table public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null unique,
  activity_id uuid references public.activities (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 1000),
  instructions text check (instructions is null or char_length(instructions) <= 1000),
  xp_reward integer not null check (xp_reward between 0 and 1000),
  status text not null default 'published' check (status in ('draft','published')),
  selection text not null default 'manual' check (selection in ('manual','automatic')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.daily_challenges enable row level security;
revoke all on public.daily_challenges from anon, authenticated;
grant select on public.daily_challenges to anon, authenticated;

-- Future challenges stay hidden from the public.
create policy "daily: public reads published up to today" on public.daily_challenges
  for select to anon, authenticated
  using ((status = 'published' and challenge_date <= public.utc_today()) or public.is_admin());

create table public.daily_challenge_completions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  daily_challenge_id uuid not null references public.daily_challenges (id) on delete cascade,
  xp_awarded integer not null check (xp_awarded >= 0),
  completed_at timestamptz not null default now(),
  primary key (user_id, daily_challenge_id)
);

alter table public.daily_challenge_completions enable row level security;
revoke all on public.daily_challenge_completions from anon, authenticated;
grant select on public.daily_challenge_completions to authenticated;

create policy "daily completions: read own" on public.daily_challenge_completions
  for select to authenticated using (user_id = auth.uid());

-- Bonus XP on top of the underlying activity's XP for a daily challenge.
create or replace function public.daily_bonus_xp() returns integer
language sql immutable set search_path = '' as $$ select 25 $$;

-- Internal: returns the challenge for a date, creating a deterministic
-- automatic pick from published activities when admins have not chosen one.
-- Once stored, the choice never changes on reload.
create or replace function public._ensure_daily_challenge(p_date date)
returns public.daily_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.daily_challenges;
  v_pick record;
begin
  select * into v_row from public.daily_challenges where challenge_date = p_date;
  if found then
    return v_row;
  end if;

  with pool as (
    select a.id, a.title, a.description, a.xp_reward,
           row_number() over (order by a.slug) - 1 as rn,
           count(*) over () as n
    from public.activities a
    where a.status = 'published' and not a.is_chaos
  )
  select * into v_pick from pool
  where rn = mod(abs(hashtext(p_date::text))::bigint, n);

  if not found then
    return null;
  end if;

  insert into public.daily_challenges (challenge_date, activity_id, title, description, xp_reward, status, selection)
  values (p_date, v_pick.id, v_pick.title, v_pick.description, v_pick.xp_reward + public.daily_bonus_xp(), 'published', 'automatic')
  on conflict (challenge_date) do nothing;

  select * into v_row from public.daily_challenges where challenge_date = p_date;
  return v_row;
end;
$$;

create or replace function public.get_daily_challenge()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.daily_challenges;
  v_completed boolean := false;
begin
  v_row := public._ensure_daily_challenge(public.utc_today());
  if v_row.id is null or v_row.status <> 'published' then
    return null;
  end if;
  if auth.uid() is not null then
    v_completed := exists (
      select 1 from public.daily_challenge_completions
      where user_id = auth.uid() and daily_challenge_id = v_row.id
    );
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'challenge_date', v_row.challenge_date,
    'activity_id', v_row.activity_id,
    'title', v_row.title,
    'description', v_row.description,
    'instructions', v_row.instructions,
    'xp_reward', v_row.xp_reward,
    'completed', v_completed
  );
end;
$$;

create or replace function public.complete_daily_challenge()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.daily_challenges;
  v_inserted boolean;
  v_progress public.user_progress;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_suspended) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  -- Only the challenge for the server's current UTC date can be completed.
  v_row := public._ensure_daily_challenge(public.utc_today());
  if v_row.id is null or v_row.status <> 'published' then
    raise exception 'no_daily_challenge' using errcode = 'P0002';
  end if;

  insert into public.daily_challenge_completions (user_id, daily_challenge_id, xp_awarded)
  values (v_uid, v_row.id, v_row.xp_reward)
  on conflict (user_id, daily_challenge_id) do nothing
  returning true into v_inserted;

  if v_inserted is null then
    select * into v_progress from public.user_progress where user_id = v_uid;
    return jsonb_build_object('awarded', false, 'xp_awarded', 0, 'progress', to_jsonb(v_progress));
  end if;

  v_progress := public._award_progress(v_uid, v_row.xp_reward, 0, 1);
  return jsonb_build_object('awarded', true, 'xp_awarded', v_row.xp_reward, 'progress', to_jsonb(v_progress));
end;
$$;

-- Admin: choose the challenge for today or a future date. Today's challenge
-- can only be replaced while nobody has completed it yet.
create or replace function public.admin_set_daily_challenge(p_date date, p_activity_id uuid)
returns public.daily_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity record;
  v_row public.daily_challenges;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_date < public.utc_today() then
    raise exception 'date_in_past' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.daily_challenge_completions c
    join public.daily_challenges d on d.id = c.daily_challenge_id
    where d.challenge_date = p_date
  ) then
    raise exception 'challenge_already_completed' using errcode = '23505';
  end if;

  select id, title, description, xp_reward into v_activity
  from public.activities where id = p_activity_id and status = 'published';
  if not found then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  insert into public.daily_challenges (challenge_date, activity_id, title, description, xp_reward, status, selection, created_by)
  values (p_date, v_activity.id, v_activity.title, v_activity.description, v_activity.xp_reward + public.daily_bonus_xp(), 'published', 'manual', auth.uid())
  on conflict (challenge_date) do update set
    activity_id = excluded.activity_id,
    title = excluded.title,
    description = excluded.description,
    xp_reward = excluded.xp_reward,
    status = 'published',
    selection = 'manual',
    created_by = excluded.created_by
  returning * into v_row;
  return v_row;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Leaderboard
-- Eligible: not suspended, opted in (show_on_leaderboard), XP > 0. Deleted
-- accounts disappear through ON DELETE CASCADE. Ties: whoever reached the
-- score first ranks higher, then user id for total stability.
-- Only public profile fields are returned.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.get_leaderboard(p_limit integer default 50, p_offset integer default 0)
returns table (
  rank bigint,
  username text,
  display_name text,
  avatar_url text,
  total_xp integer,
  level integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      row_number() over (order by up.total_xp desc, up.xp_updated_at asc, p.id asc) as rank,
      p.username, p.display_name, p.avatar_url, up.total_xp,
      (up.total_xp / 100) + 1 as level
    from public.user_progress up
    join public.profiles p on p.id = up.user_id
    where p.show_on_leaderboard and not p.is_suspended and up.total_xp > 0
  )
  select r.rank, r.username, r.display_name, r.avatar_url, r.total_xp, r.level,
         count(*) over () as total_count
  from ranked r
  order by r.rank
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_my_rank()
returns table (rank bigint, total_xp integer, level integer, eligible boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select up.user_id,
      row_number() over (order by up.total_xp desc, up.xp_updated_at asc, p.id asc) as rank
    from public.user_progress up
    join public.profiles p on p.id = up.user_id
    where p.show_on_leaderboard and not p.is_suspended and up.total_xp > 0
  )
  select r.rank, up.total_xp, (up.total_xp / 100) + 1, r.rank is not null
  from public.user_progress up
  left join ranked r on r.user_id = up.user_id
  where up.user_id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Paid activity submissions
-- Payment state and moderation state are separate columns. Payment state is
-- only changed by service_role (Stripe webhook); moderation only by admins.
-- ─────────────────────────────────────────────────────────────────────────

create table public.activity_submissions (
  id uuid primary key default gen_random_uuid(),
  -- Preserved (set null) if the account is deleted, to keep payment records.
  submitter_id uuid references public.profiles (id) on delete set null,
  client_request_id uuid not null,
  title text not null check (char_length(title) between 5 and 100),
  description text not null check (char_length(description) between 20 and 800),
  category text not null check (category in ('creative','brain','physical','outdoors','indoors','gaming','learn','mischief','social','music','productivity')),
  duration_minutes integer not null check (duration_minutes between 1 and 240),
  difficulty text not null check (difficulty in ('easy','medium','hard','insane')),
  location text not null check (location in ('indoors','outdoors','computer','anywhere')),
  energy_level text not null check (energy_level in ('low','medium','high')),
  cost_type text not null check (cost_type in ('free','paid')),
  people_type text not null check (people_type in ('alone','with_friends','either')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','checkout_created','paid','failed','refund_pending','refunded')),
  moderation_status text not null default 'pending_payment'
    check (moderation_status in ('pending_payment','pending_review','needs_changes','approved','rejected')),
  -- Fixed fee. The constraint makes any other amount impossible to record.
  amount_cents integer not null default 100 check (amount_cents = 100),
  currency text not null default 'usd' check (currency = 'usd'),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  checkout_expires_at timestamptz,
  checkout_attempts integer not null default 0 check (checkout_attempts >= 0),
  paid_at timestamptz,
  refunded_at timestamptz,
  reviewer_id uuid references auth.users (id) on delete set null,
  -- Shown to the submitter (rejection reason or requested changes).
  review_notes text check (review_notes is null or char_length(review_notes) <= 2000),
  published_activity_id uuid references public.activities (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submitter_id, client_request_id),
  constraint approval_requires_payment check (moderation_status <> 'approved' or payment_status = 'paid'),
  constraint review_requires_payment check (
    moderation_status = 'pending_payment' or payment_status in ('paid','refund_pending','refunded')
  ),
  constraint unpaid_waits_for_payment check (
    moderation_status <> 'pending_payment' or payment_status in ('unpaid','checkout_created','failed')
  )
);

create index activity_submissions_submitter_idx on public.activity_submissions (submitter_id, created_at desc);
create index activity_submissions_moderation_idx on public.activity_submissions (moderation_status, created_at desc);

create trigger activity_submissions_updated_at before update on public.activity_submissions
  for each row execute function public.set_updated_at();

alter table public.activity_submissions enable row level security;
revoke all on public.activity_submissions from anon, authenticated;
grant select on public.activity_submissions to authenticated;

create policy "submissions: owner or admin reads" on public.activity_submissions
  for select to authenticated using (submitter_id = auth.uid() or public.is_admin());

-- Creates a submission for the caller. Idempotent per client_request_id so a
-- double-click or retry returns the same row. Rate limited per account.
create or replace function public.create_submission(
  p_client_request_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_duration_minutes integer,
  p_difficulty text,
  p_location text,
  p_energy_level text,
  p_cost_type text,
  p_people_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_suspended) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  select id into v_id from public.activity_submissions
  where submitter_id = v_uid and client_request_id = p_client_request_id;
  if found then
    return v_id;
  end if;

  if (select count(*) from public.activity_submissions
      where submitter_id = v_uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.activity_submissions (
    submitter_id, client_request_id, title, description, category, duration_minutes,
    difficulty, location, energy_level, cost_type, people_type
  ) values (
    v_uid, p_client_request_id, btrim(p_title), btrim(p_description), p_category, p_duration_minutes,
    p_difficulty, p_location, p_energy_level, p_cost_type, p_people_type
  )
  on conflict (submitter_id, client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.activity_submissions
    where submitter_id = v_uid and client_request_id = p_client_request_id;
  end if;
  return v_id;
end;
$$;

-- Owner edits a submission an admin sent back with "needs changes". No new
-- payment is required; it returns to the review queue.
create or replace function public.resubmit_submission(
  p_submission_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_duration_minutes integer,
  p_difficulty text,
  p_location text,
  p_energy_level text,
  p_cost_type text,
  p_people_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.activity_submissions;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into v_sub from public.activity_submissions where id = p_submission_id for update;
  if not found or v_sub.submitter_id is distinct from v_uid then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  if v_sub.moderation_status <> 'needs_changes' or v_sub.payment_status <> 'paid' then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  update public.activity_submissions set
    title = btrim(p_title), description = btrim(p_description), category = p_category,
    duration_minutes = p_duration_minutes, difficulty = p_difficulty, location = p_location,
    energy_level = p_energy_level, cost_type = p_cost_type, people_type = p_people_type,
    moderation_status = 'pending_review'
  where id = p_submission_id;

  insert into public.moderation_audit_log (submission_id, actor_id, action, from_status, to_status)
  values (p_submission_id, v_uid, 'resubmit', 'needs_changes', 'pending_review');
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Stripe events (server-only)
-- ─────────────────────────────────────────────────────────────────────────

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  submission_id uuid references public.activity_submissions (id) on delete set null,
  checkout_session_id text,
  payment_intent_id text,
  amount_cents integer,
  currency text,
  livemode boolean not null default false,
  outcome text not null default 'received',
  received_at timestamptz not null default now()
);

create index payment_events_submission_idx on public.payment_events (submission_id, received_at desc);

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
grant select on public.payment_events to authenticated;
create policy "payment events: admins read" on public.payment_events
  for select to authenticated using (public.is_admin());

-- Records a Stripe event exactly once and, if it is new and consistent with
-- the stored submission, moves payment_status from one of p_from_statuses to
-- p_to_status. Everything happens in one transaction, so a crash can never
-- leave an event marked processed without its transition (or vice versa).
-- The allowed transitions are computed by src/lib/payments/state.ts.
create or replace function public.apply_payment_event(
  p_event_id text,
  p_event_type text,
  p_livemode boolean,
  p_submission_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_cents integer,
  p_currency text,
  p_to_status text,
  p_from_statuses text[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_sub public.activity_submissions;
  v_outcome text;
begin
  insert into public.payment_events (
    stripe_event_id, event_type, livemode, submission_id, checkout_session_id,
    payment_intent_id, amount_cents, currency
  ) values (
    p_event_id, p_event_type, p_livemode, null, p_checkout_session_id,
    p_payment_intent_id, p_amount_cents, p_currency
  )
  on conflict (stripe_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return 'duplicate';
  end if;

  if p_submission_id is not null then
    select * into v_sub from public.activity_submissions where id = p_submission_id for update;
  elsif p_payment_intent_id is not null then
    select * into v_sub from public.activity_submissions where stripe_payment_intent_id = p_payment_intent_id for update;
  end if;

  if v_sub.id is null then
    v_outcome := 'unknown_submission';
  elsif p_to_status is null then
    v_outcome := 'ignored';
  elsif p_checkout_session_id is not null and v_sub.stripe_checkout_session_id is distinct from p_checkout_session_id then
    v_outcome := 'session_mismatch';
  elsif p_payment_intent_id is not null and v_sub.stripe_payment_intent_id is not null
        and v_sub.stripe_payment_intent_id <> p_payment_intent_id then
    v_outcome := 'payment_intent_mismatch';
  elsif p_to_status = 'paid' and (p_amount_cents is distinct from v_sub.amount_cents or p_currency is distinct from v_sub.currency) then
    v_outcome := 'amount_mismatch';
  elsif not (v_sub.payment_status = any (p_from_statuses)) then
    v_outcome := 'invalid_transition';
  else
    update public.activity_submissions set
      payment_status = p_to_status,
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id),
      paid_at = case when p_to_status = 'paid' then now() else paid_at end,
      refunded_at = case when p_to_status = 'refunded' then now() else refunded_at end,
      -- An expired or failed session can never be paid; clear it so the next
      -- attempt creates a fresh one.
      stripe_checkout_session_id = case when p_to_status in ('unpaid','failed') then null else stripe_checkout_session_id end,
      checkout_expires_at = case when p_to_status in ('unpaid','failed') then null else checkout_expires_at end,
      -- Payment moves the submission into the review queue. It is never
      -- published automatically.
      moderation_status = case
        when p_to_status = 'paid' and moderation_status = 'pending_payment' then 'pending_review'
        else moderation_status
      end
    where id = v_sub.id;
    v_outcome := 'applied';
  end if;

  update public.payment_events set outcome = v_outcome, submission_id = v_sub.id where id = v_event_id;
  return v_outcome;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Moderation (admins only, audited)
-- ─────────────────────────────────────────────────────────────────────────

create table public.moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.activity_submissions (id) on delete set null,
  activity_id uuid references public.activities (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('approve','reject','request_changes','resubmit','archive_activity','refund_requested','set_daily_challenge')),
  from_status text,
  to_status text,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index moderation_audit_log_submission_idx on public.moderation_audit_log (submission_id, created_at desc);

alter table public.moderation_audit_log enable row level security;
revoke all on public.moderation_audit_log from anon, authenticated;
grant select on public.moderation_audit_log to authenticated;
create policy "audit log: admins read" on public.moderation_audit_log
  for select to authenticated using (public.is_admin());

create or replace function public.moderate_submission(p_submission_id uuid, p_action text, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.activity_submissions;
  v_to text;
  v_activity_id uuid;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_sub from public.activity_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    if v_sub.payment_status <> 'paid' then
      raise exception 'payment_not_verified' using errcode = '22023';
    end if;
    if v_sub.moderation_status <> 'pending_review' then
      raise exception 'invalid_transition' using errcode = '22023';
    end if;
    v_to := 'approved';
    insert into public.activities (
      slug, title, description, category, duration_minutes, difficulty, location,
      energy_level, cost_type, people_type, xp_reward, is_chaos, is_featured, status, source, published_at
    ) values (
      'sub-' || replace(v_sub.id::text, '-', ''), v_sub.title, v_sub.description, v_sub.category,
      v_sub.duration_minutes, v_sub.difficulty, v_sub.location, v_sub.energy_level, v_sub.cost_type,
      v_sub.people_type,
      case v_sub.difficulty when 'easy' then 10 when 'medium' then 20 when 'hard' then 35 else 50 end,
      false, false, 'published', 'submission', now()
    ) returning id into v_activity_id;
  elsif p_action = 'reject' then
    if v_sub.moderation_status not in ('pending_review', 'needs_changes') then
      raise exception 'invalid_transition' using errcode = '22023';
    end if;
    if v_notes is null then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    v_to := 'rejected';
  elsif p_action = 'request_changes' then
    if v_sub.moderation_status <> 'pending_review' or v_sub.payment_status <> 'paid' then
      raise exception 'invalid_transition' using errcode = '22023';
    end if;
    if v_notes is null then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    v_to := 'needs_changes';
  else
    raise exception 'unknown_action' using errcode = '22023';
  end if;

  update public.activity_submissions set
    moderation_status = v_to,
    reviewer_id = v_uid,
    review_notes = coalesce(v_notes, review_notes),
    published_activity_id = coalesce(v_activity_id, published_activity_id),
    published_at = case when v_activity_id is not null then now() else published_at end
  where id = v_sub.id;

  insert into public.moderation_audit_log (submission_id, activity_id, actor_id, action, from_status, to_status, notes)
  values (v_sub.id, v_activity_id, v_uid, p_action, v_sub.moderation_status, v_to, v_notes);

  return jsonb_build_object('moderation_status', v_to, 'activity_id', v_activity_id);
end;
$$;

create or replace function public.archive_activity(p_activity_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select status into v_status from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;
  if v_status = 'archived' then
    return;
  end if;
  update public.activities set status = 'archived' where id = p_activity_id;
  insert into public.moderation_audit_log (activity_id, actor_id, action, from_status, to_status, notes)
  values (p_activity_id, auth.uid(), 'archive_activity', v_status, 'archived', v_reason);
end;
$$;

-- Server (service_role) records an admin-initiated refund request after the
-- Stripe refund is created. Only rejected submissions are refundable here.
create or replace function public.mark_refund_pending(p_submission_id uuid, p_actor uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.activity_submissions;
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select * into v_sub from public.activity_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission_not_found' using errcode = 'P0002';
  end if;
  if v_sub.payment_status <> 'paid' or v_sub.moderation_status <> 'rejected' then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  update public.activity_submissions set payment_status = 'refund_pending' where id = p_submission_id;
  insert into public.moderation_audit_log (submission_id, actor_id, action, from_status, to_status, notes)
  values (p_submission_id, p_actor, 'refund_requested', 'paid', 'refund_pending', nullif(btrim(coalesce(p_notes, '')), ''));
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- New users: create profile and progress rows
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_attempts integer := 0;
begin
  v_base := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(v_base) < 3 then
    v_base := 'user';
  end if;
  v_base := left(v_base, 18);
  v_candidate := v_base;
  if char_length(v_candidate) < 3 or exists (select 1 from public.profiles where username = v_candidate) then
    loop
      v_attempts := v_attempts + 1;
      v_candidate := v_base || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
      exit when not exists (select 1 from public.profiles where username = v_candidate) or v_attempts > 20;
    end loop;
  end if;

  insert into public.profiles (id, username) values (new.id, v_candidate);
  insert into public.user_progress (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- Function privileges. PostgreSQL grants EXECUTE to PUBLIC by default.
-- ─────────────────────────────────────────────────────────────────────────

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.utc_today() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_daily_challenge() to anon, authenticated;
grant execute on function public.get_leaderboard(integer, integer) to anon, authenticated;
grant execute on function public.get_my_rank() to authenticated;
grant execute on function public.complete_activity(uuid) to authenticated;
grant execute on function public.complete_daily_challenge() to authenticated;
grant execute on function public.create_submission(uuid, text, text, text, integer, text, text, text, text, text) to authenticated;
grant execute on function public.resubmit_submission(uuid, text, text, text, integer, text, text, text, text, text) to authenticated;
grant execute on function public.moderate_submission(uuid, text, text) to authenticated;
grant execute on function public.archive_activity(uuid, text) to authenticated;
grant execute on function public.admin_set_daily_challenge(date, uuid) to authenticated;

grant execute on function public.apply_payment_event(text, text, boolean, uuid, text, text, integer, text, text, text[]) to service_role;
grant execute on function public.mark_refund_pending(uuid, uuid, text) to service_role;
grant execute on function public._ensure_daily_challenge(date) to service_role;

-- im bored. — free submissions and activity votes
--
-- 1. Suggesting an activity is now free. New submissions go straight to the
--    review queue. The paid flow is paused, not erased: the payment columns
--    and payment_events table stay so any existing records are kept, but the
--    payment functions are removed and nothing in the app uses them. The paid
--    version of the code is tagged `paid-submissions-v1` in git.
-- 2. Signed-in users can upvote or downvote any published activity, once
--    each. Counts are kept on the activity row by a trigger.

-- ─────────────────────────────────────────────────────────────────────────
-- Free submissions
-- ─────────────────────────────────────────────────────────────────────────

alter table public.activity_submissions
  drop constraint approval_requires_payment,
  drop constraint review_requires_payment,
  drop constraint unpaid_waits_for_payment,
  drop constraint activity_submissions_payment_status_check,
  drop constraint activity_submissions_amount_cents_check;

alter table public.activity_submissions
  add constraint activity_submissions_payment_status_check
    check (payment_status in ('not_required','unpaid','checkout_created','paid','failed','refund_pending','refunded')),
  add constraint activity_submissions_amount_cents_check check (amount_cents in (0, 100));

-- Existing unpaid submissions join the review queue as free ones.
update public.activity_submissions
  set moderation_status = 'pending_review', payment_status = 'not_required', amount_cents = 0
  where moderation_status = 'pending_payment';

-- Nothing waits for payment any more.
alter table public.activity_submissions
  drop constraint activity_submissions_moderation_status_check,
  add constraint activity_submissions_moderation_status_check
    check (moderation_status in ('pending_review','needs_changes','approved','rejected'));

alter table public.activity_submissions
  alter column payment_status set default 'not_required',
  alter column moderation_status set default 'pending_review',
  alter column amount_cents set default 0;

drop function if exists public.apply_payment_event(text, text, boolean, uuid, text, text, integer, text, text, text[]);
drop function if exists public.mark_refund_pending(uuid, uuid, text);

-- Owner edits a submission an admin sent back with "needs changes".
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
  if v_sub.moderation_status <> 'needs_changes' then
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
    if v_sub.moderation_status <> 'pending_review' then
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

-- ─────────────────────────────────────────────────────────────────────────
-- Votes
-- ─────────────────────────────────────────────────────────────────────────

alter table public.activities
  add column upvotes integer not null default 0 check (upvotes >= 0),
  add column downvotes integer not null default 0 check (downvotes >= 0);

create table public.activity_votes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create index activity_votes_activity_idx on public.activity_votes (activity_id);

create trigger activity_votes_updated_at before update on public.activity_votes
  for each row execute function public.set_updated_at();

alter table public.activity_votes enable row level security;
revoke all on public.activity_votes from anon, authenticated;
grant select on public.activity_votes to authenticated;

-- Votes are private: people see only their own. Writes go through cast_vote.
create policy "votes: read own" on public.activity_votes
  for select to authenticated using (user_id = auth.uid());

-- Keeps activities.upvotes/downvotes in step with activity_votes, including
-- when votes disappear because an account is deleted.
create or replace function public._sync_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.activities set
      upvotes = upvotes - (old.value = 1)::int,
      downvotes = downvotes - (old.value = -1)::int
    where id = old.activity_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.activities set
      upvotes = upvotes + (new.value = 1)::int,
      downvotes = downvotes + (new.value = -1)::int
    where id = new.activity_id;
  end if;
  return null;
end;
$$;

create trigger activity_votes_sync_counts
  after insert or update of value or delete on public.activity_votes
  for each row execute function public._sync_vote_counts();

-- Sets the caller's vote on a published activity: 1 (up), -1 (down) or 0
-- (remove). Returns the new totals and the caller's vote.
create or replace function public.cast_vote(p_activity_id uuid, p_value integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_up integer;
  v_down integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_suspended) then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if p_value is null or p_value not in (-1, 0, 1) then
    raise exception 'invalid_vote' using errcode = '22023';
  end if;
  if not exists (select 1 from public.activities where id = p_activity_id and status = 'published') then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  if p_value = 0 then
    delete from public.activity_votes where user_id = v_uid and activity_id = p_activity_id;
  else
    insert into public.activity_votes (user_id, activity_id, value)
    values (v_uid, p_activity_id, p_value)
    on conflict (user_id, activity_id) do update set value = excluded.value
      where public.activity_votes.value is distinct from excluded.value;
  end if;

  select upvotes, downvotes into v_up, v_down from public.activities where id = p_activity_id;
  return jsonb_build_object('upvotes', v_up, 'downvotes', v_down, 'my_vote', p_value);
end;
$$;

revoke execute on function public._sync_vote_counts() from public, anon, authenticated;
revoke execute on function public.cast_vote(uuid, integer) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, integer) to authenticated;

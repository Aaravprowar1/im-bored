# im bored.

Get a random activity that fits your time, place, energy and budget. Press one button, do one thing.

Built with Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, and Supabase (Postgres, Auth, RLS).

- Anyone can generate activities, filter them and use Chaos Mode without an account.
- Accounts add XP, levels, streaks, synced favourites, the daily challenge bonus and the leaderboard.
- Anyone signed in can suggest an activity for free. A moderator approves, rejects or requests changes.
- Signed-in users can vote any activity up or down. Votes make well-liked activities come up more often in the generator.
- Activities that teach a skill (38 of them, like tying a knot or juggling) show a popular YouTube tutorial.

## Status: what works and what needs configuring

| Area | State |
| --- | --- |
| Activity generator, filters, Chaos Mode, categories | Works with no configuration (uses the bundled seed list, clearly labelled "Development mode"). Uses the database once Supabase is configured. |
| Guest favourites | Works with no configuration (stored in this browser only, labelled as such). |
| Accounts, profiles, XP, streaks, synced favourites, daily challenge bonus, leaderboard | Implemented. **Needs Supabase.** Without it, the UI says accounts aren't set up and never shows sample scores. |
| Free activity suggestions | Implemented. **Needs Supabase.** |
| Upvotes and downvotes | Implemented. **Needs Supabase.** Without it, the buttons show and explain that accounts aren't set up. |
| YouTube tutorials on skill activities | Works with no configuration as a link to YouTube's most-viewed results. **Add `YOUTUBE_API_KEY`** to show the most-viewed relevant video right on the card. |
| Admin moderation | Implemented. Needs Supabase and an admin row (see below). |
| Legal pages | Templates with `[placeholders]`. Must be completed and reviewed by a lawyer before commercial use. |

Nothing here has been run against a live Supabase project from this repository. The SQL migrations, RLS policies and database functions are tested against real PostgreSQL (PGlite) with a Supabase-like auth emulation. Do a full run against a real project before launch.

The earlier paid version ($1 per suggestion through Stripe Checkout) is paused. Its code is kept on the git branch `paid-submissions-v1`; the payment columns and `payment_events` table stay in the database so no records are lost.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional; every variable can stay empty for development mode
npm run dev                  # http://localhost:3000
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Next.js core web vitals + TypeScript rules) |
| `npm test` | Vitest: engine, vote weighting, validation, route handlers, components, and the SQL migrations in PGlite |
| `npm run test:e2e` | Playwright against a production build (run `npm run build` first) on desktop and mobile |
| `npm run check` | typecheck + lint + unit tests |
| `npm run db:seed` | Upserts the 130 seed activities via the Supabase API (service role) |
| `npm run db:seed-sql` | Regenerates `supabase/seed.sql` from `src/lib/activities/seed-data.ts` |

Playwright uses the Chromium that ships with `@playwright/test@1.56.1`. If you don't have it, run `npx playwright install chromium`.

## Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Run the migrations, in order.** Either paste each file in `supabase/migrations/` into the SQL editor and run it (`20261009000000_init.sql`, then `20261015000000_free_submissions_and_votes.sql`, then `20261017000000_skill_videos.sql`), or with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`. If you already ran some of them, run only the newer ones, then re-run the seed (step 3) so skill activities get their video searches.
3. **Seed activities.** Run `supabase/seed.sql` in the SQL editor, or set the env vars and run `npm run db:seed`. Both are idempotent (upsert on `slug`).
4. **Environment variables** (Project settings → API): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
5. **Auth settings** (Authentication → URL configuration): set Site URL to your `NEXT_PUBLIC_SITE_URL`, and add `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback` to the redirect allow list.
6. **Email:** keep "Confirm email" on (recommended). Set up custom SMTP before launch; Supabase's default sender is heavily rate-limited. Confirmation and reset links use the PKCE code flow through `/auth/callback`. If you customise email templates to use token hashes, point them at `/auth/confirm?token_hash={{ .TokenHash }}&type=<type>`.
7. Password rules: the app requires 10+ characters with a letter and a number. Optionally set the same minimum in Authentication → Policies.

### Create the first administrator

Admin rights live only in the server-side `admin_users` table. Users can't write to it, and nothing in the browser decides who is an admin.

1. Sign up normally with the admin's email and confirm it.
2. In the Supabase SQL editor (which runs as the database owner), run:

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'admin@example.com';
```

3. Sign in again. An "Admin" link appears in the header and `/admin` works. Remove access with `delete from public.admin_users where user_id = '...'`.

## How it works

### Folder structure

```
src/app/                  Pages and route handlers (App Router)
  api/…                   JSON API (activities, completion, favourites, daily challenge,
                          votes, leaderboard, submissions, admin)
src/components/           UI (ui/ primitives, activity explorer, panels, forms, admin)
src/lib/activities/       Types/enums, seed data, filter parsing, pure selection engine, repository
src/lib/submissions/      Moderation state machine, safety screen, types
src/lib/videos/           YouTube tutorial lookup (most-viewed relevant video)
src/lib/supabase/         Separate browser, server (SSR cookies) and service-role clients
src/proxy.ts              Refreshes the Supabase session cookie (Next 16 "proxy", formerly middleware)
supabase/migrations/      Schema, RLS, grants and SQL functions
supabase/seed.sql         Generated, idempotent seed
tests/                    Vitest (unit, routes, components, db via PGlite)
e2e/                      Playwright
```

### Activity selection

- `src/lib/activities/engine.ts` is pure and unit tested. All filters apply together; draft/archived rows never pass.
- **Location rule:** an `anywhere` activity also matches the Indoors and Outdoors filters. The Computer filter means "needs a screen" and only matches `computer` activities.
- **Chaos Mode** narrows the pool to chaos activities that match every other filter. If none match, it falls back to a regular activity and says so. It never bypasses filters or publication status. The setting lasts for the browser tab's session.
- The previous activity is excluded whenever another choice exists.
- **Votes weight the pick.** Each activity's weight is `0.2 + (up + 1) / (up + down + 2)`: an unrated activity is 0.7, a well-loved one approaches 1.2 and a disliked one approaches 0.2. So loved activities come up up to six times as often as disliked ones, but nothing disappears because of votes alone. Admins can sort activities by "most downvoted" in `/admin/activities` and archive any that should go.
- The browser fetches the eligible pool once per filter combination (`GET /api/activities`, filtered in SQL, published rows only, max 500) and picks locally, so repeat clicks cost no requests. `GET /api/activities/random` does the same server-side.
- Pools are not cached by a CDN, so archiving takes effect on the next pool load; completion re-checks publication status in the database.

### XP, levels and streaks

- `complete_activity(uuid)` (SQL, `security definer`) reads XP from the activity row, inserts into `activity_completions` with a `unique (user_id, activity_id)` constraint, and only the inserting call awards XP. **Each activity awards XP once per account.** Repeat completions are acknowledged without XP.
- Level = `floor(total_xp / 100) + 1`.
- Streaks use **UTC calendar days**. Completing anything (activity or daily challenge) on the day after the last active day extends the streak; the same day leaves it; a gap resets it to 1. A streak whose last active day is before yesterday displays as 0. New users show 0.
- Clients have no write grants on `user_progress`, `activity_completions` or XP columns.

### Daily challenge

- One row per `challenge_date` (unique). Dates are **UTC**; the reset is 00:00 UTC and the countdown shows the real time remaining.
- Admins can schedule challenges for today (until someone completes it) or future dates. If none is set, the first request of the day stores a deterministic pick from published, non-chaos activities, so it never changes on reload. Future challenges aren't visible to the public.
- Reward = activity XP + 25 bonus, claimable once per user (`primary key (user_id, daily_challenge_id)`), only for the current UTC day.

### Leaderboard

`get_leaderboard()` returns only username, display name, avatar URL, XP and level. Ranking: XP descending, then whoever reached that XP first, then user id. Eligible accounts: not suspended, opted in (`show_on_leaderboard`, toggle in settings), XP > 0. Deleted accounts cascade away. Pages of 25; the signed-in user's rank is shown via `get_my_rank()`.

### YouTube tutorials

- Skill activities have a `video_query` (set in `VIDEO_QUERIES` in `src/lib/activities/seed-data.ts`), such as "how to tie a bowline knot".
- `GET /api/activities/<id>/video` reads the search from the activity row (never from the request). With `YOUTUBE_API_KEY` set, it asks the YouTube Data API for the 10 most relevant embeddable, safe-search videos and returns the one with the most views. Results are cached for a day, which keeps quota use to about one search per skill activity per day (each search costs 101 of the free 10,000 daily units).
- Without a key, or if YouTube fails, the card links to YouTube's results for the same search sorted by view count.
- The card shows the thumbnail, title, channel and view count. The video only loads (from `youtube-nocookie.com`) when someone presses play.
- To get a key: in the [Google Cloud console](https://console.cloud.google.com/), create a project, enable "YouTube Data API v3", then create an API key under APIs & Services → Credentials. Restrict it to that API. Add it as `YOUTUBE_API_KEY` (server only).

### Votes

- `activity_votes` holds one row per user and activity (`primary key (user_id, activity_id)`, value `1` or `-1`). People can only read their own votes; nobody writes to the table directly.
- `cast_vote(activity_id, value)` (SQL, `security definer`) sets, switches or removes (`0`) the caller's vote on a published activity and returns the new totals. Suspended accounts can't vote.
- A trigger keeps `activities.upvotes` and `activities.downvotes` exact, including when an account is deleted and its votes cascade away. Clients can't write those columns.
- `POST /api/activities/<id>/vote` with `{ "value": 1 | -1 | 0 }` takes the user from the session only. The UI updates straight away and rolls back if the server refuses.

### Free submissions

1. A signed-in user fills in the form. Zod validates and trims fields and runs a safety screen; unknown fields (prices, statuses, user ids) are discarded.
2. `create_submission()` stores it in `pending_review`, idempotent per client request id and rate-limited to 10 per account per 24 h. Nothing is published automatically.
3. Admins approve (creates a published activity), reject (reason required) or request changes (owner edits and resubmits). Every action is written to `moderation_audit_log`.

### Database security

- RLS is enabled on every table. Supabase's default "grant all" on new tables is revoked; each table gets only the grants it needs. `profiles` updates are column-limited to username, display name, avatar URL and leaderboard visibility.
- Server-only tables: `admin_users` (no client access), `moderation_audit_log` and the paused `payment_events` (admins can read through RLS; nobody can write from the client).
- Moderation functions check `is_admin()` inside the database, in addition to the route handlers.
- `is_admin()` only answers for the caller.
- The service-role key is only imported in `src/lib/supabase/admin.ts` (marked `server-only`).

### Other security notes

- Redirect targets after login are restricted to same-site paths (`safeRedirectPath`).
- User content is always rendered as text, never as HTML.
- Rate limits: an in-memory per-instance limiter on API routes (60 votes a minute per user), plus the database limit on submissions. For stricter global limits on serverless, replace `src/lib/rate-limit.ts` with a shared store (e.g. Upstash Redis).
- Logs never include secrets, tokens or emails.
- Security headers (nosniff, frame denial, referrer policy) are set in `next.config.ts`.

### Analytics

None. The app doesn't send any data to analytics providers. If you add analytics, keep to aggregate events and never send emails or submission text.

## Deploying to Vercel

1. Import the GitHub repo in Vercel.
2. Add the environment variables from `.env.example` (production values; `NEXT_PUBLIC_SITE_URL` = your domain).
3. Add your domain to the Supabase auth redirect URLs.
4. Deploy. All pages render per request (the header depends on the session), and no private data is cached publicly.

## Testing

- `npm test` runs 98 tests: the generator (filters, Chaos Mode, no repeats, unpublished never returned, vote weighting), YouTube tutorial lookup and fallback, validation and safety screening, XP/streak/daily rules, route-handler authorization (unauthenticated, non-admin, other users' resources, client-supplied ids and statuses ignored), vote buttons (guest prompt, switching, rollback), and the real migrations in PGlite (RLS, grants, idempotent completions, free submissions, moderation, vote counts, rate limits).
- `npm run build && npm run test:e2e` runs 48 Playwright tests on desktop and mobile in development mode: generation, combined filters, empty state and reset, Chaos Mode, vote buttons, YouTube links, guest favourites, keyboard use, no horizontal overflow on every page at 320–1440 px, honest unconfigured states, and protected routes.
- PGlite runs requests one at a time, so "concurrent" completion and vote tests prove the constraints and counting rather than true parallel transactions. The guarantees rely on those constraints and on row locks in the SQL functions.

## Known gaps

- Not yet exercised end to end against a real Supabase project.
- No social sign-in and no image uploads (avatars are https URLs).
- Votes need an account, which limits but doesn't stop someone making several accounts to vote more.
- No admin UI for suspending users (set `profiles.is_suspended` in SQL).
- Legal pages and contact details are placeholders until completed by the operator.

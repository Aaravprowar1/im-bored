# im bored.

Get a random activity that fits your time, place, energy and budget. Press one button, do one thing.

Built with Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, Supabase (Postgres, Auth, RLS) and Stripe Checkout.

- Anyone can generate activities, filter them and use Chaos Mode without an account.
- Accounts add XP, levels, streaks, synced favourites, the daily challenge bonus and the leaderboard.
- Anyone signed in can submit an activity for review for a fixed **US$1.00** fee. Payment pays for review only; a moderator approves, rejects or requests changes.

## Status: what works and what needs configuring

| Area | State |
| --- | --- |
| Activity generator, filters, Chaos Mode, categories | Works with no configuration (uses the bundled seed list, clearly labelled "Development mode"). Uses the database once Supabase is configured. |
| Guest favourites | Works with no configuration (stored in this browser only, labelled as such). |
| Accounts, profiles, XP, streaks, synced favourites, daily challenge bonus, leaderboard | Implemented. **Needs Supabase.** Without it, the UI says accounts aren't set up and never shows sample scores. |
| Paid submissions (Stripe Checkout + webhook) | Implemented. **Needs Supabase, the service role key and Stripe keys.** Without Stripe, checkout is disabled and no payment is ever simulated. |
| Admin moderation | Implemented. Needs Supabase and an admin row (see below). |
| Legal pages | Templates with `[placeholders]`. Must be completed and reviewed by a lawyer before commercial use. |

Nothing here has been run against a live Supabase project or live Stripe account from this repository. The SQL migration, RLS policies and database functions are tested against real PostgreSQL (PGlite) with a Supabase-like auth emulation; Stripe signature verification is tested with the official SDK. Do a full test-mode run (below) before launch.

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
| `npm test` | Vitest: engine, validation, payments, route handlers, components, and the SQL migration in PGlite |
| `npm run test:e2e` | Playwright against a production build (run `npm run build` first) on desktop and mobile |
| `npm run check` | typecheck + lint + unit tests |
| `npm run db:seed` | Upserts the 130 seed activities via the Supabase API (service role) |
| `npm run db:seed-sql` | Regenerates `supabase/seed.sql` from `src/lib/activities/seed-data.ts` |

Playwright uses the Chromium that ships with `@playwright/test@1.56.1`. If you don't have it, run `npx playwright install chromium`.

## Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Run the migration.** Either paste `supabase/migrations/20261009000000_init.sql` into the SQL editor and run it, or with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.
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

## Configure Stripe (test mode)

1. In the Stripe dashboard, switch to **Test mode** and copy the secret key (`sk_test_...`) into `STRIPE_SECRET_KEY`.
2. Local webhooks with the [Stripe CLI](https://docs.stripe.com/stripe-cli):

   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded
   ```

   Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`.
3. Deployed webhooks: Developers → Webhooks → Add endpoint `https://<your-domain>/api/webhooks/stripe` with the five events above, and use that endpoint's signing secret.
4. Test a payment with card `4242 4242 4242 4242`, any future expiry and any CVC. Try `4000 0000 0000 9995` for a decline. Then approve, reject or request changes from `/admin`, and try a refund on a rejected submission.

Never put live keys in `.env.local` used for automated tests. The test suite uses dummy keys and never calls Stripe.

## How it works

### Folder structure

```
src/app/                  Pages and route handlers (App Router)
  api/…                   JSON API (activities, completion, favourites, daily challenge,
                          leaderboard, submissions, checkout, Stripe webhook, admin)
src/components/           UI (ui/ primitives, activity explorer, panels, forms, admin)
src/lib/activities/       Types/enums, seed data, filter parsing, pure selection engine, repository
src/lib/payments/         Fixed fee, checkout creation, webhook interpretation (server only)
src/lib/submissions/      Payment + moderation state machines, safety screen, types
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

### Paid submissions

Payment state (`unpaid → checkout_created → paid | failed`, `paid → refund_pending → refunded`) and moderation state (`pending_payment → pending_review → approved | rejected | needs_changes`) are separate columns with CHECK constraints tying them together (e.g. `approved` requires `paid`).

1. Signed-in user submits the form. Zod validates and trims fields and runs a safety screen; unknown fields (prices, statuses, user ids) are discarded.
2. `create_submission()` stores it as `unpaid / pending_payment`, idempotent per client request id, rate-limited to 10 per account per 24 h.
3. `POST /api/payments/create-checkout-session` takes only the submission id, checks ownership, and creates a Checkout Session for **100 cents, `usd`** (constants in `src/lib/payments/constants.ts`; the database also has `amount_cents = 100` and `currency = 'usd'` constraints). An open session is reused; otherwise the Stripe idempotency key is `submission-checkout:<id>:<attempt>`.
4. Returning from Stripe shows "Payment pending verification" and polls. Only the webhook can mark a submission paid.
5. `POST /api/webhooks/stripe` verifies the signature on the raw body, then calls `apply_payment_event()`, which records the Stripe event id (unique) and applies the transition in one transaction after checking the session id, payment intent, amount and currency. Duplicates and mismatches are recorded and ignored.
6. Paid submissions move to `pending_review`. Nothing is published automatically.
7. Admins approve (creates a published activity), reject (reason required) or request changes (owner edits and resubmits free). Every action is written to `moderation_audit_log`.
8. **Refunds:** an admin can refund a paid, rejected submission from its review page. This creates a Stripe refund (idempotent) and sets `refund_pending`; the `charge.refunded` webhook sets `refunded`. Set your real refund policy in `/terms`.

### Database security

- RLS is enabled on every table. Supabase's default "grant all" on new tables is revoked; each table gets only the grants it needs. `profiles` updates are column-limited to username, display name, avatar URL and leaderboard visibility.
- Server-only tables: `admin_users` (no client access), `payment_events` and `moderation_audit_log` (admins can read through RLS; nobody can write from the client).
- Payment transitions (`apply_payment_event`, `mark_refund_pending`) are executable by `service_role` only. Moderation functions check `is_admin()` inside the database, in addition to the route handlers.
- `is_admin()` only answers for the caller.
- The service-role key is only imported in `src/lib/supabase/admin.ts` (marked `server-only`).

### Other security notes

- Redirect targets after login are restricted to same-site paths (`safeRedirectPath`).
- User content is always rendered as text, never as HTML.
- Rate limits: an in-memory per-instance limiter on API routes, plus the database limit on submissions. For stricter global limits on serverless, replace `src/lib/rate-limit.ts` with a shared store (e.g. Upstash Redis).
- Logs never include secrets, tokens, emails or payment details; webhook warnings log only event ids, types and outcomes.
- Security headers (nosniff, frame denial, referrer policy) are set in `next.config.ts`.

### Analytics

None. The app doesn't send any data to analytics providers. If you add analytics, keep to aggregate events and never send emails, payment data or submission text.

## Deploying to Vercel

1. Import the GitHub repo in Vercel.
2. Add the environment variables from `.env.example` (production values; `NEXT_PUBLIC_SITE_URL` = your domain).
3. Configure the Stripe webhook endpoint for your domain and the Supabase auth redirect URLs.
4. Deploy. All pages render per request (the header depends on the session), and no private data is cached publicly.

## Testing

- `npm test` runs 100 tests: the generator (filters, Chaos Mode, no repeats, unpublished never returned), validation and safety screening, XP/streak/daily rules, payment checkout and webhook logic, route-handler authorization (unauthenticated, non-admin, other users' resources, client-supplied amounts ignored, invalid signatures), payment status screens, and the real migration in PGlite (RLS, grants, idempotent completions and payments, moderation, rate limits).
- `npm run build && npm run test:e2e` runs 44 Playwright tests on desktop and mobile in development mode: generation, combined filters, empty state and reset, Chaos Mode, guest favourites, keyboard use, no horizontal overflow on every page at 320–1440 px, honest unconfigured states, and protected routes.
- PGlite runs requests one at a time, so "concurrent" completion and webhook tests prove the unique constraints rather than true parallel transactions. The guarantees rely on those constraints and on row locks in the SQL functions.

## Known gaps

- Not yet exercised end to end against a real Supabase project and Stripe test account.
- No social sign-in and no image uploads (avatars are https URLs).
- Partial refunds, `refund.failed` and disputes aren't handled automatically; check the Stripe dashboard.
- No admin UI for suspending users (set `profiles.is_suspended` in SQL).
- Legal pages and contact details are placeholders until completed by the operator.

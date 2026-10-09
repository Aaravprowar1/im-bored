import { beforeEach, describe, expect, it } from "vitest";
import { as, createDb, createUser, firstPublishedActivity, type Db } from "./harness";
import {
  ACTIVITY_STATUSES,
  CATEGORIES,
  COST_TYPES,
  DIFFICULTIES,
  ENERGY_LEVELS,
  LOCATIONS,
  PEOPLE_TYPES,
} from "@/lib/activities/types";
import { PAYMENT_STATUSES, MODERATION_STATUSES } from "@/lib/submissions/state";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";

let db: Db;

beforeEach(async () => {
  db = await createDb();
  await createUser(db, ALICE, "Alice!");
  await createUser(db, BOB, "bob");
  await createUser(db, ADMIN, "admin");
  await db.query("insert into public.admin_users (user_id) values ($1)", [ADMIN]);
});

async function expectError(promise: Promise<unknown>, match: RegExp) {
  await expect(promise).rejects.toThrow(match);
}

describe("schema", () => {
  it("SQL check constraints accept exactly the TypeScript enum values", async () => {
    const constraintFor = async (table: string, column: string) => {
      const r = await db.query<{ def: string }>(
        `select pg_get_constraintdef(c.oid) as def from pg_constraint c
         join pg_class t on t.oid = c.conrelid
         where t.relname = $1 and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%' || $2 || '%= ANY%'`,
        [table, column],
      );
      return [...r.rows[0].def.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]).sort();
    };
    expect(await constraintFor("activities", "category")).toEqual([...CATEGORIES].sort());
    expect(await constraintFor("activities", "difficulty")).toEqual([...DIFFICULTIES].sort());
    expect(await constraintFor("activities", "location")).toEqual([...LOCATIONS].sort());
    expect(await constraintFor("activities", "energy_level")).toEqual([...ENERGY_LEVELS].sort());
    expect(await constraintFor("activities", "cost_type")).toEqual([...COST_TYPES].sort());
    expect(await constraintFor("activities", "people_type")).toEqual([...PEOPLE_TYPES].sort());
    expect(await constraintFor("activities", "status")).toEqual([...ACTIVITY_STATUSES].sort());
    expect(await constraintFor("activity_submissions", "payment_status")).toEqual([...PAYMENT_STATUSES].sort());
    expect(await constraintFor("activity_submissions", "moderation_status")).toEqual([...MODERATION_STATUSES].sort());
  });

  it("seeding twice does not duplicate activities", async () => {
    const before = await db.query<{ n: number }>("select count(*)::int n from public.activities");
    const { buildSeedSql } = await import("@/lib/activities/seed-sql");
    await db.exec(buildSeedSql());
    const after = await db.query<{ n: number }>("select count(*)::int n from public.activities");
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(before.rows[0].n).toBeGreaterThanOrEqual(100);
  });

  it("normalises new usernames and creates progress rows", async () => {
    const r = await db.query<{ username: string }>("select username from public.profiles where id = $1", [ALICE]);
    expect(r.rows[0].username).toBe("alice");
    const p = await db.query("select * from public.user_progress where user_id = $1", [ALICE]);
    expect(p.rows).toHaveLength(1);
  });
});

describe("activities visibility", () => {
  it("anon and users only see published activities", async () => {
    await db.exec(`update public.activities set status = 'draft' where slug = 'six-word-story'`);
    await db.exec(`update public.activities set status = 'archived' where slug = 'haiku-of-now'`);
    for (const [role, uid] of [["anon", null], ["authenticated", ALICE]] as const) {
      const r = await as(db, role, uid, () =>
        db.query<{ status: string }>("select distinct status from public.activities"),
      );
      expect(r.rows.map((x) => x.status)).toEqual(["published"]);
    }
    const admin = await as(db, "authenticated", ADMIN, () =>
      db.query<{ n: number }>("select count(distinct status)::int n from public.activities"),
    );
    expect(admin.rows[0].n).toBe(3);
  });

  it("clients cannot write activities", async () => {
    await expectError(
      as(db, "authenticated", ALICE, () => db.exec(`update public.activities set xp_reward = 999`)),
      /permission denied/,
    );
  });
});

describe("completions and XP", () => {
  it("awards server-defined XP exactly once", async () => {
    const activity = await firstPublishedActivity(db);
    const first = await as(db, "authenticated", ALICE, () =>
      db.query<{ r: { awarded: boolean; xp_awarded: number; progress: { total_xp: number } } }>(
        "select public.complete_activity($1) r",
        [activity.id],
      ),
    );
    expect(first.rows[0].r.awarded).toBe(true);
    expect(first.rows[0].r.xp_awarded).toBe(activity.xp_reward);
    expect(first.rows[0].r.progress.total_xp).toBe(activity.xp_reward);

    const second = await as(db, "authenticated", ALICE, () =>
      db.query<{ r: { awarded: boolean; progress: { total_xp: number } } }>(
        "select public.complete_activity($1) r",
        [activity.id],
      ),
    );
    expect(second.rows[0].r.awarded).toBe(false);
    expect(second.rows[0].r.progress.total_xp).toBe(activity.xp_reward);
  });

  it("concurrent requests insert one completion (unique constraint)", async () => {
    const activity = await firstPublishedActivity(db);
    await as(db, "authenticated", ALICE, async () => {
      await Promise.all([
        db.query("select public.complete_activity($1)", [activity.id]),
        db.query("select public.complete_activity($1)", [activity.id]),
        db.query("select public.complete_activity($1)", [activity.id]),
      ]);
    });
    const c = await db.query<{ n: number }>(
      "select count(*)::int n from public.activity_completions where user_id = $1",
      [ALICE],
    );
    const p = await db.query<{ total_xp: number }>("select total_xp from public.user_progress where user_id = $1", [ALICE]);
    expect(c.rows[0].n).toBe(1);
    expect(p.rows[0].total_xp).toBe(activity.xp_reward);
  });

  it("rejects unauthenticated, unknown and unpublished activities", async () => {
    const activity = await firstPublishedActivity(db);
    await expectError(as(db, "anon", null, () => db.query("select public.complete_activity($1)", [activity.id])), /permission denied/);
    await expectError(
      as(db, "authenticated", null, () => db.query("select public.complete_activity($1)", [activity.id])),
      /not_authenticated/,
    );
    await expectError(
      as(db, "authenticated", ALICE, () =>
        db.query("select public.complete_activity($1)", ["11111111-1111-4111-8111-111111111111"]),
      ),
      /activity_not_found/,
    );
    await db.query("update public.activities set status = 'draft' where id = $1", [activity.id]);
    await expectError(
      as(db, "authenticated", ALICE, () => db.query("select public.complete_activity($1)", [activity.id])),
      /activity_not_found/,
    );
  });

  it("users cannot edit XP, suspension or admin status", async () => {
    await expectError(
      as(db, "authenticated", ALICE, () => db.exec(`update public.user_progress set total_xp = 99999`)),
      /permission denied/,
    );
    await expectError(
      as(db, "authenticated", ALICE, () => db.exec(`update public.profiles set is_suspended = false`)),
      /permission denied/,
    );
    await expectError(
      as(db, "authenticated", ALICE, () => db.query(`insert into public.admin_users (user_id) values ($1)`, [ALICE])),
      /permission denied/,
    );
    await expectError(
      as(db, "authenticated", ALICE, () => db.query(`select public._award_progress($1, 1000, 0, 0)`, [ALICE])),
      /permission denied/,
    );
    const isAdmin = await as(db, "authenticated", ALICE, () => db.query<{ a: boolean }>("select public.is_admin() a"));
    expect(isAdmin.rows[0].a).toBe(false);
  });

  it("users can edit their own allowed profile fields only", async () => {
    await as(db, "authenticated", ALICE, () =>
      db.exec(`update public.profiles set display_name = 'Alice A', username = 'alice_a'`),
    );
    const mine = await db.query<{ username: string }>("select username from public.profiles where id = $1", [ALICE]);
    const bob = await db.query<{ username: string }>("select username from public.profiles where id = $1", [BOB]);
    expect(mine.rows[0].username).toBe("alice_a");
    expect(bob.rows[0].username).toBe("bob");
    await expectError(
      as(db, "authenticated", ALICE, () => db.exec(`update public.profiles set username = 'Bad Name'`)),
      /check constraint/,
    );
  });

  it("streaks follow UTC days: same day keeps, next day extends, gap resets", async () => {
    const award = (day: string) => db.query(`select public._award_progress($1, 10, 1, 0, $2::date)`, [ALICE, day]);
    const streak = async () =>
      (await db.query<{ current_streak: number; longest_streak: number }>(
        "select current_streak, longest_streak from public.user_progress where user_id = $1",
        [ALICE],
      )).rows[0];
    await award("2026-01-01");
    expect((await streak()).current_streak).toBe(1);
    await award("2026-01-01");
    expect((await streak()).current_streak).toBe(1);
    await award("2026-01-02");
    await award("2026-01-03");
    expect(await streak()).toEqual({ current_streak: 3, longest_streak: 3 });
    await award("2026-01-05");
    expect(await streak()).toEqual({ current_streak: 1, longest_streak: 3 });
  });
});

describe("favourites", () => {
  it("users manage only their own favourites, without duplicates", async () => {
    const activity = await firstPublishedActivity(db);
    await as(db, "authenticated", ALICE, () =>
      db.query("insert into public.user_favourites (user_id, activity_id) values ($1, $2)", [ALICE, activity.id]),
    );
    await expectError(
      as(db, "authenticated", ALICE, () =>
        db.query("insert into public.user_favourites (user_id, activity_id) values ($1, $2)", [ALICE, activity.id]),
      ),
      /duplicate key/,
    );
    await expectError(
      as(db, "authenticated", ALICE, () =>
        db.query("insert into public.user_favourites (user_id, activity_id) values ($1, $2)", [BOB, activity.id]),
      ),
      /row-level security/,
    );
    const bobSees = await as(db, "authenticated", BOB, () => db.query("select * from public.user_favourites"));
    expect(bobSees.rows).toHaveLength(0);
    await as(db, "authenticated", BOB, () => db.query("delete from public.user_favourites where user_id = $1", [ALICE]));
    const still = await db.query("select * from public.user_favourites where user_id = $1", [ALICE]);
    expect(still.rows).toHaveLength(1);
    await as(db, "authenticated", ALICE, () =>
      db.query("delete from public.user_favourites where activity_id = $1", [activity.id]),
    );
    const gone = await db.query("select * from public.user_favourites where user_id = $1", [ALICE]);
    expect(gone.rows).toHaveLength(0);
  });
});

describe("daily challenge", () => {
  it("is stable for a date and created deterministically", async () => {
    const a = await as(db, "anon", null, () => db.query<{ r: { id: string; title: string } }>("select public.get_daily_challenge() r"));
    const b = await as(db, "anon", null, () => db.query<{ r: { id: string; title: string } }>("select public.get_daily_challenge() r"));
    expect(a.rows[0].r.id).toBe(b.rows[0].r.id);

    // A fresh database with the same seeds picks the same activity for a date.
    const other = await createDb();
    const pick = async (d: Db) =>
      (await d.query<{ title: string }>("select (public._ensure_daily_challenge('2026-03-14')).title")).rows[0].title;
    expect(await pick(db)).toBe(await pick(other));
  });

  it("dates differ by UTC day and future challenges stay hidden", async () => {
    await db.query("select public._ensure_daily_challenge(public.utc_today() + 1)");
    const visible = await as(db, "anon", null, () =>
      db.query<{ n: number }>("select count(*)::int n from public.daily_challenges where challenge_date > public.utc_today()"),
    );
    expect(visible.rows[0].n).toBe(0);
  });

  it("awards the daily bonus once per user", async () => {
    const run = () =>
      as(db, "authenticated", ALICE, () =>
        db.query<{ r: { awarded: boolean; xp_awarded: number } }>("select public.complete_daily_challenge() r"),
      );
    const first = await run();
    const second = await run();
    expect(first.rows[0].r.awarded).toBe(true);
    expect(second.rows[0].r.awarded).toBe(false);
    const p = await db.query<{ total_xp: number; daily_challenges_completed: number }>(
      "select total_xp, daily_challenges_completed from public.user_progress where user_id = $1",
      [ALICE],
    );
    expect(p.rows[0].total_xp).toBe(first.rows[0].r.xp_awarded);
    expect(p.rows[0].daily_challenges_completed).toBe(1);
  });
});

describe("leaderboard", () => {
  it("ranks by XP with stable ties and exposes only public fields", async () => {
    await db.query(`update public.user_progress set total_xp = 50, xp_updated_at = '2026-01-02' where user_id = $1`, [ALICE]);
    await db.query(`update public.user_progress set total_xp = 50, xp_updated_at = '2026-01-01' where user_id = $1`, [BOB]);
    const r = await as(db, "anon", null, () => db.query<Record<string, unknown>>("select * from public.get_leaderboard(10, 0)"));
    expect(r.rows.map((x) => x.username)).toEqual(["bob", "alice"]);
    expect(Object.keys(r.rows[0]).sort()).toEqual(
      ["avatar_url", "display_name", "level", "rank", "total_count", "total_xp", "username"].sort(),
    );
  });

  it("excludes suspended and opted-out accounts", async () => {
    await db.query(`update public.user_progress set total_xp = 10`);
    await db.query(`update public.profiles set is_suspended = true where id = $1`, [ALICE]);
    await db.query(`update public.profiles set show_on_leaderboard = false where id = $1`, [BOB]);
    const r = await as(db, "anon", null, () => db.query<{ username: string }>("select username from public.get_leaderboard(10, 0)"));
    expect(r.rows.map((x) => x.username)).toEqual(["admin"]);
  });

  it("anon cannot read profiles or progress tables directly", async () => {
    await expectError(as(db, "anon", null, () => db.query("select * from public.profiles")), /permission denied/);
    await expectError(as(db, "anon", null, () => db.query("select * from public.user_progress")), /permission denied/);
    const others = await as(db, "authenticated", ALICE, () => db.query("select * from public.user_progress where user_id <> $1", [ALICE]));
    expect(others.rows).toHaveLength(0);
  });
});

const SUBMISSION_ARGS = [
  "A good test idea",
  "Do something interesting for ten minutes and then write about it.",
  "creative",
  10,
  "easy",
  "anywhere",
  "low",
  "free",
  "either",
];

async function createSubmission(user: string, requestId = "22222222-2222-4222-8222-222222222222") {
  const r = await as(db, "authenticated", user, () =>
    db.query<{ id: string }>(
      "select public.create_submission($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) id",
      [requestId, ...SUBMISSION_ARGS],
    ),
  );
  return r.rows[0].id;
}

async function payEvent(eventId: string, submissionId: string | null, session: string | null, to: string | null, from: string[], amount = 100, currency = "usd", pi: string | null = "pi_1") {
  const r = await as(db, "service_role", null, () =>
    db.query<{ outcome: string }>(
      "select public.apply_payment_event($1, 'checkout.session.completed', false, $2, $3, $4, $5, $6, $7, $8) outcome",
      [eventId, submissionId, session, pi, amount, currency, to, from],
    ),
  );
  return r.rows[0].outcome;
}

describe("submissions and payments", () => {
  it("creation is idempotent per request and private to the owner", async () => {
    const id1 = await createSubmission(ALICE);
    const id2 = await createSubmission(ALICE);
    expect(id1).toBe(id2);
    const bobSees = await as(db, "authenticated", BOB, () =>
      db.query("select * from public.activity_submissions where id = $1", [id1]),
    );
    expect(bobSees.rows).toHaveLength(0);
    const anon = as(db, "anon", null, () => db.query("select * from public.activity_submissions"));
    await expectError(anon, /permission denied/);
    const row = await db.query<{ payment_status: string; moderation_status: string; amount_cents: number; currency: string }>(
      "select payment_status, moderation_status, amount_cents, currency from public.activity_submissions where id = $1",
      [id1],
    );
    expect(row.rows[0]).toEqual({ payment_status: "unpaid", moderation_status: "pending_payment", amount_cents: 100, currency: "usd" });
  });

  it("users cannot change payment or moderation state directly", async () => {
    const id = await createSubmission(ALICE);
    await expectError(
      as(db, "authenticated", ALICE, () =>
        db.query("update public.activity_submissions set payment_status = 'paid' where id = $1", [id]),
      ),
      /permission denied/,
    );
    await expectError(
      as(db, "authenticated", ALICE, () =>
        db.query("select public.apply_payment_event('evt_x', 't', false, $1, null, null, 100, 'usd', 'paid', array['unpaid'])", [id]),
      ),
      /permission denied/,
    );
  });

  it("the database refuses any amount other than 100 USD cents", async () => {
    const id = await createSubmission(ALICE);
    await expectError(db.query("update public.activity_submissions set amount_cents = 1000 where id = $1", [id]), /check constraint/);
    await expectError(db.query("update public.activity_submissions set currency = 'inr' where id = $1", [id]), /check constraint/);
  });

  it("applies a verified payment once and moves it to review, not publication", async () => {
    const id = await createSubmission(ALICE);
    await db.query(
      "update public.activity_submissions set payment_status = 'checkout_created', stripe_checkout_session_id = 'cs_1' where id = $1",
      [id],
    );
    expect(await payEvent("evt_1", id, "cs_1", "paid", ["checkout_created", "unpaid"])).toBe("applied");
    expect(await payEvent("evt_1", id, "cs_1", "paid", ["checkout_created", "unpaid"])).toBe("duplicate");
    const row = await db.query<{ payment_status: string; moderation_status: string; published_activity_id: string | null }>(
      "select payment_status, moderation_status, published_activity_id from public.activity_submissions where id = $1",
      [id],
    );
    expect(row.rows[0]).toEqual({ payment_status: "paid", moderation_status: "pending_review", published_activity_id: null });
    const events = await db.query<{ n: number }>("select count(*)::int n from public.payment_events");
    expect(events.rows[0].n).toBe(1);
  });

  it("rejects mismatched sessions and amounts", async () => {
    const id = await createSubmission(ALICE);
    await db.query(
      "update public.activity_submissions set payment_status = 'checkout_created', stripe_checkout_session_id = 'cs_1' where id = $1",
      [id],
    );
    expect(await payEvent("evt_a", id, "cs_other", "paid", ["checkout_created"])).toBe("session_mismatch");
    expect(await payEvent("evt_b", id, "cs_1", "paid", ["checkout_created"], 5000)).toBe("amount_mismatch");
    expect(await payEvent("evt_c", id, "cs_1", "paid", ["checkout_created"], 100, "inr")).toBe("amount_mismatch");
    const row = await db.query<{ payment_status: string }>("select payment_status from public.activity_submissions where id = $1", [id]);
    expect(row.rows[0].payment_status).toBe("checkout_created");
  });

  it("unpaid submissions cannot be approved, and only admins can moderate", async () => {
    const id = await createSubmission(ALICE);
    await expectError(
      as(db, "authenticated", ADMIN, () => db.query("select public.moderate_submission($1, 'approve', null)", [id])),
      /payment_not_verified/,
    );
    await expectError(
      db.query("update public.activity_submissions set moderation_status = 'approved' where id = $1", [id]),
      /check constraint/,
    );
    await db.query(
      "update public.activity_submissions set payment_status = 'checkout_created', stripe_checkout_session_id = 'cs_2' where id = $1",
      [id],
    );
    await payEvent("evt_2", id, "cs_2", "paid", ["checkout_created"]);
    await expectError(
      as(db, "authenticated", ALICE, () => db.query("select public.moderate_submission($1, 'approve', null)", [id])),
      /not_admin/,
    );
    const r = await as(db, "authenticated", ADMIN, () =>
      db.query<{ r: { moderation_status: string; activity_id: string } }>(
        "select public.moderate_submission($1, 'approve', 'Lovely') r",
        [id],
      ),
    );
    expect(r.rows[0].r.moderation_status).toBe("approved");
    const published = await as(db, "anon", null, () =>
      db.query<{ title: string }>("select title from public.activities where id = $1", [r.rows[0].r.activity_id]),
    );
    expect(published.rows[0].title).toBe("A good test idea");
    const audit = await db.query<{ action: string; actor_id: string }>("select action, actor_id from public.moderation_audit_log");
    expect(audit.rows).toEqual([{ action: "approve", actor_id: ADMIN }]);
  });

  it("request changes, resubmit and reject keep an audit trail", async () => {
    const id = await createSubmission(ALICE);
    await db.query("update public.activity_submissions set payment_status = 'checkout_created', stripe_checkout_session_id = 'cs_3' where id = $1", [id]);
    await payEvent("evt_3", id, "cs_3", "paid", ["checkout_created"]);
    await expectError(
      as(db, "authenticated", ADMIN, () => db.query("select public.moderate_submission($1, 'request_changes', '')", [id])),
      /reason_required/,
    );
    await as(db, "authenticated", ADMIN, () => db.query("select public.moderate_submission($1, 'request_changes', 'Shorter title please')", [id]));
    await expectError(
      as(db, "authenticated", BOB, () =>
        db.query("select public.resubmit_submission($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", [id, ...SUBMISSION_ARGS]),
      ),
      /submission_not_found/,
    );
    await as(db, "authenticated", ALICE, () =>
      db.query("select public.resubmit_submission($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", [id, "Shorter idea", ...SUBMISSION_ARGS.slice(1)]),
    );
    await as(db, "authenticated", ADMIN, () => db.query("select public.moderate_submission($1, 'reject', 'Too similar to an existing activity')", [id]));
    const row = await db.query<{ moderation_status: string; payment_status: string; review_notes: string }>(
      "select moderation_status, payment_status, review_notes from public.activity_submissions where id = $1",
      [id],
    );
    expect(row.rows[0]).toEqual({ moderation_status: "rejected", payment_status: "paid", review_notes: "Too similar to an existing activity" });
    const audit = await db.query<{ action: string }>("select action from public.moderation_audit_log order by created_at, action");
    expect(audit.rows.map((r) => r.action).sort()).toEqual(["reject", "request_changes", "resubmit"]);
  });

  it("rate limits submission creation per account", async () => {
    for (let i = 0; i < 10; i++) {
      await createSubmission(BOB, `33333333-3333-4333-8333-${String(i).padStart(12, "0")}`);
    }
    await expectError(createSubmission(BOB, "33333333-3333-4333-8333-999999999999"), /rate_limited/);
  });
});

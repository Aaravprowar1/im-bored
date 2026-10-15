import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "./fake-supabase";

const state: { server: ReturnType<typeof fakeSupabase> | null; admin: ReturnType<typeof fakeSupabase> | null } = { server: null, admin: null };

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.server?.client ?? null }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => state.admin?.client ?? null }));

process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-for-tests-only";

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "u@example.test" };
const OTHER = "22222222-2222-4222-8222-222222222222";
const ACTIVITY = "33333333-3333-4333-8333-333333333333";
const SUB = "44444444-4444-4444-8444-444444444444";

const json = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  state.server = null;
  state.admin = null;
  (await import("@/lib/rate-limit")).resetRateLimits();
});

describe("completion endpoint", () => {
  it("explains when accounts are not configured", async () => {
    const { POST } = await import("@/app/api/activities/[id]/complete/route");
    expect((await POST(new Request("http://x", { method: "POST" }), ctx(ACTIVITY))).status).toBe(503);
  });

  it("rejects unauthenticated requests", async () => {
    state.server = fakeSupabase({ user: null });
    const { POST } = await import("@/app/api/activities/[id]/complete/route");
    expect((await POST(new Request("http://x", { method: "POST" }), ctx(ACTIVITY))).status).toBe(401);
    expect(state.server.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid activity ids before touching the database", async () => {
    state.server = fakeSupabase({ user: USER });
    const { POST } = await import("@/app/api/activities/[id]/complete/route");
    expect((await POST(new Request("http://x", { method: "POST" }), ctx("not-a-uuid"))).status).toBe(404);
    expect(state.server.rpc).not.toHaveBeenCalled();
  });

  it("passes only the activity id to the database; XP is never read from the request", async () => {
    state.server = fakeSupabase({ user: USER, rpc: { complete_activity: { data: { awarded: true, xp_awarded: 20 } } } });
    const { POST } = await import("@/app/api/activities/[id]/complete/route");
    const res = await POST(new Request("http://x", json({ xp: 99999, user_id: OTHER })), ctx(ACTIVITY));
    expect(res.status).toBe(200);
    expect(state.server.rpc).toHaveBeenCalledWith("complete_activity", { p_activity_id: ACTIVITY });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("maps database errors to safe messages", async () => {
    state.server = fakeSupabase({ user: USER, rpc: { complete_activity: { error: { message: "activity_not_found" } } } });
    const { POST } = await import("@/app/api/activities/[id]/complete/route");
    const res = await POST(new Request("http://x", { method: "POST" }), ctx(ACTIVITY));
    expect(res.status).toBe(404);
  });
});

describe("favourites endpoint", () => {
  it("uses the session user id, never one from the body", async () => {
    state.server = fakeSupabase({ user: USER });
    const { POST } = await import("@/app/api/favourites/route");
    await POST(new Request("http://x", json({ activityId: ACTIVITY, user_id: OTHER })));
    const chain = state.server.from.mock.results[0].value as { upsert: ReturnType<typeof vi.fn> };
    expect(chain.upsert.mock.calls[0][0]).toEqual({ user_id: USER.id, activity_id: ACTIVITY });
  });
});

describe("submissions", () => {
  const body = {
    title: "Museum of tiny things",
    description: "Collect five tiny objects and write a museum label for each one.",
    category: "creative",
    duration_minutes: 20,
    difficulty: "easy",
    location: "indoors",
    energy_level: "low",
    cost_type: "free",
    people_type: "either",
    client_request_id: "55555555-5555-4555-8555-555555555555",
  };

  it("requires authentication", async () => {
    state.server = fakeSupabase({ user: null });
    const { POST } = await import("@/app/api/submissions/route");
    expect((await POST(new Request("http://x", json(body)))).status).toBe(401);
  });

  it("rejects invalid submissions before anything is stored", async () => {
    state.server = fakeSupabase({ user: USER });
    const { POST } = await import("@/app/api/submissions/route");
    const res = await POST(new Request("http://x", json({ ...body, title: "" })));
    expect(res.status).toBe(400);
    expect((await res.json()).error.fields.title).toBeTruthy();
    expect(state.server.rpc).not.toHaveBeenCalled();
  });

  it("stores a valid submission for free, ignoring any status or price in the body", async () => {
    state.server = fakeSupabase({ user: USER, rpc: { create_submission: { data: SUB } } });
    const { POST } = await import("@/app/api/submissions/route");
    const res = await POST(new Request("http://x", json({ ...body, moderation_status: "approved", amount_cents: 0, submitter_id: OTHER })));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: SUB });
    const [fn, args] = state.server.rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(fn).toBe("create_submission");
    expect(Object.keys(args).sort()).toEqual([
      "p_category", "p_client_request_id", "p_cost_type", "p_description", "p_difficulty",
      "p_duration_minutes", "p_energy_level", "p_location", "p_people_type", "p_title",
    ]);
  });

  it("does not return another user's submission", async () => {
    state.server = fakeSupabase({ user: USER, tables: { activity_submissions: { data: null } } });
    const { GET } = await import("@/app/api/submissions/[id]/route");
    expect((await GET(new Request("http://x"), ctx(SUB))).status).toBe(404);
  });
});

describe("vote endpoint", () => {
  it("explains when accounts are not configured, and requires sign-in", async () => {
    const { POST } = await import("@/app/api/activities/[id]/vote/route");
    expect((await POST(new Request("http://x", json({ value: 1 })), ctx(ACTIVITY))).status).toBe(503);
    state.server = fakeSupabase({ user: null });
    expect((await POST(new Request("http://x", json({ value: 1 })), ctx(ACTIVITY))).status).toBe(401);
  });

  it("rejects bad ids and values before touching the database", async () => {
    state.server = fakeSupabase({ user: USER });
    const { POST } = await import("@/app/api/activities/[id]/vote/route");
    expect((await POST(new Request("http://x", json({ value: 1 })), ctx("not-a-uuid"))).status).toBe(404);
    for (const value of [2, -5, "1", null, 0.5]) {
      expect((await POST(new Request("http://x", json({ value })), ctx(ACTIVITY))).status).toBe(400);
    }
    expect(state.server.rpc).not.toHaveBeenCalledWith("cast_vote", expect.anything());
  });

  it("casts the vote as the session user through cast_vote", async () => {
    state.server = fakeSupabase({ user: USER, rpc: { cast_vote: { data: { upvotes: 3, downvotes: 1, my_vote: -1 } } } });
    const { POST } = await import("@/app/api/activities/[id]/vote/route");
    const res = await POST(new Request("http://x", json({ value: -1, user_id: OTHER, upvotes: 999 })), ctx(ACTIVITY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ upvotes: 3, downvotes: 1, my_vote: -1 });
    expect(state.server.rpc).toHaveBeenCalledWith("cast_vote", { p_activity_id: ACTIVITY, p_value: -1 });
  });

  it("maps database errors to safe messages", async () => {
    state.server = fakeSupabase({ user: USER, rpc: { cast_vote: { error: { message: "activity_not_found", code: "P0002" } } } });
    const { POST } = await import("@/app/api/activities/[id]/vote/route");
    const res = await POST(new Request("http://x", json({ value: 1 })), ctx(ACTIVITY));
    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe("That activity isn't available.");
  });
});

describe("admin endpoints", () => {
  it("forbid ordinary users", async () => {
    state.server = fakeSupabase({ user: USER, rpc: { is_admin: { data: false } } });
    const { POST } = await import("@/app/api/admin/submissions/[id]/route");
    const res = await POST(new Request("http://x", json({ action: "approve" })), ctx(SUB));
    expect(res.status).toBe(403);
    expect(state.server.rpc).not.toHaveBeenCalledWith("moderate_submission", expect.anything());

    const archive = await import("@/app/api/admin/activities/[id]/archive/route");
    expect((await archive.POST(new Request("http://x", json({ reason: "nope" })), ctx(ACTIVITY))).status).toBe(403);
  });

  it("require sign-in", async () => {
    state.server = fakeSupabase({ user: null });
    const { POST } = await import("@/app/api/admin/submissions/[id]/route");
    expect((await POST(new Request("http://x", json({ action: "approve" })), ctx(SUB))).status).toBe(401);
  });

  it("let admins moderate through the audited database function", async () => {
    state.server = fakeSupabase({ user: USER, rpc: { is_admin: { data: true }, moderate_submission: { data: { moderation_status: "approved" } } } });
    const { POST } = await import("@/app/api/admin/submissions/[id]/route");
    const res = await POST(new Request("http://x", json({ action: "approve", notes: "nice" })), ctx(SUB));
    expect(res.status).toBe(200);
    expect(state.server.rpc).toHaveBeenCalledWith("moderate_submission", { p_submission_id: SUB, p_action: "approve", p_notes: "nice" });
  });
});

describe("profile endpoint", () => {
  it("only updates allowed fields", async () => {
    state.server = fakeSupabase({ user: USER });
    const { PATCH } = await import("@/app/api/profile/route");
    await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ display_name: "Me", is_admin: true, total_xp: 1e6, id: OTHER }) }));
    const chain = state.server.from.mock.results[0].value as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
    expect(chain.update.mock.calls[0][0]).toEqual({ display_name: "Me" });
    expect(chain.eq).toHaveBeenCalledWith("id", USER.id);
  });
});

describe("public API responses", () => {
  it("activity pool exposes only public fields (development seed mode)", async () => {
    const { GET } = await import("@/app/api/activities/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://x/api/activities?time=15&location=outdoors"));
    const body = await res.json();
    expect(body.source).toBe("local-seed");
    expect(body.activities.length).toBeGreaterThan(0);
    for (const a of body.activities) {
      expect(a.duration_minutes).toBeLessThanOrEqual(15);
      expect(["outdoors", "anywhere"]).toContain(a.location);
      expect(a).not.toHaveProperty("status");
      expect(a).not.toHaveProperty("source");
      expect(a).toMatchObject({ upvotes: 0, downvotes: 0 });
    }
  });

  it("leaderboard is honest when accounts are not configured", async () => {
    const { GET } = await import("@/app/api/leaderboard/route");
    const { NextRequest } = await import("next/server");
    expect(await (await GET(new NextRequest("http://x/api/leaderboard"))).json()).toEqual({ configured: false, entries: [], total: 0, page: 1 });
  });
});

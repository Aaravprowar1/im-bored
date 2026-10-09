import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { fakeSupabase } from "./fake-supabase";

const state: { server: ReturnType<typeof fakeSupabase> | null; admin: ReturnType<typeof fakeSupabase> | null } = { server: null, admin: null };

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.server?.client ?? null }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => state.admin?.client ?? null }));

const createSession = vi.fn(async () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1", expires_at: 2_000_000_000 }));
vi.mock("@/lib/payments/stripe", async () => {
  const real = new (await import("stripe")).default("sk_test_dummy");
  return {
    getStripe: () => ({
      checkout: { sessions: { create: createSession, retrieve: vi.fn() } },
      refunds: { create: vi.fn() },
      webhooks: real.webhooks,
    }),
  };
});

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_route_test";
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
  createSession.mockClear();
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

  it("rejects invalid submissions before anything is stored or charged", async () => {
    state.server = fakeSupabase({ user: USER });
    const { POST } = await import("@/app/api/submissions/route");
    const res = await POST(new Request("http://x", json({ ...body, title: "" })));
    expect(res.status).toBe(400);
    expect((await res.json()).error.fields.title).toBeTruthy();
    expect(state.server.rpc).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("does not return another user's submission", async () => {
    state.server = fakeSupabase({ user: USER, tables: { activity_submissions: { data: null } } });
    const { GET } = await import("@/app/api/submissions/[id]/route");
    expect((await GET(new Request("http://x"), ctx(SUB))).status).toBe(404);
  });
});

describe("checkout endpoint", () => {
  const ownSubmission = {
    id: SUB,
    submitter_id: USER.id,
    title: "x",
    payment_status: "unpaid",
    moderation_status: "pending_payment",
    stripe_checkout_session_id: null,
    checkout_expires_at: null,
    checkout_attempts: 0,
  };

  it("requires authentication", async () => {
    state.server = fakeSupabase({ user: null });
    state.admin = fakeSupabase({});
    const { POST } = await import("@/app/api/payments/create-checkout-session/route");
    expect((await POST(new Request("http://x", json({ submissionId: SUB })))).status).toBe(401);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("ignores client-supplied amounts and currencies", async () => {
    state.server = fakeSupabase({ user: USER, tables: { activity_submissions: { data: ownSubmission } } });
    state.admin = fakeSupabase({ tables: { activity_submissions: { data: [{ id: SUB }], error: null } } });
    const { POST } = await import("@/app/api/payments/create-checkout-session/route");
    const res = await POST(new Request("http://x", json({ submissionId: SUB, amount: 1, unit_amount: 1, currency: "inr" })));
    expect(res.status).toBe(200);
    const [params] = createSession.mock.calls[0] as unknown as [{ line_items: { price_data: { unit_amount: number; currency: string } }[] }];
    expect(params.line_items[0].price_data).toMatchObject({ unit_amount: 100, currency: "usd" });
    expect(state.admin.updates[0].values).toMatchObject({ payment_status: "checkout_created", stripe_checkout_session_id: "cs_1" });
  });

  it("refuses to create a checkout for someone else's submission", async () => {
    state.server = fakeSupabase({ user: USER, tables: { activity_submissions: { data: { ...ownSubmission, submitter_id: OTHER } } } });
    state.admin = fakeSupabase({});
    const { POST } = await import("@/app/api/payments/create-checkout-session/route");
    expect((await POST(new Request("http://x", json({ submissionId: SUB })))).status).toBe(404);
    expect(createSession).not.toHaveBeenCalled();
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

describe("stripe webhook route", () => {
  const stripe = new Stripe("sk_test_dummy");
  const event = {
    id: "evt_route",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: "cs_1", client_reference_id: SUB, metadata: { submission_id: SUB }, payment_status: "paid", amount_total: 100, currency: "usd", payment_intent: "pi_1" } },
  };

  it("rejects missing and invalid signatures without touching the database", async () => {
    state.admin = fakeSupabase({});
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    expect((await POST(new Request("http://x", { method: "POST", body: JSON.stringify(event) }))).status).toBe(400);
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify(event), headers: { "stripe-signature": "t=1,v1=deadbeef" } }));
    expect(res.status).toBe(400);
    expect(state.admin.rpc).not.toHaveBeenCalled();
  });

  it("applies a correctly signed event through apply_payment_event", async () => {
    state.admin = fakeSupabase({ rpc: { apply_payment_event: { data: "applied" } } });
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const payload = JSON.stringify(event);
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_route_test" });
    const res = await POST(new Request("http://x", { method: "POST", body: payload, headers: { "stripe-signature": header } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, outcome: "applied" });
    expect(state.admin.rpc).toHaveBeenCalledWith("apply_payment_event", expect.objectContaining({ p_event_id: "evt_route", p_to_status: "paid", p_submission_id: SUB }));
  });

  it("returns 500 so Stripe retries when the database fails", async () => {
    state.admin = fakeSupabase({ rpc: { apply_payment_event: { error: { message: "boom" } } } });
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const payload = JSON.stringify({ ...event, id: "evt_fail" });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_route_test" });
    expect((await POST(new Request("http://x", { method: "POST", body: payload, headers: { "stripe-signature": header } }))).status).toBe(500);
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
    }
  });

  it("leaderboard is honest when accounts are not configured", async () => {
    const { GET } = await import("@/app/api/leaderboard/route");
    const { NextRequest } = await import("next/server");
    expect(await (await GET(new NextRequest("http://x/api/leaderboard"))).json()).toEqual({ configured: false, entries: [], total: 0, page: 1 });
  });
});

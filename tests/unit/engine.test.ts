import { describe, expect, it } from "vitest";
import { filterActivities, matchesFilters, pickActivity, voteWeight } from "@/lib/activities/engine";
import { DEFAULT_FILTERS, parseFilters, type ActivityFilters } from "@/lib/activities/filters";
import { SEED_ACTIVITIES } from "@/lib/activities/seed-data";
import type { ActivityStatus, PublicActivity } from "@/lib/activities/types";

type A = PublicActivity & { status?: ActivityStatus };

function make(id: string, patch: Partial<A> = {}): A {
  return {
    id,
    title: `Activity ${id}`,
    description: "Do a thing for a while.",
    category: "creative",
    secondary_category: null,
    duration_minutes: 10,
    difficulty: "easy",
    location: "indoors",
    energy_level: "low",
    cost_type: "free",
    people_type: "either",
    xp_reward: 10,
    is_chaos: false,
    is_featured: false,
    safety_note: null,
    upvotes: 0,
    downvotes: 0,
    video_query: null,
    status: "published",
    ...patch,
  };
}

const f = (patch: Partial<ActivityFilters>): ActivityFilters => ({ ...DEFAULT_FILTERS, ...patch });

const POOL: A[] = [
  make("short-indoor", { duration_minutes: 5 }),
  make("long-outdoor", { duration_minutes: 60, location: "outdoors", energy_level: "high", category: "outdoors" }),
  make("computer", { location: "computer", category: "learn", duration_minutes: 20 }),
  make("anywhere-paid", { location: "anywhere", cost_type: "paid", energy_level: "medium", category: "music", duration_minutes: 30 }),
  make("chaos-1", { is_chaos: true, category: "mischief", duration_minutes: 5 }),
  make("draft", { status: "draft" }),
  make("archived", { status: "archived" }),
];

describe("activity generator", () => {
  it("returns an eligible published activity", () => {
    for (let i = 0; i < 50; i++) {
      const r = pickActivity(POOL, DEFAULT_FILTERS);
      expect(r.kind).toBe("ok");
      if (r.kind === "ok") expect(["draft", "archived"]).not.toContain(r.activity.id);
    }
  });

  it("never returns draft or archived activities, even when they are the only match", () => {
    const pool = [make("d", { status: "draft" }), make("a", { status: "archived" })];
    expect(pickActivity(pool, DEFAULT_FILTERS).kind).toBe("empty");
    expect(filterActivities(POOL, DEFAULT_FILTERS).map((a) => a.id)).not.toContain("draft");
  });

  it("respects duration filters", () => {
    expect(filterActivities(POOL, f({ maxMinutes: 5 })).map((a) => a.id).sort()).toEqual(["chaos-1", "short-indoor"]);
    expect(filterActivities(POOL, f({ maxMinutes: 30 })).every((a) => a.duration_minutes <= 30)).toBe(true);
  });

  it("respects location filters with the documented Anywhere rule", () => {
    expect(filterActivities(POOL, f({ location: "outdoors" })).map((a) => a.id).sort()).toEqual(["anywhere-paid", "long-outdoor"]);
    expect(filterActivities(POOL, f({ location: "computer" })).map((a) => a.id)).toEqual(["computer"]);
    expect(filterActivities(POOL, f({ location: "indoors" })).map((a) => a.id)).toContain("anywhere-paid");
  });

  it("respects category, energy and cost filters", () => {
    expect(filterActivities(POOL, f({ category: "music" })).map((a) => a.id)).toEqual(["anywhere-paid"]);
    expect(filterActivities(POOL, f({ energy: "high" })).map((a) => a.id)).toEqual(["long-outdoor"]);
    expect(filterActivities(POOL, f({ cost: "paid" })).map((a) => a.id)).toEqual(["anywhere-paid"]);
  });

  it("applies all filters together", () => {
    const filters = f({ maxMinutes: 30, location: "outdoors", cost: "paid", energy: "medium" });
    expect(filterActivities(POOL, filters).map((a) => a.id)).toEqual(["anywhere-paid"]);
    expect(pickActivity(POOL, f({ maxMinutes: 5, location: "outdoors" })).kind).toBe("empty");
  });

  it("filters the 130-activity seed library correctly for every combination", () => {
    const seed = SEED_ACTIVITIES.map((a) => ({ ...a, id: a.slug }));
    for (const time of [null, 5, 15, 30, 60] as const)
      for (const location of ["any", "indoors", "outdoors", "computer"] as const)
        for (const energy of ["any", "low", "medium", "high"] as const)
          for (const cost of ["any", "free", "paid"] as const) {
            const filters = f({ maxMinutes: time, location, energy, cost });
            const r = pickActivity(seed, filters);
            if (r.kind === "ok") expect(matchesFilters(r.activity, filters)).toBe(true);
          }
  });

  it("Chaos Mode prefers chaos activities without bypassing other filters", () => {
    for (let i = 0; i < 20; i++) {
      const r = pickActivity(POOL, f({ chaos: true }));
      expect(r.kind === "ok" && r.activity.id).toBe("chaos-1");
    }
    // A category filter that excludes the chaos activity: Chaos Mode can't bring it back.
    const r = pickActivity(POOL, f({ chaos: true, category: "music" }));
    expect(r).toMatchObject({ kind: "ok", chaosFallback: true });
    if (r.kind === "ok") expect(r.activity.id).toBe("anywhere-paid");
  });

  it("does not repeat the previous activity when alternatives exist", () => {
    const pool = [make("a"), make("b")];
    let previous: string | null = null;
    for (let i = 0; i < 30; i++) {
      const r: ReturnType<typeof pickActivity<A>> = pickActivity(pool, DEFAULT_FILTERS, { previousId: previous });
      expect(r.kind).toBe("ok");
      if (r.kind === "ok") {
        expect(r.activity.id).not.toBe(previous);
        previous = r.activity.id;
      }
    }
    const single = pickActivity([make("only")], DEFAULT_FILTERS, { previousId: "only" });
    expect(single.kind === "ok" && single.activity.id).toBe("only");
  });

  it("handles zero matching activities and an empty library", () => {
    expect(pickActivity([], DEFAULT_FILTERS)).toEqual({ kind: "empty" });
    expect(pickActivity(POOL, f({ category: "productivity" }))).toEqual({ kind: "empty" });
  });

  it("picks uniformly from candidates using the injected random source", () => {
    const pool = [make("a"), make("b"), make("c")];
    expect(pickActivity(pool, DEFAULT_FILTERS, { random: () => 0 })).toMatchObject({ activity: { id: "a" } });
    expect(pickActivity(pool, DEFAULT_FILTERS, { random: () => 0.9999 })).toMatchObject({ activity: { id: "c" } });
  });
});

describe("filter parsing", () => {
  it("parses valid params and falls back to permissive defaults", () => {
    expect(parseFilters(new URLSearchParams("time=15&location=outdoors&energy=high&cost=free&category=music&chaos=1"))).toEqual({
      maxMinutes: 15,
      location: "outdoors",
      energy: "high",
      cost: "free",
      category: "music",
      chaos: true,
    });
    expect(parseFilters(new URLSearchParams("time=7&location=moon&category=<script>&chaos=yes"))).toEqual(DEFAULT_FILTERS);
  });
});

describe("seed library", () => {
  it("has at least 100 distinct, published-ready activities", () => {
    expect(SEED_ACTIVITIES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(SEED_ACTIVITIES.map((a) => a.slug)).size).toBe(SEED_ACTIVITIES.length);
    expect(new Set(SEED_ACTIVITIES.map((a) => a.title.toLowerCase())).size).toBe(SEED_ACTIVITIES.length);
    expect(SEED_ACTIVITIES.filter((a) => a.is_chaos).length).toBeGreaterThanOrEqual(10);
    for (const a of SEED_ACTIVITIES) {
      expect(a.duration_minutes).toBeGreaterThan(0);
      expect(Number.isInteger(a.xp_reward) && a.xp_reward >= 0).toBe(true);
    }
  });
});

describe("vote weighting", () => {
  it("favours upvoted activities without ever ruling out downvoted ones", () => {
    expect(voteWeight({ upvotes: 0, downvotes: 0 })).toBeCloseTo(0.7);
    expect(voteWeight({})).toBeCloseTo(0.7);
    expect(voteWeight({ upvotes: 50, downvotes: 0 })).toBeGreaterThan(1.15);
    expect(voteWeight({ upvotes: 0, downvotes: 50 })).toBeLessThan(0.25);
    expect(voteWeight({ upvotes: 0, downvotes: 50 })).toBeGreaterThan(0.2);
    // One vote barely moves an activity.
    expect(voteWeight({ upvotes: 1, downvotes: 0 })).toBeCloseTo(0.2 + 2 / 3);
  });

  it("picks in proportion to the weights with the injected random source", () => {
    const loved = make("loved", { upvotes: 98, downvotes: 0 }); // weight 1.19
    const hated = make("hated", { upvotes: 0, downvotes: 98 }); // weight 0.21
    const pool = [hated, loved];
    const total = voteWeight(hated) + voteWeight(loved);
    const share = voteWeight(hated) / total;
    expect(pickActivity(pool, DEFAULT_FILTERS, { random: () => share - 0.001 })).toMatchObject({ activity: { id: "hated" } });
    expect(pickActivity(pool, DEFAULT_FILTERS, { random: () => share + 0.001 })).toMatchObject({ activity: { id: "loved" } });

    let lovedCount = 0;
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 4000; i++) {
      const r = pickActivity(pool, DEFAULT_FILTERS, { random: rng });
      if (r.kind === "ok" && r.activity.id === "loved") lovedCount++;
    }
    expect(lovedCount / 4000).toBeGreaterThan(0.78);
    expect(lovedCount / 4000).toBeLessThan(0.92);
  });
});

describe("two categories", () => {
  it("an activity with a second category matches either category filter", () => {
    const both = make("both", { category: "music", secondary_category: "social" });
    const base = { maxMinutes: null, location: "any", energy: "any", cost: "any", chaos: false } as const;
    expect(filterActivities([both], { ...base, category: "music" })).toHaveLength(1);
    expect(filterActivities([both], { ...base, category: "social" })).toHaveLength(1);
    expect(filterActivities([both], { ...base, category: "learn" })).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { hashString, msUntilUtcMidnight, pickForDate, utcDateString } from "@/lib/daily/dates";
import { effectiveStreak, levelForXp } from "@/lib/progress/levels";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("levels", () => {
  it("advances one level per 100 XP", () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, intoLevel: 0, toNext: 100 });
    expect(levelForXp(99)).toMatchObject({ level: 1, toNext: 1 });
    expect(levelForXp(100)).toMatchObject({ level: 2, intoLevel: 0 });
    expect(levelForXp(-5).level).toBe(1);
  });
});

describe("streak display", () => {
  it("shows a stored streak only if the last active UTC day is today or yesterday", () => {
    expect(effectiveStreak(4, "2026-10-09", "2026-10-09")).toBe(4);
    expect(effectiveStreak(4, "2026-10-08", "2026-10-09")).toBe(4);
    expect(effectiveStreak(4, "2026-10-07", "2026-10-09")).toBe(0);
    expect(effectiveStreak(0, null, "2026-10-09")).toBe(0);
  });
});

describe("daily dates (UTC)", () => {
  it("uses the UTC calendar date across local midnight boundaries", () => {
    expect(utcDateString(new Date("2026-10-09T23:59:59Z"))).toBe("2026-10-09");
    expect(utcDateString(new Date("2026-10-10T00:00:00Z"))).toBe("2026-10-10");
    expect(utcDateString(new Date("2026-10-09T23:30:00-05:00"))).toBe("2026-10-10");
  });

  it("computes the real time until the 00:00 UTC reset", () => {
    expect(msUntilUtcMidnight(new Date("2026-10-09T23:00:00Z"))).toBe(3_600_000);
    expect(msUntilUtcMidnight(new Date("2026-10-09T00:00:00Z"))).toBe(86_400_000);
  });

  it("picks the same item for the same date regardless of input order", () => {
    const pool = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
    const pick = pickForDate(pool, "2026-10-09", (x) => x.id);
    expect(pickForDate([...pool].reverse(), "2026-10-09", (x) => x.id)).toEqual(pick);
    expect(hashString("2026-10-09")).toBe(hashString("2026-10-09"));
  });
});

describe("safe redirects", () => {
  it("allows same-site paths only", () => {
    expect(safeRedirectPath("/submit?x=1")).toBe("/submit?x=1");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "", null]) {
      expect(safeRedirectPath(bad)).toBe("/");
    }
  });
});

describe("rate limiting", () => {
  it("blocks after the limit within a window and resets after it", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, 0).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, 10).ok).toBe(false);
    expect(rateLimit("k", 3, 1000, 1001).ok).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { BASE_ACTIVITIES, SEED_ACTIVITIES } from "@/lib/activities/seed-data";
import { parseLibrary, parseLibraryLine } from "@/lib/activities/library/parse";
import { coverageGaps, findDuplicates, findUnsafe } from "@/lib/activities/library/quality";
import { CATEGORIES } from "@/lib/activities/types";

describe("activity library", () => {
  it("has at least 900 activities in every category", () => {
    for (const c of CATEGORIES) {
      expect(SEED_ACTIVITIES.filter((a) => a.category === c || a.secondary_category === c).length, c).toBeGreaterThanOrEqual(900);
    }
  });

  it("has no repeated or reworded activities", () => {
    expect(findDuplicates(SEED_ACTIVITIES)).toEqual([]);
  }, 30_000);

  it("passes the submission safety screen and stays within database limits", () => {
    expect(findUnsafe(SEED_ACTIVITIES)).toEqual([]);
    for (const a of SEED_ACTIVITIES) {
      expect(a.slug).toMatch(/^[a-z0-9-]{3,80}$/);
      expect(a.title.length).toBeLessThanOrEqual(120);
      expect(a.description.length).toBeLessThanOrEqual(1000);
    }
  });

  it("has activities for every sensible filter combination", () => {
    for (const c of CATEGORIES) expect(coverageGaps(SEED_ACTIVITIES, c), c).toEqual([]);
  });

  it("keeps the hand-picked starter set first", () => {
    expect(SEED_ACTIVITIES.slice(0, BASE_ACTIVITIES.length)).toEqual(BASE_ACTIVITIES);
  });
});

describe("library line format", () => {
  it("parses fields and flags", () => {
    const a = parseLibraryLine(
      "learn",
      "Fold a paper crane | Learn the classic crane from one square of paper. | 20 | medium | anywhere | low | free | alone | chaos; safety: Mind the paper cuts.; video: how to fold an origami crane",
      "creative",
    );
    expect(a).toMatchObject({
      slug: "learn-creative-fold-a-paper-crane",
      category: "learn",
      secondary_category: "creative",
      duration_minutes: 20,
      xp_reward: 25,
      is_chaos: true,
      safety_note: "Mind the paper cuts.",
      video_query: "how to fold an origami crane",
    });
  });

  it("reports the line number of a bad line", () => {
    expect(() => parseLibrary("music", "# comment\n\nHum | Hum a tune you love. | 5 | easy | moon | low | free | alone")).toThrow(
      /line 3: location "moon"/,
    );
    expect(() => parseLibrary("music", "Hum | Hum a tune you love. | 5 | easy | indoors | low | free | alone | sparkly")).toThrow(/unknown flag/);
    expect(() => parseLibrary("music", "", "music", "music")).toThrow(/must differ/);
  });
});

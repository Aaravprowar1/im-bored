import { screenSubmission } from "@/lib/submissions/safety";
import { DURATION_OPTIONS, LOCATION_FILTERS, locationsForFilter } from "../filters";
import { ENERGY_LEVELS, type Category } from "../types";
import type { SeedActivity } from "../seed-data";

/**
 * Quality checks for the activity library, shared by the unit tests and
 * scripts/check-library.ts. They catch reworded copies, unsafe wording and
 * filter combinations with nothing to show.
 */

const STOP_WORDS = new Set(
  "a an and are as at be by can do for from get go has have how if in into is it its just like make more of on one or out over so some than that the their them then there these they this to up use what when which while who will with you your yours yourself".split(
    " ",
  ),
);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
}

export function normalisedTitle(title: string): string {
  return words(title).sort().join(" ");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared || 1);
}

export type Problem = { slug: string; problem: string };

export function groupKey(a: Pick<SeedActivity, "category" | "secondary_category">): string {
  return [a.category, a.secondary_category].filter(Boolean).sort().join("+");
}

/**
 * Same slug, the same title words, or descriptions that share most of their
 * words, anywhere in the library. Comparing every pair of 60,000 activities
 * is too slow, so only activities that share an uncommon word are compared.
 */
export function findDuplicates(activities: SeedActivity[], threshold = 0.6): Problem[] {
  const problems: Problem[] = [];
  const slugs = new Map<string, string>();
  const titles = new Map<string, string>();
  for (const a of activities) {
    const prevSlug = slugs.get(a.slug);
    if (prevSlug) problems.push({ slug: a.slug, problem: `slug repeats "${prevSlug}"` });
    slugs.set(a.slug, a.title);
    const t = normalisedTitle(a.title);
    const prevTitle = titles.get(t);
    if (prevTitle) problems.push({ slug: a.slug, problem: `title "${a.title}" matches "${prevTitle}"` });
    titles.set(t, a.title);
  }

  const sets = activities.map((a) => new Set(words(`${a.title} ${a.description}`)));
  const postings = new Map<string, number[]>();
  sets.forEach((set, i) => {
    for (const w of set) {
      const list = postings.get(w);
      if (list) list.push(i);
      else postings.set(w, [i]);
    }
  });
  const rareLimit = Math.max(40, Math.ceil(activities.length / 300));
  const reported = new Set<number>();
  for (let i = 0; i < sets.length; i++) {
    const shared = new Map<number, number>();
    for (const w of sets[i]) {
      const list = postings.get(w)!;
      if (list.length > rareLimit) continue;
      for (const j of list) if (j < i) shared.set(j, (shared.get(j) ?? 0) + 1);
    }
    for (const [j, n] of shared) {
      if (n < 2 || reported.has(i)) continue;
      if (jaccard(sets[i], sets[j]) >= threshold) {
        problems.push({ slug: activities[i].slug, problem: `reads like a copy of "${activities[j].title}"` });
        reported.add(i);
      }
    }
  }
  return problems;
}

export function findUnsafe(activities: SeedActivity[]): Problem[] {
  const problems: Problem[] = [];
  for (const a of activities) {
    const r = screenSubmission(`${a.title}\n${a.description}\n${a.safety_note ?? ""}`);
    if (!r.ok) problems.push({ slug: a.slug, problem: `safety screen: ${r.reason}` });
    if (/[`\\]|\$\{/.test(`${a.title}${a.description}${a.safety_note ?? ""}${a.video_query ?? ""}`)) {
      problems.push({ slug: a.slug, problem: "contains a backtick, backslash or ${" });
    }
  }
  return problems;
}

/** Location filters that make sense for a category (an outdoors activity is never indoors). */
export const SENSIBLE_LOCATIONS: Record<Category, (typeof LOCATION_FILTERS)[number][]> = {
  creative: ["any", "indoors", "outdoors", "computer"],
  brain: ["any", "indoors", "outdoors", "computer"],
  physical: ["any", "indoors", "outdoors"],
  outdoors: ["any", "outdoors"],
  indoors: ["any", "indoors"],
  gaming: ["any", "indoors", "outdoors", "computer"],
  learn: ["any", "indoors", "outdoors", "computer"],
  mischief: ["any", "indoors", "outdoors", "computer"],
  social: ["any", "indoors", "outdoors", "computer"],
  music: ["any", "indoors", "outdoors", "computer"],
  productivity: ["any", "indoors", "outdoors", "computer"],
};

/**
 * Every sensible filter combination for a category should have a few
 * activities: each time limit × location × energy, for free activities, and
 * each time limit of 15 minutes or more × location for paid ones.
 */
export function coverageGaps(activities: SeedActivity[], category: Category, minimum = 3): string[] {
  const gaps: string[] = [];
  const mine = activities.filter((a) => a.category === category || a.secondary_category === category);
  for (const time of DURATION_OPTIONS) {
    for (const location of SENSIBLE_LOCATIONS[category]) {
      const locations = locationsForFilter(location);
      const fits = mine.filter((a) => (time === null || a.duration_minutes <= time) && (!locations || locations.includes(a.location)));
      for (const energy of ENERGY_LEVELS) {
        const n = fits.filter((a) => a.energy_level === energy && a.cost_type === "free").length;
        // High-energy or 5-minute screen activities are a stretch; ask for one.
        const need = location === "computer" && (time === 5 || energy === "high") ? 1 : minimum;
        if (n < need) gaps.push(`${time ?? "any"} min, ${location}, ${energy} energy, free: ${n} (want ${need})`);
      }
      if (time === null || time >= 30) {
        const paid = fits.filter((a) => a.cost_type === "paid").length;
        if (paid < 1) gaps.push(`${time ?? "any"} min, ${location}, paid: ${paid} (want 1)`);
      }
    }
  }
  return gaps;
}

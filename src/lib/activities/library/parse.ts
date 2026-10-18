import {
  CATEGORIES,
  COST_TYPES,
  DIFFICULTIES,
  ENERGY_LEVELS,
  LOCATIONS,
  PEOPLE_TYPES,
  XP_BY_DIFFICULTY,
  type Category,
  type CostType,
  type Difficulty,
  type EnergyLevel,
  type Location,
  type PeopleType,
} from "../types";
import type { SeedActivity } from "../seed-data";

/**
 * The big activity library is stored as one line per activity, which keeps
 * thousands of entries readable and diffable:
 *
 *   Title | Description | minutes | difficulty | location | energy | cost | people | flags
 *
 * flags is optional and holds `;`-separated items: `chaos`, `safety: text`
 * and `video: YouTube search`. Blank lines and lines starting with # are
 * ignored. The slug is made from the categories and title, so don't rename
 * an activity that is live; archive it and add a new one instead.
 *
 * Files named `<category>-<n>.ts` hold one category. Files named
 * `<category>+<category>-<n>.ts` hold activities that belong to both.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function librarySlug(category: Category, title: string, secondary: Category | null = null): string {
  return `${category}-${secondary ? `${secondary}-` : ""}${slugify(title)}`.slice(0, 80).replace(/-+$/, "");
}

function oneOf<T extends string>(values: readonly T[], value: string, field: string): T {
  if (!(values as readonly string[]).includes(value)) throw new Error(`${field} "${value}" must be one of ${values.join(", ")}`);
  return value as T;
}

export function parseLibraryLine(category: Category, line: string, secondary: Category | null = null): SeedActivity {
  const parts = line.split("|").map((p) => p.trim());
  if (parts.length < 8 || parts.length > 9) throw new Error(`expected 8 or 9 fields separated by |, got ${parts.length}`);
  const [title, description, minutesText, difficulty, location, energy, cost, people, flagText = ""] = parts;
  const minutes = Number(minutesText);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error(`minutes "${minutesText}" must be a whole number from 1 to 1440`);
  if (title.length < 3 || title.length > 120) throw new Error("title must be 3 to 120 characters");
  if (description.length < 10 || description.length > 1000) throw new Error("description must be 10 to 1000 characters");

  let chaos = false;
  let safety: string | null = null;
  let video: string | null = null;
  for (const raw of flagText.split(";").map((f) => f.trim()).filter(Boolean)) {
    if (raw === "chaos") chaos = true;
    else if (raw.startsWith("safety:")) safety = raw.slice(7).trim();
    else if (raw.startsWith("video:")) video = raw.slice(6).trim();
    else throw new Error(`unknown flag "${raw}"`);
  }
  if (safety !== null && (safety.length < 5 || safety.length > 300)) throw new Error("safety note must be 5 to 300 characters");
  if (video !== null && (video.length < 3 || video.length > 120)) throw new Error("video search must be 3 to 120 characters");

  const level = oneOf(DIFFICULTIES, difficulty, "difficulty") as Difficulty;
  return {
    slug: librarySlug(category, title, secondary),
    title,
    description,
    category,
    secondary_category: secondary,
    duration_minutes: minutes,
    difficulty: level,
    location: oneOf(LOCATIONS, location, "location") as Location,
    energy_level: oneOf(ENERGY_LEVELS, energy, "energy") as EnergyLevel,
    cost_type: oneOf(COST_TYPES, cost, "cost") as CostType,
    people_type: oneOf(PEOPLE_TYPES, people, "people") as PeopleType,
    xp_reward: XP_BY_DIFFICULTY[level] + (chaos ? 5 : 0),
    is_chaos: chaos,
    is_featured: false,
    safety_note: safety,
    video_query: video,
  };
}

/** Parses one library file. Throws with the line number on the first bad line. */
export function parseLibrary(category: Category, text: string, file: string = category, secondary: Category | null = null): SeedActivity[] {
  oneOf(CATEGORIES, category, "category");
  if (secondary !== null && (oneOf(CATEGORIES, secondary, "second category") === category)) throw new Error("the two categories must differ");
  const out: SeedActivity[] = [];
  text.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    try {
      out.push(parseLibraryLine(category, trimmed, secondary));
    } catch (e) {
      throw new Error(`${file} line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  return out;
}

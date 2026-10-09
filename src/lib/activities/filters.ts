import { z } from "zod";
import {
  CATEGORIES,
  COST_TYPES,
  ENERGY_LEVELS,
  LOCATIONS,
  type Category,
  type CostType,
  type EnergyLevel,
  type Location,
} from "./types";

export const DURATION_OPTIONS = [null, 5, 15, 30, 60] as const;
export type MaxMinutes = (typeof DURATION_OPTIONS)[number];

export const LOCATION_FILTERS = ["any", "indoors", "outdoors", "computer"] as const;
export type LocationFilter = (typeof LOCATION_FILTERS)[number];

export interface ActivityFilters {
  maxMinutes: MaxMinutes;
  location: LocationFilter;
  energy: EnergyLevel | "any";
  cost: CostType | "any";
  category: Category | "any";
  chaos: boolean;
}

export const DEFAULT_FILTERS: ActivityFilters = {
  maxMinutes: null,
  location: "any",
  energy: "any",
  cost: "any",
  category: "any",
  chaos: false,
};

/**
 * Location rules (documented in README):
 * - "anywhere" activities need no particular setting, so they match the
 *   Indoors and Outdoors filters as well.
 * - The Computer filter means "needs a screen", so it only matches activities
 *   tagged "computer".
 */
export function locationsForFilter(filter: LocationFilter): Location[] | null {
  switch (filter) {
    case "any":
      return null;
    case "indoors":
      return ["indoors", "anywhere"];
    case "outdoors":
      return ["outdoors", "anywhere"];
    case "computer":
      return ["computer"];
  }
}

const anyOr = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(["any", ...values] as [string, ...string[]]).catch("any");

const filtersSchema = z.object({
  time: z
    .enum(["any", "5", "15", "30", "60"])
    .catch("any")
    .transform((v) => (v === "any" ? null : (Number(v) as Exclude<MaxMinutes, null>))),
  location: z.enum(LOCATION_FILTERS).catch("any"),
  energy: anyOr(ENERGY_LEVELS),
  cost: anyOr(COST_TYPES),
  category: anyOr(CATEGORIES),
  chaos: z
    .enum(["1", "0", "true", "false"])
    .optional()
    .catch(undefined)
    .transform((v) => v === "1" || v === "true"),
});

/** Parses query params into filters. Unknown or malformed values fall back to "any". */
export function parseFilters(params: URLSearchParams): ActivityFilters {
  const raw = Object.fromEntries(
    ["time", "location", "energy", "cost", "category", "chaos"].map((k) => [k, params.get(k) ?? undefined]),
  );
  const parsed = filtersSchema.parse(raw);
  return {
    maxMinutes: parsed.time,
    location: parsed.location,
    energy: parsed.energy as ActivityFilters["energy"],
    cost: parsed.cost as ActivityFilters["cost"],
    category: parsed.category as ActivityFilters["category"],
    chaos: parsed.chaos,
  };
}

export function filtersToParams(filters: ActivityFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.maxMinutes !== null) p.set("time", String(filters.maxMinutes));
  if (filters.location !== "any") p.set("location", filters.location);
  if (filters.energy !== "any") p.set("energy", filters.energy);
  if (filters.cost !== "any") p.set("cost", filters.cost);
  if (filters.category !== "any") p.set("category", filters.category);
  if (filters.chaos) p.set("chaos", "1");
  return p;
}

export function isDefaultFilters(filters: ActivityFilters): boolean {
  return (
    filters.maxMinutes === null &&
    filters.location === "any" &&
    filters.energy === "any" &&
    filters.cost === "any" &&
    filters.category === "any"
  );
}

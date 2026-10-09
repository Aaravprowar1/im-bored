import { locationsForFilter, type ActivityFilters } from "./filters";
import type { ActivityStatus, PublicActivity } from "./types";

/**
 * Pure activity-selection logic. No I/O here, so it can be unit tested and
 * shared between the API (database-backed pool) and development mode (seed pool).
 */

type Candidate = PublicActivity & { status?: ActivityStatus };

/** Applies every filter except Chaos Mode. Unpublished records never pass. */
export function matchesFilters(activity: Candidate, filters: ActivityFilters): boolean {
  if (activity.status !== undefined && activity.status !== "published") return false;
  if (filters.maxMinutes !== null && activity.duration_minutes > filters.maxMinutes) return false;
  const locations = locationsForFilter(filters.location);
  if (locations && !locations.includes(activity.location)) return false;
  if (filters.energy !== "any" && activity.energy_level !== filters.energy) return false;
  if (filters.cost !== "any" && activity.cost_type !== filters.cost) return false;
  if (filters.category !== "any" && activity.category !== filters.category) return false;
  return true;
}

export function filterActivities<T extends Candidate>(pool: readonly T[], filters: ActivityFilters): T[] {
  return pool.filter((a) => matchesFilters(a, filters));
}

export type PickResult<T> =
  | { kind: "ok"; activity: T; chaosFallback: boolean }
  | { kind: "empty" };

/**
 * Picks a random eligible activity.
 *
 * Chaos Mode narrows the pool to chaos activities when any match the other
 * filters. When none do, it falls back to the regular eligible pool and sets
 * `chaosFallback` so the UI can explain why.
 *
 * The previous activity is excluded whenever another eligible choice exists.
 */
export function pickActivity<T extends Candidate>(
  pool: readonly T[],
  filters: ActivityFilters,
  options: { previousId?: string | null; random?: () => number } = {},
): PickResult<T> {
  const random = options.random ?? Math.random;
  const eligible = filterActivities(pool, filters);
  if (eligible.length === 0) return { kind: "empty" };

  let candidates = eligible;
  let chaosFallback = false;
  if (filters.chaos) {
    const chaotic = eligible.filter((a) => a.is_chaos);
    if (chaotic.length > 0) candidates = chaotic;
    else chaosFallback = true;
  }

  if (options.previousId && candidates.length > 1) {
    const withoutPrevious = candidates.filter((a) => a.id !== options.previousId);
    if (withoutPrevious.length > 0) candidates = withoutPrevious;
  }

  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return { kind: "ok", activity: candidates[index], chaosFallback };
}

export const NO_MATCH_MESSAGE = "No activities match those filters. Try widening your search.";
export const CHAOS_FALLBACK_MESSAGE =
  "No chaos activities match these filters, so here's a regular one. Widen your filters for more chaos.";

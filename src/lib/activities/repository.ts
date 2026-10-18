import "server-only";
import { isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterActivities, pickActivity } from "./engine";
import { locationsForFilter, type ActivityFilters } from "./filters";
import { SEED_ACTIVITIES } from "./seed-data";
import { PUBLIC_ACTIVITY_COLUMNS, type PublicActivity } from "./types";

export type ActivitySource = "database" | "local-seed";

/**
 * In development without Supabase, activities come from the bundled seed
 * file and are labelled as such in the UI. Their ids are their slugs.
 */
const LOCAL_POOL: PublicActivity[] = SEED_ACTIVITIES.map((a) => ({
  id: a.slug,
  title: a.title,
  description: a.description,
  category: a.category,
  secondary_category: a.secondary_category,
  duration_minutes: a.duration_minutes,
  difficulty: a.difficulty,
  location: a.location,
  energy_level: a.energy_level,
  cost_type: a.cost_type,
  people_type: a.people_type,
  xp_reward: a.xp_reward,
  is_chaos: a.is_chaos,
  is_featured: a.is_featured,
  safety_note: a.safety_note,
  upvotes: 0,
  downvotes: 0,
  video_query: a.video_query,
}));

export function activitySource(): ActivitySource {
  return isSupabaseConfigured() ? "database" : "local-seed";
}

export type RandomPick = {
  source: ActivitySource;
  activity: PublicActivity | null;
  chaosFallback: boolean;
  /** How many published activities match the filters (ignoring Chaos Mode). */
  eligible: number;
};

/**
 * Picks one random activity for the filters, weighted by votes, never the
 * previous one when another choice exists. In the database this happens in
 * pick_random_activity(), so only one activity is sent to the browser.
 */
export async function pickRandomActivity(filters: ActivityFilters, previousId: string | null): Promise<RandomPick> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const pool = filterActivities(LOCAL_POOL, filters);
    const result = pickActivity(pool, filters, { previousId });
    return result.kind === "empty"
      ? { source: "local-seed", activity: null, chaosFallback: false, eligible: 0 }
      : { source: "local-seed", activity: result.activity, chaosFallback: result.chaosFallback, eligible: pool.length };
  }
  const { data, error } = await supabase.rpc("pick_random_activity", {
    p_max_minutes: filters.maxMinutes,
    p_locations: locationsForFilter(filters.location),
    p_energy: filters.energy === "any" ? null : filters.energy,
    p_cost: filters.cost === "any" ? null : filters.cost,
    p_category: filters.category === "any" ? null : filters.category,
    p_chaos: filters.chaos,
    p_exclude: previousId && /^[0-9a-f-]{36}$/i.test(previousId) ? previousId : null,
  });
  if (error) throw new Error("Failed to pick an activity");
  const r = data as { eligible: number; chaos_fallback: boolean; activity: PublicActivity | null };
  return { source: "database", activity: r.activity, chaosFallback: r.chaos_fallback, eligible: r.eligible };
}

export async function getActivityById(id: string): Promise<PublicActivity | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return LOCAL_POOL.find((a) => a.id === id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase
    .from("activities")
    .select(PUBLIC_ACTIVITY_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return (data as PublicActivity | null) ?? null;
}

export async function getActivitiesByIds(ids: string[]): Promise<PublicActivity[]> {
  if (ids.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return LOCAL_POOL.filter((a) => ids.includes(a.id));
  const { data } = await supabase
    .from("activities")
    .select(PUBLIC_ACTIVITY_COLUMNS)
    .in("id", ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200))
    .eq("status", "published");
  return (data ?? []) as PublicActivity[];
}

export async function getFeaturedActivities(): Promise<{ source: ActivitySource; activities: PublicActivity[] }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { source: "local-seed", activities: LOCAL_POOL.filter((a) => a.is_featured) };
  const { data, error } = await supabase
    .from("activities")
    .select(PUBLIC_ACTIVITY_COLUMNS)
    .eq("status", "published")
    .eq("is_featured", true)
    .order("title")
    .limit(50);
  if (error) throw new Error("Failed to load featured activities");
  return { source: "database", activities: (data ?? []) as PublicActivity[] };
}

export function localPool() {
  return LOCAL_POOL;
}

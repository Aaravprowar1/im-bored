import "server-only";
import { isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { filterActivities } from "./engine";
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
}));

export function activitySource(): ActivitySource {
  return isSupabaseConfigured() ? "database" : "local-seed";
}

const POOL_LIMIT = 500;

/**
 * Returns published activities matching every filter except Chaos Mode (the
 * engine applies chaos preference). Filtering happens in the SQL query, and
 * RLS independently restricts anon users to published rows.
 */
export async function getEligiblePool(filters: ActivityFilters): Promise<{ source: ActivitySource; activities: PublicActivity[] }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { source: "local-seed", activities: filterActivities(LOCAL_POOL, filters) };

  let query = supabase.from("activities").select(PUBLIC_ACTIVITY_COLUMNS).eq("status", "published");
  if (filters.maxMinutes !== null) query = query.lte("duration_minutes", filters.maxMinutes);
  const locations = locationsForFilter(filters.location);
  if (locations) query = query.in("location", locations);
  if (filters.energy !== "any") query = query.eq("energy_level", filters.energy);
  if (filters.cost !== "any") query = query.eq("cost_type", filters.cost);
  if (filters.category !== "any") query = query.eq("category", filters.category);

  const { data, error } = await query.order("id").limit(POOL_LIMIT);
  if (error) throw new Error("Failed to load activities");
  return { source: "database", activities: (data ?? []) as PublicActivity[] };
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

import "server-only";
import { cache } from "react";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config";
import { utcDateString } from "@/lib/daily/dates";
import { effectiveStreak, type UserProgress } from "@/lib/progress/levels";

export interface Viewer {
  configured: boolean;
  user: null | {
    id: string;
    email: string | null;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    show_on_leaderboard: boolean;
  };
  progress: UserProgress | null;
  favouriteIds: string[];
  isAdmin: boolean;
}

/** Everything the UI needs about the current visitor, read under their own RLS permissions. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) {
    return { configured: isSupabaseConfigured(), user: null, progress: null, favouriteIds: [], isAdmin: false };
  }
  const [profile, progress, favourites, admin] = await Promise.all([
    supabase.from("profiles").select("username,display_name,avatar_url,show_on_leaderboard").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_progress")
      .select("total_xp,activities_completed,daily_challenges_completed,current_streak,longest_streak,last_active_date")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_favourites").select("activity_id").eq("user_id", user.id).limit(500),
    isAdmin(supabase),
  ]);
  const p = progress.data as UserProgress | null;
  return {
    configured: true,
    user: profile.data
      ? { id: user.id, email: user.email, ...(profile.data as Omit<NonNullable<Viewer["user"]>, "id" | "email">) }
      : { id: user.id, email: user.email, username: "new_user", display_name: null, avatar_url: null, show_on_leaderboard: true },
    progress: p ? { ...p, current_streak: effectiveStreak(p.current_streak, p.last_active_date, utcDateString()) } : null,
    favouriteIds: (favourites.data ?? []).map((f) => f.activity_id as string),
    isAdmin: admin,
  };
});

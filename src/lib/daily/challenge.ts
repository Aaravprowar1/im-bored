import "server-only";
import { localPool } from "@/lib/activities/repository";
import type { ServerSupabase } from "@/lib/supabase/server";
import { pickForDate, utcDateString } from "./dates";

export interface DailyChallenge {
  id: string;
  challenge_date: string;
  activity_id: string | null;
  title: string;
  description: string;
  instructions: string | null;
  xp_reward: number;
  completed: boolean;
  source: "database" | "local-seed";
}

export const LOCAL_DAILY_BONUS_XP = 25;

/**
 * Today's challenge (UTC). With Supabase, get_daily_challenge() returns the
 * stored challenge or stores a deterministic pick, so it never changes on
 * reload. Without Supabase, the same deterministic pick is computed locally.
 */
export async function getTodaysChallenge(supabase: ServerSupabase | null): Promise<DailyChallenge | null> {
  if (!supabase) {
    const today = utcDateString();
    const pick = pickForDate(localPool().filter((a) => !a.is_chaos), today, (a) => a.id);
    if (!pick) return null;
    return {
      id: `local-${today}`,
      challenge_date: today,
      activity_id: pick.id,
      title: pick.title,
      description: pick.description,
      instructions: null,
      xp_reward: pick.xp_reward + LOCAL_DAILY_BONUS_XP,
      completed: false,
      source: "local-seed",
    };
  }
  const { data, error } = await supabase.rpc("get_daily_challenge");
  if (error) throw new Error("Failed to load daily challenge");
  if (!data) return null;
  return { ...(data as Omit<DailyChallenge, "source">), source: "database" };
}

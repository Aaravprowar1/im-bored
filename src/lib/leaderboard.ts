import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export const LEADERBOARD_PAGE_SIZE = 25;

export interface LeaderboardEntry {
  rank: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
  level: number;
}

/** Public fields only, ranked in the database (see get_leaderboard). */
export async function getLeaderboard(supabase: ServerSupabase, page = 1, pageSize = LEADERBOARD_PAGE_SIZE) {
  const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: pageSize, p_offset: (page - 1) * pageSize });
  if (error) throw new Error("Failed to load leaderboard");
  const rows = (data ?? []) as (LeaderboardEntry & { total_count: number })[];
  return {
    page,
    pageSize,
    total: rows[0] ? Number(rows[0].total_count) : 0,
    entries: rows.map((r) => ({
      rank: Number(r.rank),
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      total_xp: r.total_xp,
      level: r.level,
    })),
  };
}

export async function getMyRank(supabase: ServerSupabase) {
  const { data } = await supabase.rpc("get_my_rank");
  const row = (data as { rank: number | null; total_xp: number; level: number; eligible: boolean }[] | null)?.[0];
  return row ? { ...row, rank: row.rank === null ? null : Number(row.rank) } : null;
}

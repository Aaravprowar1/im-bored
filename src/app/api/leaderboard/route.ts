import { type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getLeaderboard } from "@/lib/leaderboard";
import { apiError, apiOk } from "@/lib/http";

export async function GET(request: NextRequest) {
  const page = Math.max(1, Math.min(1000, Number(request.nextUrl.searchParams.get("page")) || 1));
  const { supabase } = await getSessionUser();
  if (!supabase) return apiOk({ configured: false, entries: [], total: 0, page });
  try {
    return apiOk({ configured: true, ...(await getLeaderboard(supabase, page)) });
  } catch {
    return apiError("server_error", "Couldn't load the leaderboard.");
  }
}

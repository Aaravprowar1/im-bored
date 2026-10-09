import { type NextRequest } from "next/server";
import { parseFilters } from "@/lib/activities/filters";
import { getActivitiesByIds, getEligiblePool } from "@/lib/activities/repository";
import { apiError, apiOk } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Eligible published activities for a filter set (Chaos Mode is applied by
 * the client-side picker). The browser caches this pool per filter set, so
 * each "give me something" click does not hit the database.
 */
export async function GET(request: NextRequest) {
  if (!rateLimit(clientKey(request), 120, 60_000).ok) return apiError("rate_limited", "Slow down a little.");
  const ids = request.nextUrl.searchParams.get("ids");
  if (ids !== null) {
    // Used to show guest (device-only) favourites. Only published rows are returned.
    const list = ids.split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9-]{3,80}$/i.test(s)).slice(0, 200);
    return apiOk({ activities: await getActivitiesByIds(list).catch(() => []) });
  }
  const filters = parseFilters(request.nextUrl.searchParams);
  try {
    const pool = await getEligiblePool(filters);
    return apiOk(pool);
  } catch {
    return apiError("server_error", "Couldn't load activities. Please try again.");
  }
}

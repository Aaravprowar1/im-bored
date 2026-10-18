import { type NextRequest } from "next/server";
import { getActivitiesByIds } from "@/lib/activities/repository";
import { apiError, apiOk } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Published activities by id (`?ids=a,b,c`, at most 200), used to show guest
 * (device-only) favourites. Random picks come from /api/activities/random.
 */
export async function GET(request: NextRequest) {
  if (!rateLimit(clientKey(request), 120, 60_000).ok) return apiError("rate_limited", "Slow down a little.");
  const ids = request.nextUrl.searchParams.get("ids");
  if (ids === null) return apiError("invalid_input", "Pass ?ids= with activity ids, or use /api/activities/random.");
  const list = ids.split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9-]{3,80}$/i.test(s)).slice(0, 200);
  return apiOk({ activities: await getActivitiesByIds(list).catch(() => []) });
}

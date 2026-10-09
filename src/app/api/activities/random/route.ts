import { type NextRequest } from "next/server";
import { NO_MATCH_MESSAGE, pickActivity } from "@/lib/activities/engine";
import { parseFilters } from "@/lib/activities/filters";
import { getEligiblePool } from "@/lib/activities/repository";
import { apiError, apiOk } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  if (!rateLimit(clientKey(request), 120, 60_000).ok) return apiError("rate_limited", "Slow down a little.");
  const filters = parseFilters(request.nextUrl.searchParams);
  const previousId = request.nextUrl.searchParams.get("exclude");
  try {
    const { source, activities } = await getEligiblePool(filters);
    const result = pickActivity(activities, filters, { previousId });
    if (result.kind === "empty") return apiOk({ source, activity: null, message: NO_MATCH_MESSAGE });
    return apiOk({ source, activity: result.activity, chaosFallback: result.chaosFallback });
  } catch {
    return apiError("server_error", "Couldn't load an activity. Please try again.");
  }
}

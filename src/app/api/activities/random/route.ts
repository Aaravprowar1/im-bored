import { type NextRequest } from "next/server";
import { NO_MATCH_MESSAGE } from "@/lib/activities/engine";
import { isDefaultFilters, parseFilters } from "@/lib/activities/filters";
import { pickRandomActivity } from "@/lib/activities/repository";
import { apiError, apiOk } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * One random published activity for the filters (and Chaos Mode), weighted by
 * votes. `exclude` is the activity currently shown, so the same one doesn't
 * come up twice in a row. `libraryEmpty` means nothing is published at all.
 */
export async function GET(request: NextRequest) {
  if (!rateLimit(clientKey(request), 120, 60_000).ok) return apiError("rate_limited", "Slow down a little.");
  const filters = parseFilters(request.nextUrl.searchParams);
  const previousId = request.nextUrl.searchParams.get("exclude");
  try {
    const { source, activity, chaosFallback, eligible } = await pickRandomActivity(filters, previousId);
    if (!activity) {
      return apiOk({ source, activity: null, message: NO_MATCH_MESSAGE, libraryEmpty: eligible === 0 && isDefaultFilters(filters) });
    }
    return apiOk({ source, activity, chaosFallback });
  } catch {
    return apiError("server_error", "Couldn't load an activity. Please try again.");
  }
}

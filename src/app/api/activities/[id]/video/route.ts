import { getActivityById } from "@/lib/activities/repository";
import { apiError, apiOk } from "@/lib/http";
import { serverConfig } from "@/lib/server-config";
import { findPopularVideo, youtubeSearchUrl, type SkillVideo } from "@/lib/videos/youtube";

/**
 * A popular YouTube tutorial for an activity that teaches a skill. The search
 * comes from the activity row, never from the request. `video` is null when no
 * YouTube API key is set or YouTube has nothing; `searchUrl` always works.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await getActivityById(id).catch(() => null);
  if (!activity?.video_query) return apiError("not_found", "No tutorial for this activity.");

  const query = activity.video_query;
  const key = serverConfig().youtubeApiKey;
  let video: SkillVideo | null = null;
  if (key) {
    try {
      video = await findPopularVideo(query, key);
    } catch {
      // Fall back to the search link. Never log the key or the full URL.
      console.warn("YouTube lookup failed", { activity: id });
    }
  }
  return apiOk({ query, searchUrl: youtubeSearchUrl(query), video }, { cache: "public-day" });
}

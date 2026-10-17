/**
 * Finds a popular YouTube tutorial for a skill activity.
 *
 * With a YouTube Data API key, it takes the ten most relevant embeddable,
 * safe-search videos for the activity's search and picks the one with the
 * most views, so the result is both on-topic and well watched. Without a key
 * (or if YouTube fails), the app links to YouTube's own results for the same
 * search, sorted by view count.
 */

export interface SkillVideo {
  id: string;
  title: string;
  channel: string;
  views: number;
  thumbnail: string;
}

const API = "https://www.googleapis.com/youtube/v3";
/** Results are cached for a day: popular tutorials don't change quickly, and it keeps API quota use small. */
export const VIDEO_CACHE_SECONDS = 60 * 60 * 24;

/** YouTube search results for the query, sorted by view count ("sp=CAM=" is YouTube's view-count sort). */
export function youtubeSearchUrl(query: string): string {
  const params = new URLSearchParams({ search_query: query, sp: "CAM=" });
  return `https://www.youtube.com/results?${params}`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

type Fetch = (input: string, init?: RequestInit & { next?: { revalidate?: number } }) => Promise<Response>;

interface SearchResponse {
  items?: { id?: { videoId?: string } }[];
}
interface VideosResponse {
  items?: {
    id: string;
    snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> };
    statistics?: { viewCount?: string };
  }[];
}

export async function findPopularVideo(query: string, apiKey: string, fetchImpl: Fetch = fetch): Promise<SkillVideo | null> {
  const cache = { next: { revalidate: VIDEO_CACHE_SECONDS } };
  const search = new URLSearchParams({
    part: "id",
    q: query,
    type: "video",
    maxResults: "10",
    order: "relevance",
    safeSearch: "strict",
    videoEmbeddable: "true",
    relevanceLanguage: "en",
    key: apiKey,
  });
  const searchRes = await fetchImpl(`${API}/search?${search}`, cache);
  if (!searchRes.ok) throw new Error(`YouTube search failed (${searchRes.status})`);
  const ids = ((await searchRes.json()) as SearchResponse).items?.map((i) => i.id?.videoId).filter((id): id is string => Boolean(id)) ?? [];
  if (ids.length === 0) return null;

  const details = new URLSearchParams({ part: "snippet,statistics", id: ids.join(","), key: apiKey });
  const videosRes = await fetchImpl(`${API}/videos?${details}`, cache);
  if (!videosRes.ok) throw new Error(`YouTube video lookup failed (${videosRes.status})`);
  const videos = ((await videosRes.json()) as VideosResponse).items ?? [];

  let best: SkillVideo | null = null;
  for (const v of videos) {
    const views = Number(v.statistics?.viewCount ?? 0);
    if (!Number.isFinite(views)) continue;
    if (!best || views > best.views) {
      const thumbs = v.snippet?.thumbnails ?? {};
      best = {
        id: v.id,
        title: v.snippet?.title ?? "YouTube video",
        channel: v.snippet?.channelTitle ?? "",
        views,
        thumbnail: thumbs.high?.url ?? thumbs.medium?.url ?? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      };
    }
  }
  return best;
}

/** "1.2M views", "48K views", "950 views". */
export function formatViews(views: number): string {
  const fmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  return `${fmt.format(views)} ${views === 1 ? "view" : "views"}`;
}

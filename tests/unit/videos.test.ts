import { describe, expect, it, vi } from "vitest";
import { BASE_ACTIVITIES, SEED_ACTIVITIES, VIDEO_QUERIES } from "@/lib/activities/seed-data";
import { findPopularVideo, formatViews, youtubeSearchUrl } from "@/lib/videos/youtube";

const KEY = "AIza-test-key-0000000000000000";

function fakeYouTube(videos: { id: string; views: string | undefined; title?: string }[]) {
  return vi.fn(async (url: string) => {
    const u = new URL(url);
    if (u.pathname.endsWith("/search")) {
      return new Response(JSON.stringify({ items: videos.map((v) => ({ id: { videoId: v.id } })) }));
    }
    const ids = u.searchParams.get("id")!.split(",");
    return new Response(
      JSON.stringify({
        items: videos
          .filter((v) => ids.includes(v.id))
          .map((v) => ({
            id: v.id,
            snippet: { title: v.title ?? `Video ${v.id}`, channelTitle: "Channel", thumbnails: { high: { url: `https://i.ytimg.com/vi/${v.id}/hq.jpg` } } },
            statistics: { viewCount: v.views },
          })),
      }),
    );
  });
}

describe("popular video lookup", () => {
  it("picks the most-viewed of the relevant results", async () => {
    const fetchMock = fakeYouTube([
      { id: "a", views: "1200" },
      { id: "b", views: "5400000", title: "The famous one" },
      { id: "c", views: "880000" },
      { id: "d", views: undefined },
    ]);
    const video = await findPopularVideo("how to tie a bowline knot", KEY, fetchMock);
    expect(video).toEqual({ id: "b", title: "The famous one", channel: "Channel", views: 5_400_000, thumbnail: "https://i.ytimg.com/vi/b/hq.jpg" });
  });

  it("searches safely for embeddable videos and caches for a day", async () => {
    const fetchMock = fakeYouTube([{ id: "a", views: "10" }]);
    await findPopularVideo("learn morse code", KEY, fetchMock);
    const [searchUrl, init] = fetchMock.mock.calls[0] as unknown as [string, { next: { revalidate: number } }];
    const p = new URL(searchUrl).searchParams;
    expect(Object.fromEntries(p)).toMatchObject({
      q: "learn morse code",
      type: "video",
      safeSearch: "strict",
      videoEmbeddable: "true",
      order: "relevance",
      maxResults: "10",
      key: KEY,
    });
    expect(init.next.revalidate).toBe(86400);
  });

  it("returns null when nothing matches and throws on API errors", async () => {
    expect(await findPopularVideo("zzz", KEY, fakeYouTube([]))).toBeNull();
    const failing = vi.fn(async () => new Response("quota", { status: 403 }));
    await expect(findPopularVideo("zzz", KEY, failing)).rejects.toThrow("YouTube search failed (403)");
  });
});

describe("video helpers and seed data", () => {
  it("builds a YouTube search link sorted by view count", () => {
    expect(youtubeSearchUrl("how to juggle & stuff")).toBe("https://www.youtube.com/results?search_query=how+to+juggle+%26+stuff&sp=CAM%3D");
  });

  it("formats view counts compactly", () => {
    expect(formatViews(2_400_000)).toBe("2.4M views");
    expect(formatViews(48_200)).toBe("48.2K views");
    expect(formatViews(950)).toBe("950 views");
    expect(formatViews(1)).toBe("1 view");
  });

  it("gives every video search to a real seed activity, within the database's limits", () => {
    const slugs = new Set(BASE_ACTIVITIES.map((a) => a.slug));
    for (const [slug, query] of Object.entries(VIDEO_QUERIES)) {
      expect(slugs.has(slug), slug).toBe(true);
      expect(query.trim().length).toBeGreaterThanOrEqual(3);
      expect(query.length).toBeLessThanOrEqual(120);
    }
    expect(BASE_ACTIVITIES.filter((a) => a.video_query).length).toBe(Object.keys(VIDEO_QUERIES).length);
    for (const a of SEED_ACTIVITIES.filter((x) => x.video_query)) {
      expect(a.video_query!.trim().length, a.slug).toBeGreaterThanOrEqual(3);
      expect(a.video_query!.length, a.slug).toBeLessThanOrEqual(120);
    }
    expect(Object.keys(VIDEO_QUERIES).length).toBeGreaterThanOrEqual(30);
  });
});

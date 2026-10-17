"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatViews, youtubeSearchUrl, youtubeWatchUrl, type SkillVideo as Video } from "@/lib/videos/youtube";

type State = { status: "loading" } | { status: "ready"; video: Video | null; searchUrl: string };

/**
 * A popular YouTube tutorial for an activity that teaches a skill. Render it
 * with `key={activityId}` so a new activity starts fresh. The video only loads
 * from YouTube when the visitor presses play.
 */
export function SkillVideo({ activityId, query }: { activityId: string; query: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ video: Video | null; searchUrl: string }>(`/api/activities/${encodeURIComponent(activityId)}/video`).then((res) => {
      if (cancelled) return;
      setState(
        res.ok
          ? { status: "ready", video: res.data.video, searchUrl: res.data.searchUrl }
          : { status: "ready", video: null, searchUrl: youtubeSearchUrl(query) },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [activityId, query]);

  return (
    <section aria-label="Video tutorial" className="mt-5 rounded-2xl border border-line bg-bg/60 p-3 sm:p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Learn it on YouTube</p>

      {state.status === "loading" ? (
        <div className="mt-3 flex items-center gap-3" aria-busy="true">
          <div className="aspect-video w-32 shrink-0 animate-pulse rounded-lg bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-line" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-line" />
          </div>
        </div>
      ) : state.video ? (
        <div className="mt-3">
          {playing ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-ink">
              <iframe
                className="size-full"
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(state.video.id)}?autoplay=1&rel=0`}
                title={state.video.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group flex w-full items-center gap-3 text-left"
              aria-label={`Play "${state.video.title}" here`}
            >
              <span className="relative block aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-line sm:w-40">
                {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail, shown as-is */}
                <img src={state.video.thumbnail} alt="" className="size-full object-cover" loading="lazy" />
                <span className="absolute inset-0 flex items-center justify-center bg-ink/20 transition-colors group-hover:bg-ink/35">
                  <span className="flex size-9 items-center justify-center rounded-full bg-card/95 text-ink shadow">
                    <Play className="ml-0.5 size-4 fill-current" aria-hidden />
                  </span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-medium leading-snug">{state.video.title}</span>
                <span className="mt-1 block truncate text-xs text-muted">
                  {state.video.channel ? `${state.video.channel} · ` : ""}
                  {formatViews(state.video.views)}
                </span>
              </span>
            </button>
          )}
          <a
            href={youtubeWatchUrl(state.video.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted underline underline-offset-4 hover:text-ink"
          >
            Open on YouTube <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      ) : (
        <a
          href={state.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-start gap-2 text-sm font-medium underline underline-offset-4 hover:text-ink"
        >
          <Play className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Watch the most-viewed tutorials for &ldquo;{query}&rdquo;</span>
          <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted" aria-hidden />
        </a>
      )}
    </section>
  );
}

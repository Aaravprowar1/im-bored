"use client";

import { Check, Heart, Loader2, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { ActivityMeta, CategoryBadge } from "@/components/activity-meta";
import { Button } from "@/components/ui/button";
import { SkillVideo } from "@/components/skill-video";
import { VoteButtons } from "@/components/votes";
import type { PublicActivity } from "@/lib/activities/types";
import { cn } from "@/lib/cn";

export function ActivityCard({
  activity,
  saved,
  savePending,
  completing,
  onToggleSave,
  onComplete,
  onNext,
  saveScope,
}: {
  activity: PublicActivity;
  saved: boolean;
  savePending?: boolean;
  completing?: boolean;
  onToggleSave: () => void;
  onComplete: () => void;
  onNext: () => void;
  saveScope: "account" | "device";
}) {
  return (
    <article aria-labelledby="activity-title" className="animate-rise flex h-full flex-col" key={activity.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={activity.category} />
          {activity.secondary_category ? <CategoryBadge category={activity.secondary_category} /> : null}
          {activity.is_chaos ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-ink px-3 py-1 text-xs font-medium text-bg">
              <Sparkles className="size-3" aria-hidden /> Chaos
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleSave}
          disabled={savePending}
          aria-pressed={saved}
          aria-label={saved ? `Remove "${activity.title}" from favourites (${saveScope === "account" ? "your account" : "this device"})` : `Save "${activity.title}" to favourites (${saveScope === "account" ? "your account" : "this device"})`}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors",
            saved ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink hover:border-ink/40",
          )}
        >
          <Heart className={cn("size-[18px]", saved && "fill-current")} aria-hidden />
        </button>
      </div>

      <h2 id="activity-title" className="mt-5 font-serif text-3xl leading-[1.05] tracking-tight sm:text-[2.6rem]">
        {activity.title}
      </h2>
      <p className="mt-3 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-muted sm:text-base">{activity.description}</p>
      {activity.safety_note ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-ink/80">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          {activity.safety_note}
        </p>
      ) : null}

      {activity.video_query ? <SkillVideo key={activity.id} activityId={activity.id} query={activity.video_query} /> : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <VoteButtons activity={activity} size="sm" />
        <span className="text-xs text-muted">Good one? Vote it up or down.</span>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <ActivityMeta activity={activity} />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:mt-auto sm:flex-row sm:items-center sm:justify-between sm:pt-6">
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">+{activity.xp_reward} XP</span> when you finish
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" onClick={onNext} className="whitespace-nowrap px-3 text-[13px] sm:px-5 sm:text-sm">
            <RefreshCw className="size-4" aria-hidden /> GOT A NEW ONE
          </Button>
          <Button onClick={onComplete} disabled={completing} className="whitespace-nowrap px-3 text-[13px] sm:px-5 sm:text-sm">
            {completing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            I DID IT
          </Button>
        </div>
      </div>
    </article>
  );
}

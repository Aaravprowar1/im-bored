"use client";

import { Clock, Gauge, Heart, MapPin, RefreshCw, Sparkles, Users, Wallet, Zap, Check, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  COST_LABELS,
  DIFFICULTY_LABELS,
  ENERGY_LABELS,
  LOCATION_LABELS,
  PEOPLE_LABELS,
  type Category,
  type PublicActivity,
} from "@/lib/activities/types";
import { cn } from "@/lib/cn";

export const CATEGORY_TONES: Record<Category, string> = {
  creative: "bg-yellow",
  brain: "bg-blue",
  physical: "bg-peach",
  outdoors: "bg-green",
  indoors: "bg-[#efe9df]",
  gaming: "bg-[#e9e3f4]",
  learn: "bg-blue",
  mischief: "bg-peach",
  social: "bg-[#f6e1ea]",
  music: "bg-[#e9e3f4]",
  productivity: "bg-green",
};

export function formatMinutes(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-ink/10 px-3 py-1 text-xs font-medium", CATEGORY_TONES[category], className)}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function ActivityMeta({ activity }: { activity: PublicActivity }) {
  const items = [
    { icon: Clock, label: "Duration", value: formatMinutes(activity.duration_minutes) },
    { icon: Gauge, label: "Difficulty", value: DIFFICULTY_LABELS[activity.difficulty] },
    { icon: MapPin, label: "Location", value: LOCATION_LABELS[activity.location] },
    { icon: Zap, label: "Energy", value: ENERGY_LABELS[activity.energy_level].replace(" energy", "") },
    { icon: Wallet, label: "Cost", value: COST_LABELS[activity.cost_type] },
    { icon: Users, label: "People", value: PEOPLE_LABELS[activity.people_type] },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">
            <Icon className="size-3.5" aria-hidden />
            {label}
          </dt>
          <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

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

      <div className="mt-6 border-t border-line pt-5">
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

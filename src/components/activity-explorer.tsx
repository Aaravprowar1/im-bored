"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dices, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { ActivityCard } from "@/components/activity-card";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { useToast } from "@/components/toast";
import { useFavourites } from "@/components/use-favourites";
import { useViewer } from "@/components/viewer-context";
import { api } from "@/lib/api-client";
import { CHAOS_FALLBACK_MESSAGE, NO_MATCH_MESSAGE, pickActivity } from "@/lib/activities/engine";
import {
  DEFAULT_FILTERS,
  filtersToParams,
  isDefaultFilters,
  parseFilters,
  type ActivityFilters,
} from "@/lib/activities/filters";
import { CATEGORIES, CATEGORY_LABELS, type PublicActivity } from "@/lib/activities/types";
import { cn } from "@/lib/cn";

const SESSION_KEY = "imbored:filters:v1";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; activity: PublicActivity; chaosFallback: boolean }
  | { kind: "empty"; reason: "filters" | "library" }
  | { kind: "error"; message: string };

type PoolResponse = { source: "database" | "local-seed"; activities: PublicActivity[] };

function poolKey(filters: ActivityFilters) {
  return filtersToParams({ ...filters, chaos: false }).toString();
}

export function ActivityExplorer() {
  const viewer = useViewer();
  const router = useRouter();
  const toast = useToast();
  const favourites = useFavourites();
  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_FILTERS);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [source, setSource] = useState<PoolResponse["source"] | null>(null);
  const [completing, setCompleting] = useState(false);
  const pools = useRef(new Map<string, PublicActivity[]>());
  const previousId = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Restore filters (including Chaos Mode) for this browser tab's session.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(SESSION_KEY);
      // Runs after hydration so server and client render the same defaults first.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setFilters(parseFilters(new URLSearchParams(saved)));
    } catch {
      /* sessionStorage unavailable */
    }
  }, []);

  const updateFilters = useCallback((patch: Partial<ActivityFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.sessionStorage.setItem(SESSION_KEY, filtersToParams(next).toString());
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const loadPool = useCallback(async (f: ActivityFilters) => {
    const key = poolKey(f);
    const cached = pools.current.get(key);
    if (cached) return cached;
    const res = await api<PoolResponse>(`/api/activities?${key}`);
    if (!res.ok) throw new Error(res.error.message);
    setSource(res.data.source);
    pools.current.set(key, res.data.activities);
    return res.data.activities;
  }, []);

  const generate = useCallback(
    async (f: ActivityFilters = filters) => {
      const key = poolKey(f);
      if (!pools.current.has(key)) setStatus({ kind: "loading" });
      try {
        const pool = await loadPool(f);
        const result = pickActivity(pool, f, { previousId: previousId.current });
        if (result.kind === "empty") {
          const library = isDefaultFilters(f) && pool.length === 0;
          setStatus({ kind: "empty", reason: library ? "library" : "filters" });
          return;
        }
        previousId.current = result.activity.id;
        setStatus({ kind: "ready", activity: result.activity, chaosFallback: result.chaosFallback });
      } catch (e) {
        setStatus({ kind: "error", message: e instanceof Error ? e.message : "Couldn't load activities." });
      }
    },
    [filters, loadPool],
  );

  const generateAndReveal = async (f: ActivityFilters = filters) => {
    await generate(f);
    const el = resultRef.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const resetFilters = () => {
    updateFilters({ ...DEFAULT_FILTERS, chaos: filters.chaos });
    setStatus({ kind: "idle" });
  };

  const complete = async (activity: PublicActivity) => {
    if (!viewer.configured) {
      toast("Nice one! Accounts aren't set up on this site yet, so XP isn't saved.");
      return;
    }
    if (!viewer.user) {
      toast(
        <span>
          Nice one! <Link className="font-medium underline" href="/login?next=/">Sign in</Link> to earn XP and track progress.
        </span>,
      );
      return;
    }
    setCompleting(true);
    const res = await api<{ awarded: boolean; xp_awarded: number }>(`/api/activities/${activity.id}/complete`, { method: "POST" });
    setCompleting(false);
    if (!res.ok) {
      toast(res.error.message, "error");
      return;
    }
    toast(
      res.data.awarded ? `Done! +${res.data.xp_awarded} XP` : "You've already earned XP for this one, but nice work doing it again.",
      res.data.awarded ? "success" : "default",
    );
    router.refresh();
  };

  return (
    <div>
      <div className="flex justify-center">
        <Button size="lg" className="w-full max-w-md sm:w-auto" onClick={() => generateAndReveal()} aria-describedby="generate-hint">
          {status.kind === "loading" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Dices className="size-5" aria-hidden />}
          GIVE ME SOMETHING TO DO
        </Button>
      </div>
      <p id="generate-hint" className="sr-only">
        Picks a random activity that matches your filters.
      </p>

      <section aria-label="Activity filters" className="mx-auto mt-8 max-w-4xl">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <FilterSelect
            id="f-time"
            label="Time"
            value={filters.maxMinutes === null ? "any" : String(filters.maxMinutes)}
            onChange={(v) => updateFilters({ maxMinutes: v === "any" ? null : (Number(v) as ActivityFilters["maxMinutes"]) })}
            options={[
              ["any", "Any time"],
              ["5", "5 min or less"],
              ["15", "15 min or less"],
              ["30", "30 min or less"],
              ["60", "60 min or less"],
            ]}
          />
          <FilterSelect
            id="f-location"
            label="Location"
            value={filters.location}
            onChange={(v) => updateFilters({ location: v as ActivityFilters["location"] })}
            options={[
              ["any", "Any location"],
              ["indoors", "Indoors"],
              ["outdoors", "Outdoors"],
              ["computer", "Computer"],
            ]}
          />
          <FilterSelect
            id="f-energy"
            label="Energy"
            value={filters.energy}
            onChange={(v) => updateFilters({ energy: v as ActivityFilters["energy"] })}
            options={[
              ["any", "Any energy"],
              ["low", "Low energy"],
              ["medium", "Medium energy"],
              ["high", "High energy"],
            ]}
          />
          <FilterSelect
            id="f-cost"
            label="Cost"
            value={filters.cost}
            onChange={(v) => updateFilters({ cost: v as ActivityFilters["cost"] })}
            options={[
              ["any", "Free or paid"],
              ["free", "Free"],
              ["paid", "Costs money"],
            ]}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <ChaosToggle checked={filters.chaos} onChange={(chaos) => updateFilters({ chaos })} />
          {!isDefaultFilters(filters) ? (
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted hover:text-ink">
              <RotateCcw className="size-3.5" aria-hidden /> Reset filters
            </button>
          ) : null}
        </div>
      </section>

      <div ref={resultRef} className="mx-auto mt-6 max-w-4xl scroll-mt-24">
        <Card
          className={cn("min-h-[25rem] p-5 transition-shadow sm:p-8", filters.chaos && "ring-2 ring-ink/80 ring-offset-2 ring-offset-bg")}
          aria-live="polite"
          aria-busy={status.kind === "loading"}
        >
          {status.kind === "ready" ? (
            <div className="flex h-full min-h-[21rem] flex-col">
              {status.chaosFallback ? <Notice tone="warning" className="mb-4">{CHAOS_FALLBACK_MESSAGE}</Notice> : null}
              <ActivityCard
                activity={status.activity}
                saved={favourites.ids.has(status.activity.id)}
                savePending={favourites.pending.has(status.activity.id)}
                saveScope={favourites.isAccount ? "account" : "device"}
                completing={completing}
                onToggleSave={() => favourites.toggle(status.activity.id)}
                onComplete={() => complete(status.activity)}
                onNext={() => generate()}
              />
            </div>
          ) : status.kind === "loading" ? (
            <div className="flex min-h-[21rem] flex-col justify-center gap-4" aria-label="Loading an activity">
              <div className="h-6 w-24 animate-pulse rounded-full bg-line" />
              <div className="h-10 w-3/4 animate-pulse rounded-lg bg-line" />
              <div className="h-4 w-full animate-pulse rounded bg-line/70" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-line/70" />
            </div>
          ) : status.kind === "empty" ? (
            <div className="flex min-h-[21rem] flex-col items-center justify-center text-center">
              <p className="font-serif text-3xl">{status.reason === "library" ? "The library is empty." : "Nothing fits."}</p>
              <p className="mt-2 max-w-md text-muted">
                {status.reason === "library"
                  ? "There are no published activities yet. Run the seed script, or check back soon."
                  : NO_MATCH_MESSAGE}
              </p>
              {status.reason === "filters" ? (
                <Button variant="secondary" className="mt-5" onClick={resetFilters}>
                  <RotateCcw className="size-4" aria-hidden /> Reset filters
                </Button>
              ) : null}
            </div>
          ) : status.kind === "error" ? (
            <div className="flex min-h-[21rem] flex-col items-center justify-center text-center">
              <p className="font-serif text-3xl">That didn&apos;t work.</p>
              <p className="mt-2 text-muted">{status.message}</p>
              <Button variant="secondary" className="mt-5" onClick={() => generate()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="flex min-h-[21rem] flex-col items-center justify-center text-center">
              <p className="font-serif text-3xl sm:text-4xl">Your next thing goes here.</p>
              <p className="mt-2 max-w-md text-muted">Set a few filters if you like, then press the big button. No account needed.</p>
            </div>
          )}
        </Card>
        {source === "local-seed" ? (
          <p className="mt-3 text-center text-xs text-muted">
            Development mode: activities come from the built-in seed list because Supabase isn&apos;t configured.
          </p>
        ) : null}
      </div>

      <section aria-labelledby="categories-heading" className="mx-auto mt-12 max-w-6xl">
        <h2 id="categories-heading" className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Categories
        </h2>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <CategoryChip active={filters.category === "any"} onClick={() => { const f = { ...filters, category: "any" as const }; updateFilters(f); generateAndReveal(f); }}>
            All
          </CategoryChip>
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              active={filters.category === c}
              onClick={() => {
                const f = { ...filters, category: c };
                updateFilters({ category: c });
                generateAndReveal(f);
              }}
            >
              {CATEGORY_LABELS[c]}
            </CategoryChip>
          ))}
        </div>
      </section>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(value !== "any" && "border-ink/60 font-medium")}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ChaosToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        id="chaos-mode"
        aria-checked={checked}
        aria-describedby="chaos-desc"
        onClick={() => onChange(!checked)}
        className={cn(
          "group inline-flex h-11 items-center gap-3 rounded-full border pl-1.5 pr-4 text-sm font-medium transition-colors",
          checked ? "border-ink bg-ink text-bg" : "border-line bg-card text-ink hover:border-ink/40",
        )}
      >
        <span
          aria-hidden
          className={cn("relative h-6 w-10 rounded-full transition-colors", checked ? "bg-bg/25" : "bg-line")}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full shadow transition-transform",
              checked ? "translate-x-[1.125rem] bg-yellow" : "translate-x-0.5 bg-card",
            )}
          />
        </span>
        <Sparkles className="size-4" aria-hidden />
        Chaos Mode{checked ? ": on" : ""}
      </button>
      <span id="chaos-desc" className="hidden text-sm text-muted sm:inline">
        {checked ? "Expect the unexpected. Still safe." : "Prefer weird, harmless activities."}
      </span>
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 shrink-0 rounded-full border px-4 text-sm transition-colors",
        active ? "border-ink bg-ink text-bg" : "border-line bg-card hover:border-ink/40",
      )}
    >
      {children}
    </button>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";

type Vote = 1 | 0 | -1;
type Totals = { upvotes: number; downvotes: number };

interface VotesState {
  myVote: (activityId: string) => Vote;
  totals: (activityId: string, fallback: Totals) => Totals;
  cast: (activityId: string, value: Vote, current: Totals) => Promise<void>;
  pending: (activityId: string) => boolean;
}

const VotesContext = createContext<VotesState | null>(null);

/**
 * Votes for the current visitor, shared by every vote control on the page so
 * the same activity shows the same state everywhere. Changes are optimistic
 * and rolled back if the server refuses them.
 */
export function VotesProvider({ children }: { children: React.ReactNode }) {
  const viewer = useViewer();
  const toast = useToast();
  const [mine, setMine] = useState<Record<string, Vote>>(viewer.votes);
  const [counts, setCounts] = useState<Record<string, Totals>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());

  // A new sign-in (or sign-out) brings a different set of votes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(viewer.votes);
  }, [viewer.votes]);

  const cast = useCallback(
    async (activityId: string, value: Vote, current: Totals) => {
      if (!viewer.configured) {
        toast("Voting needs accounts, which aren't set up on this site yet.");
        return;
      }
      if (!viewer.user) {
        toast("Sign in to vote.");
        return;
      }
      if (busy.has(activityId)) return;

      const previous = mine[activityId] ?? 0;
      const optimistic = applyVote(current, previous, value);
      setMine((m) => ({ ...m, [activityId]: value }));
      setCounts((c) => ({ ...c, [activityId]: optimistic }));
      setBusy((b) => new Set(b).add(activityId));

      const res = await api<Totals & { my_vote: Vote }>(`/api/activities/${activityId}/vote`, {
        method: "POST",
        body: JSON.stringify({ value }),
      });
      setBusy((b) => {
        const next = new Set(b);
        next.delete(activityId);
        return next;
      });
      if (!res.ok) {
        setMine((m) => ({ ...m, [activityId]: previous }));
        setCounts((c) => ({ ...c, [activityId]: current }));
        toast(res.error.message, "error");
        return;
      }
      setCounts((c) => ({ ...c, [activityId]: { upvotes: res.data.upvotes, downvotes: res.data.downvotes } }));
    },
    [busy, mine, toast, viewer.configured, viewer.user],
  );

  const value: VotesState = {
    myVote: (id) => mine[id] ?? 0,
    totals: (id, fallback) => counts[id] ?? fallback,
    cast,
    pending: (id) => busy.has(id),
  };
  return <VotesContext.Provider value={value}>{children}</VotesContext.Provider>;
}

/** Totals after changing one person's vote from `from` to `to`. */
export function applyVote(totals: Totals, from: Vote, to: Vote): Totals {
  const up = totals.upvotes - (from === 1 ? 1 : 0) + (to === 1 ? 1 : 0);
  const down = totals.downvotes - (from === -1 ? 1 : 0) + (to === -1 ? 1 : 0);
  return { upvotes: Math.max(0, up), downvotes: Math.max(0, down) };
}

export function VoteButtons({
  activity,
  size = "md",
  className,
}: {
  activity: { id: string; title: string; upvotes: number; downvotes: number };
  size?: "sm" | "md";
  className?: string;
}) {
  const votes = useContext(VotesContext);
  if (!votes) throw new Error("VoteButtons must be used inside VotesProvider");
  const mine = votes.myVote(activity.id);
  const totals = votes.totals(activity.id, { upvotes: activity.upvotes, downvotes: activity.downvotes });
  const pending = votes.pending(activity.id);
  const press = (value: 1 | -1) => votes.cast(activity.id, mine === value ? 0 : value, totals);

  const base = cn(
    "inline-flex items-center gap-1.5 rounded-full border font-medium tabular-nums transition-colors disabled:opacity-60",
    size === "sm" ? "h-8 px-2.5 text-xs" : "h-11 px-3.5 text-sm",
  );
  const icon = size === "sm" ? "size-3.5" : "size-4";
  return (
    <div role="group" aria-label={`Vote on "${activity.title}"`} className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => press(1)}
        disabled={pending}
        aria-pressed={mine === 1}
        aria-label={`Upvote (${totals.upvotes})`}
        className={cn(base, mine === 1 ? "border-success bg-green text-success" : "border-line bg-card text-ink hover:border-ink/40")}
      >
        <ThumbsUp className={cn(icon, mine === 1 && "fill-current")} aria-hidden />
        {totals.upvotes}
      </button>
      <button
        type="button"
        onClick={() => press(-1)}
        disabled={pending}
        aria-pressed={mine === -1}
        aria-label={`Downvote (${totals.downvotes})`}
        className={cn(base, mine === -1 ? "border-danger bg-[#fbe6e4] text-danger" : "border-line bg-card text-ink hover:border-ink/40")}
      >
        <ThumbsDown className={cn(icon, mine === -1 && "fill-current")} aria-hidden />
        {totals.downvotes}
      </button>
    </div>
  );
}

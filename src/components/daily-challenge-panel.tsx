"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { api } from "@/lib/api-client";
import { msUntilUtcMidnight } from "@/lib/daily/dates";
import type { DailyChallenge } from "@/lib/daily/challenge";

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Countdown to the real reset time (00:00 UTC), computed on the client clock. */
function ResetCountdown() {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMs(msUntilUtcMidnight());
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (ms === null) return null;
  return <span>New challenge in {formatCountdown(ms)} (00:00 UTC)</span>;
}

export function DailyChallengePanel({ challenge, error }: { challenge: DailyChallenge | null; error?: boolean }) {
  const viewer = useViewer();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(challenge?.completed ?? false);

  const complete = async () => {
    if (!viewer.configured) return toast("Accounts aren't set up on this site yet, so the bonus can't be saved.");
    if (!viewer.user) return router.push("/login?next=/");
    setBusy(true);
    const res = await api<{ awarded: boolean; xp_awarded: number }>("/api/daily-challenge/complete", { method: "POST" });
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "error");
    setDone(true);
    toast(res.data.awarded ? `Daily challenge done! +${res.data.xp_awarded} XP` : "You've already claimed today's bonus.", res.data.awarded ? "success" : "default");
    router.refresh();
  };

  return (
    <Card tone="peach" className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <Eyebrow className="text-ink/60">Today&apos;s challenge</Eyebrow>
        <CalendarDays className="size-4 text-ink/50" aria-hidden />
      </div>
      {error ? (
        <p className="mt-4 text-sm">Today&apos;s challenge couldn&apos;t be loaded. Refresh to try again.</p>
      ) : !challenge ? (
        <p className="mt-4 text-sm">No challenge is set for today. Check back tomorrow.</p>
      ) : (
        <>
          <h3 className="mt-4 font-serif text-[1.7rem] leading-tight">{challenge.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/75">{challenge.description}</p>
          <div className="mt-auto pt-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium">+{challenge.xp_reward} XP</span>
              <span className="text-xs text-ink/60">
                <ResetCountdown />
              </span>
            </div>
            {done ? (
              <p className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-card/60 text-sm font-medium">
                <Check className="size-4" aria-hidden /> Completed today
              </p>
            ) : (
              <Button className="w-full" onClick={complete} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {viewer.user ? "Mark as done" : viewer.configured ? "Sign in to take it on" : "Mark as done"}
              </Button>
            )}
            <Link href="/challenges" className="mt-3 block text-center text-sm text-ink/70 underline-offset-4 hover:underline">
              More challenges
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}

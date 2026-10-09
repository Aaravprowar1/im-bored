import Link from "next/link";
import { Flame, TrendingUp } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { levelForXp, type UserProgress } from "@/lib/progress/levels";

export function XpBar({ totalXp }: { totalXp: number }) {
  const { level, intoLevel, toNext, progress } = levelForXp(totalXp);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Level {level}</span>
        <span className="text-ink/60">{toNext} XP to level {level + 1}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-card/70"
        role="progressbar"
        aria-label={`Progress to level ${level + 1}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={intoLevel}
      >
        <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

export function ProgressPanel({ configured, signedIn, progress }: { configured: boolean; signedIn: boolean; progress: UserProgress | null }) {
  return (
    <Card tone="green" className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <Eyebrow className="text-ink/60">Your progress</Eyebrow>
        <TrendingUp className="size-4 text-ink/50" aria-hidden />
      </div>
      {!configured ? (
        <p className="mt-4 text-sm leading-relaxed">
          XP and streaks need accounts, which aren&apos;t set up on this site yet. You can still generate as many activities as you like.
        </p>
      ) : !signedIn || !progress ? (
        <>
          <p className="mt-4 font-serif text-[1.7rem] leading-tight">Keep score, if you like.</p>
          <p className="mt-2 text-sm leading-relaxed text-ink/75">Sign in to earn XP, level up, build a streak and save favourites across devices.</p>
          <div className="mt-auto flex gap-2 pt-5">
            <ButtonLink href="/signup" className="flex-1">Sign up</ButtonLink>
            <ButtonLink href="/login?next=/" variant="secondary" className="flex-1">Log in</ButtonLink>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 font-serif text-5xl leading-none">
            {progress.total_xp}
            <span className="ml-1 font-sans text-base text-ink/60">XP</span>
          </p>
          <div className="mt-5">
            <XpBar totalXp={progress.total_xp} />
          </div>
          <dl className="mt-auto grid grid-cols-2 gap-3 pt-5 text-sm">
            <div className="rounded-xl bg-card/60 px-3 py-2.5">
              <dt className="text-xs text-ink/60">Completed</dt>
              <dd className="text-lg font-medium">{progress.activities_completed}</dd>
            </div>
            <div className="rounded-xl bg-card/60 px-3 py-2.5">
              <dt className="flex items-center gap-1 text-xs text-ink/60"><Flame className="size-3" aria-hidden /> Streak</dt>
              <dd className="text-lg font-medium">
                {progress.current_streak} {progress.current_streak === 1 ? "day" : "days"}
              </dd>
            </div>
          </dl>
          <Link href="/profile" className="mt-3 text-center text-sm text-ink/70 underline-offset-4 hover:underline">
            View profile
          </Link>
        </>
      )}
    </Card>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Gauge } from "lucide-react";
import { CategoryBadge, formatMinutes } from "@/components/activity-meta";
import { VoteButtons } from "@/components/votes";
import { CompleteButton } from "@/components/complete-button";
import { DailyChallengePanel } from "@/components/daily-challenge-panel";
import { Card, Container, EmptyState, PageHeading } from "@/components/ui/card";
import { getFeaturedActivities } from "@/lib/activities/repository";
import { CATEGORIES, CATEGORY_LABELS, DIFFICULTIES, DIFFICULTY_LABELS, type Category, type Difficulty } from "@/lib/activities/types";
import { getSessionUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { getTodaysChallenge, type DailyChallenge } from "@/lib/daily/challenge";

export const metadata: Metadata = { title: "Challenges", description: "Today's challenge and featured activities to try." };

type Search = Promise<{ category?: string; difficulty?: string }>;

export default async function ChallengesPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const category = (CATEGORIES as readonly string[]).includes(sp.category ?? "") ? (sp.category as Category) : null;
  const difficulty = (DIFFICULTIES as readonly string[]).includes(sp.difficulty ?? "") ? (sp.difficulty as Difficulty) : null;

  const { supabase, user } = await getSessionUser();
  let challenge: DailyChallenge | null = null;
  let challengeError = false;
  try {
    challenge = await getTodaysChallenge(supabase);
  } catch {
    challengeError = true;
  }

  let featuredError = false;
  let featured: Awaited<ReturnType<typeof getFeaturedActivities>>["activities"] = [];
  try {
    featured = (await getFeaturedActivities()).activities;
  } catch {
    featuredError = true;
  }
  const visible = featured.filter((a) => (!category || a.category === category || a.secondary_category === category) && (!difficulty || a.difficulty === difficulty));

  let completedIds = new Set<string>();
  if (supabase && user && visible.length) {
    const { data } = await supabase
      .from("activity_completions")
      .select("activity_id")
      .eq("user_id", user.id)
      .in("activity_id", visible.map((a) => a.id));
    completedIds = new Set((data ?? []).map((r) => r.activity_id as string));
  }

  const link = (patch: { category?: string | null; difficulty?: string | null }) => {
    const p = new URLSearchParams();
    const c = patch.category !== undefined ? patch.category : category;
    const d = patch.difficulty !== undefined ? patch.difficulty : difficulty;
    if (c) p.set("category", c);
    if (d) p.set("difficulty", d);
    const q = p.toString();
    return q ? `/challenges?${q}` : "/challenges";
  };

  return (
    <Container className="pt-12 sm:pt-16">
      <PageHeading title="Challenges" intro="One daily challenge for everyone, plus a hand-picked set of featured activities. The daily challenge changes at 00:00 UTC." />

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <DailyChallengePanel challenge={challenge} error={challengeError} />
        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">How challenges work</p>
          <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted">
            <li><span className="font-medium text-ink">Daily:</span> the same challenge for every player on a given UTC date, with a {challenge ? `${challenge.xp_reward} XP` : "bonus XP"} reward you can claim once.</li>
            <li><span className="font-medium text-ink">Featured:</span> activities our moderators recommend. Each activity awards XP once per account.</li>
            <li><span className="font-medium text-ink">Honour system:</span> nobody checks your homework. Be honest; it&apos;s more fun.</li>
          </ul>
        </Card>
      </div>

      <section aria-labelledby="featured-heading" className="mt-14">
        <h2 id="featured-heading" className="font-serif text-4xl">Featured</h2>
        <nav aria-label="Filter featured challenges" className="mt-5 space-y-3">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <FilterLink href={link({ category: null })} active={!category}>All categories</FilterLink>
            {CATEGORIES.map((c) => (
              <FilterLink key={c} href={link({ category: c })} active={category === c}>{CATEGORY_LABELS[c]}</FilterLink>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterLink href={link({ difficulty: null })} active={!difficulty}>Any difficulty</FilterLink>
            {DIFFICULTIES.map((d) => (
              <FilterLink key={d} href={link({ difficulty: d })} active={difficulty === d}>{DIFFICULTY_LABELS[d]}</FilterLink>
            ))}
          </div>
        </nav>

        <div className="mt-6">
          {featuredError ? (
            <EmptyState title="Couldn't load challenges.">Please refresh the page to try again.</EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState title="No featured challenges here." action={<Link href="/challenges" className="text-sm font-medium underline underline-offset-4">Clear filters</Link>}>
              {featured.length === 0 ? "Nothing is featured yet." : "Try another category or difficulty."}
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((a) => (
                <li key={a.id}>
                  <Card className="flex h-full flex-col p-5">
                    <div className="flex items-center justify-between gap-2">
                      <CategoryBadge category={a.category} />
                      <span className="text-sm font-medium">+{a.xp_reward} XP</span>
                    </div>
                    <h3 className="mt-4 font-serif text-2xl leading-tight">{a.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{a.description}</p>
                    <VoteButtons activity={a} size="sm" className="mt-4" />
                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      <p className="flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {formatMinutes(a.duration_minutes)}</span>
                        <span className="flex items-center gap-1"><Gauge className="size-3.5" aria-hidden /> {DIFFICULTY_LABELS[a.difficulty]}</span>
                      </p>
                      <CompleteButton activityId={a.id} completed={completedIds.has(a.id)} returnTo="/challenges" />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Container>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm transition-colors",
        active ? "border-ink bg-ink text-bg" : "border-line bg-card hover:border-ink/40",
      )}
    >
      {children}
    </Link>
  );
}

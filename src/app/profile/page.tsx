import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame, Settings } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { FavouritesList } from "@/components/profile/favourites-list";
import { XpBar } from "@/components/progress-panel";
import { ModerationBadge } from "@/components/submit/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Notice, PageHeading } from "@/components/ui/card";
import { PUBLIC_ACTIVITY_COLUMNS, type PublicActivity } from "@/lib/activities/types";
import { getSessionUser } from "@/lib/auth/session";
import { levelForXp } from "@/lib/progress/levels";
import { OWNER_SUBMISSION_COLUMNS, type OwnerSubmission } from "@/lib/submissions/types";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Your profile", robots: { index: false } };

export default async function ProfilePage() {
  const { supabase, user } = await getSessionUser();

  if (!supabase) {
    return (
      <Container className="pt-12 sm:pt-16">
        <PageHeading title="Your favourites" />
        <Notice tone="warning" className="mb-6">Accounts aren&apos;t set up on this site yet. These favourites are saved on this device only.</Notice>
        <FavouritesList accountActivities={null} />
      </Container>
    );
  }
  if (!user) redirect("/login?next=/profile");

  const viewer = await getViewer();
  const [favs, subs, recent] = await Promise.all([
    supabase.from("user_favourites").select(`created_at, activity:activities(${PUBLIC_ACTIVITY_COLUMNS})`).eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("activity_submissions").select(OWNER_SUBMISSION_COLUMNS).eq("submitter_id", user.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("activity_completions").select("completed_at, xp_awarded, activity:activities(title)").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(8),
  ]);
  const favouriteActivities = (favs.data ?? []).map((r) => r.activity as unknown as PublicActivity | null).filter((a): a is PublicActivity => Boolean(a));
  const submissions = (subs.data ?? []) as OwnerSubmission[];
  const completions = (recent.data ?? []) as unknown as { completed_at: string; xp_awarded: number; activity: { title: string } | null }[];
  const progress = viewer.progress ?? { total_xp: 0, activities_completed: 0, daily_challenges_completed: 0, current_streak: 0, longest_streak: 0, last_active_date: null };
  const name = viewer.user?.display_name ?? viewer.user?.username ?? "you";

  return (
    <Container className="pt-12 sm:pt-16">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={name} url={viewer.user?.avatar_url} size={72} />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-4xl leading-none sm:text-5xl">{name}</h1>
            <p className="mt-1 text-muted">@{viewer.user?.username} · Level {levelForXp(progress.total_xp).level}</p>
          </div>
        </div>
        <ButtonLink href="/settings" variant="secondary"><Settings className="size-4" aria-hidden /> Edit profile</ButtonLink>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card tone="green" className="p-6 md:col-span-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Total XP</p>
          <p className="mt-2 font-serif text-6xl leading-none">{progress.total_xp}</p>
          <div className="mt-5"><XpBar totalXp={progress.total_xp} /></div>
        </Card>
        <Card className="grid grid-cols-2 gap-4 p-6 md:col-span-2 md:grid-cols-4">
          <Stat label="Activities done" value={progress.activities_completed} />
          <Stat label="Daily challenges" value={progress.daily_challenges_completed} />
          <Stat label={<span className="flex items-center gap-1"><Flame className="size-3.5" aria-hidden /> Current streak</span>} value={`${progress.current_streak} ${progress.current_streak === 1 ? "day" : "days"}`} />
          <Stat label="Longest streak" value={`${progress.longest_streak} ${progress.longest_streak === 1 ? "day" : "days"}`} />
          <p className="col-span-2 text-xs text-muted md:col-span-4">Streaks count UTC days with at least one completion. Miss a whole UTC day and the streak starts again.</p>
        </Card>
      </div>

      <section className="mt-12" aria-labelledby="fav-heading">
        <h2 id="fav-heading" className="mb-4 font-serif text-3xl">Favourites</h2>
        <FavouritesList accountActivities={favouriteActivities} />
      </section>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="mb-4 font-serif text-3xl">Recently completed</h2>
          {completions.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet. Press &ldquo;I did it&rdquo; after an activity to log it.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
              {completions.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate">{c.activity?.title ?? "Archived activity"}</span>
                  <span className="shrink-0 text-muted">+{c.xp_awarded} XP</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="subs-heading">
          <h2 id="subs-heading" className="mb-4 font-serif text-3xl">Submissions</h2>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted">No submissions yet. <Link className="underline" href="/submit">Suggest an activity</Link>.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
              {submissions.map((s) => (
                <li key={s.id}>
                  <Link href={`/submit/status/${s.id}`} className="flex flex-col gap-2 px-5 py-3 text-sm hover:bg-bg/60">
                    <span className="truncate font-medium">{s.title}</span>
                    <span className="flex flex-wrap gap-2"><ModerationBadge status={s.moderation_status} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Container>
  );
}

function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
    </div>
  );
}

import { ActivityExplorer } from "@/components/activity-explorer";
import { DailyChallengePanel } from "@/components/daily-challenge-panel";
import { LeaderboardPreview } from "@/components/leaderboard-preview";
import { ProgressPanel } from "@/components/progress-panel";
import { SubmissionBanner } from "@/components/submission-banner";
import { Container } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getTodaysChallenge, type DailyChallenge } from "@/lib/daily/challenge";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import { getViewer } from "@/lib/viewer";

export default async function HomePage() {
  const [{ supabase }, viewer] = await Promise.all([getSessionUser(), getViewer()]);

  let challenge: DailyChallenge | null = null;
  let challengeError = false;
  let leaders: LeaderboardEntry[] = [];
  let leadersError = false;
  await Promise.all([
    getTodaysChallenge(supabase)
      .then((c) => (challenge = c))
      .catch(() => (challengeError = true)),
    supabase
      ? getLeaderboard(supabase, 1, 5)
          .then((l) => (leaders = l.entries))
          .catch(() => (leadersError = true))
      : Promise.resolve(),
  ]);

  return (
    <>
      <Container className="pt-14 sm:pt-20">
        <section className="text-center">
          <h1 className="font-serif text-[clamp(4rem,15vw,9.5rem)] leading-[0.85] tracking-[-0.03em]">
            i&rsquo;m bored<span className="text-muted">.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-muted sm:text-lg">
            Get a random activity to do. Explore. Be creative. Do something different.
          </p>
        </section>
        <div className="mt-10">
          <ActivityExplorer />
        </div>
      </Container>

      <Container className="mt-16">
        <h2 className="sr-only">Your dashboard</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <DailyChallengePanel challenge={challenge} error={challengeError} />
          <ProgressPanel configured={viewer.configured} signedIn={Boolean(viewer.user)} progress={viewer.progress} />
          <div className="md:col-span-2 lg:col-span-1">
            <LeaderboardPreview configured={viewer.configured} entries={leaders} error={leadersError} />
          </div>
        </div>
      </Container>

      <Container className="mt-4">
        <SubmissionBanner />
      </Container>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, EmptyState, Notice, PageHeading } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getLeaderboard, getMyRank, LEADERBOARD_PAGE_SIZE } from "@/lib/leaderboard";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Leaderboard", description: "Top players on im bored. by earned XP." };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1));
  const { supabase, user } = await getSessionUser();

  if (!supabase) {
    return (
      <Container className="pt-12 sm:pt-16">
        <PageHeading title="Leaderboard" intro="Top players by earned XP." />
        <EmptyState title="No leaderboard yet.">
          Accounts aren&apos;t set up on this site, so there are no real players to rank. We don&apos;t show made-up scores.
        </EmptyState>
      </Container>
    );
  }

  let data: Awaited<ReturnType<typeof getLeaderboard>> | null = null;
  try {
    data = await getLeaderboard(supabase, page);
  } catch {
    data = null;
  }
  const mine = user ? await getMyRank(supabase) : null;
  const pages = data ? Math.max(1, Math.ceil(data.total / LEADERBOARD_PAGE_SIZE)) : 1;

  return (
    <Container className="pt-12 sm:pt-16">
      <PageHeading title="Leaderboard" intro="Everyone ranked by total XP. Ties go to whoever got there first. Only usernames, display names and avatars are shown." />

      {user && mine ? (
        <Notice tone="success" className="mb-6">
          {mine.eligible && mine.rank
            ? <>You&apos;re ranked <strong>#{mine.rank}</strong> with {mine.total_xp} XP (level {mine.level}).</>
            : mine.total_xp === 0
              ? "Complete an activity to join the leaderboard."
              : <>You&apos;re hidden from the leaderboard. You can change that in <Link className="underline" href="/settings">settings</Link>.</>}
        </Notice>
      ) : null}

      {!data ? (
        <EmptyState title="Couldn't load the leaderboard.">Please refresh to try again.</EmptyState>
      ) : data.entries.length === 0 ? (
        <EmptyState title="Nobody's on the board yet." action={<ButtonLink href="/">Find something to do</ButtonLink>}>
          Complete an activity to earn XP and claim the top spot.
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Leaderboard, page {page} of {pages}</caption>
            <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
              <tr>
                <th scope="col" className="w-16 px-4 py-3 font-medium sm:px-6">Rank</th>
                <th scope="col" className="px-2 py-3 font-medium">Player</th>
                <th scope="col" className="hidden px-2 py-3 text-right font-medium sm:table-cell">Level</th>
                <th scope="col" className="px-4 py-3 text-right font-medium sm:px-6">XP</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.username} className={cn("border-b border-line/70 last:border-0", e.rank <= 3 && "bg-yellow/30")}>
                  <td className="px-4 py-3 font-serif text-xl tabular-nums sm:px-6">{e.rank}</td>
                  <td className="px-2 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={e.display_name ?? e.username} url={e.avatar_url} size={32} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.display_name ?? e.username}</p>
                        <p className="truncate text-xs text-muted">@{e.username}<span className="sm:hidden"> · level {e.level}</span></p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-2 py-3 text-right tabular-nums sm:table-cell">{e.level}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums sm:px-6">{e.total_xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data && pages > 1 ? (
        <nav aria-label="Leaderboard pages" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link className="underline underline-offset-4" href={`/leaderboard?page=${page - 1}`}>Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="underline underline-offset-4" href={`/leaderboard?page=${page + 1}`}>Next</Link> : <span />}
        </nav>
      ) : null}
    </Container>
  );
}

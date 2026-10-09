import Link from "next/link";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Card, Eyebrow } from "@/components/ui/card";
import type { LeaderboardEntry } from "@/lib/leaderboard";

export function LeaderboardPreview({ configured, entries, error }: { configured: boolean; entries: LeaderboardEntry[]; error?: boolean }) {
  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <Eyebrow>Leaderboard</Eyebrow>
        <Trophy className="size-4 text-muted" aria-hidden />
      </div>
      {!configured ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The leaderboard shows real players once accounts are set up. There&apos;s no sample data here.
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-muted">Couldn&apos;t load the leaderboard right now.</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">Nobody has earned XP yet. Complete an activity and you could be first.</p>
      ) : (
        <ol className="mt-4 space-y-1">
          {entries.map((e) => (
            <li key={e.username} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
              <span className="w-5 text-right text-sm tabular-nums text-muted">{e.rank}</span>
              <Avatar name={e.display_name ?? e.username} url={e.avatar_url} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.display_name ?? e.username}</span>
              <span className="text-sm tabular-nums text-muted">{e.total_xp} XP</span>
            </li>
          ))}
        </ol>
      )}
      <Link href="/leaderboard" className="mt-auto pt-5 text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
        See full leaderboard
      </Link>
    </Card>
  );
}

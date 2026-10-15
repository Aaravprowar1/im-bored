import type { Metadata } from "next";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { CategoryBadge } from "@/components/activity-meta";
import { ArchiveButton, DailyChallengeForm } from "@/components/admin/activity-admin";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Card, Container, EmptyState, PageHeading } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import type { Category } from "@/lib/activities/types";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { utcDateString } from "@/lib/daily/dates";

export const metadata: Metadata = { title: "Admin: activities", robots: { index: false, follow: false } };

export default async function AdminActivitiesPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const { supabase } = await requireAdminPage("/admin/activities");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const sort = sp.sort === "downvoted" || sp.sort === "upvoted" ? sp.sort : "title";
  const today = utcDateString();

  let query = supabase.from("activities").select("id,title,category,source,status,upvotes,downvotes").eq("status", "published");
  query =
    sort === "downvoted"
      ? query.order("downvotes", { ascending: false }).order("title")
      : sort === "upvoted"
        ? query.order("upvotes", { ascending: false }).order("title")
        : query.order("title");
  query = query.limit(50);
  if (q) query = query.ilike("title", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const [{ data: list }, { data: all }, { data: upcoming }] = await Promise.all([
    query,
    supabase.from("activities").select("id,title").eq("status", "published").order("title").limit(1000),
    supabase.from("daily_challenges").select("challenge_date,title,selection").gte("challenge_date", today).order("challenge_date").limit(14),
  ]);

  return (
    <Container className="pt-12 sm:pt-16">
      <PageHeading title="Activities" intro="Archive published activities if a problem is reported or people keep voting them down, and schedule daily challenges." />
      <AdminNav active="activities" />

      <Card className="p-6">
        <h2 className="font-serif text-3xl">Daily challenge</h2>
        <p className="mt-1 text-sm text-muted">If no challenge is set for a date, one is picked automatically and stays fixed for that day. Today&apos;s challenge can only be changed before anyone completes it.</p>
        <div className="mt-5"><DailyChallengeForm activities={all ?? []} today={today} /></div>
        {upcoming && upcoming.length ? (
          <ul className="mt-5 space-y-1 text-sm">
            {upcoming.map((d) => (
              <li key={d.challenge_date} className="flex justify-between gap-3"><span>{d.challenge_date}</span><span className="truncate text-muted">{d.title} ({d.selection})</span></li>
            ))}
          </ul>
        ) : null}
      </Card>

      <section className="mt-10">
        <form action="/admin/activities" className="flex flex-wrap gap-2">
          <label htmlFor="aq" className="sr-only">Search activities</label>
          <Input id="aq" name="q" defaultValue={q} placeholder="Search published activities" className="max-w-sm" />
          <label htmlFor="asort" className="sr-only">Sort</label>
          <Select id="asort" name="sort" defaultValue={sort} className="max-w-[11rem]">
            <option value="title">By title</option>
            <option value="downvoted">Most downvoted</option>
            <option value="upvoted">Most upvoted</option>
          </Select>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <div className="mt-4">
          {!list || list.length === 0 ? (
            <EmptyState title="No published activities match." />
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
              {list.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <CategoryBadge category={a.category as Category} className="hidden sm:inline-flex" />
                    <span className="truncate">{a.title}</span>
                    {a.source === "submission" ? <span className="shrink-0 text-xs text-muted">community</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="flex items-center gap-2 text-xs tabular-nums text-muted" aria-label={`${a.upvotes} upvotes, ${a.downvotes} downvotes`}>
                      <ThumbsUp className="size-3.5" aria-hidden /> {a.upvotes}
                      <ThumbsDown className="size-3.5" aria-hidden /> {a.downvotes}
                    </span>
                    <ArchiveButton id={a.id} title={a.title} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Container>
  );
}

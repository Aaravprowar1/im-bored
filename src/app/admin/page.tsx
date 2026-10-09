import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { ModerationBadge, PaymentBadge } from "@/components/submit/status-badges";
import { Button } from "@/components/ui/button";
import { Container, EmptyState, PageHeading } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { cn } from "@/lib/cn";
import { MODERATION_COPY, MODERATION_STATUSES, PAYMENT_STATUSES, type ModerationStatus, type PaymentStatus } from "@/lib/submissions/state";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const PAGE_SIZE = 25;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string; payment?: string; q?: string; page?: string }> }) {
  const { supabase } = await requireAdminPage("/admin");
  const sp = await searchParams;
  const status = (MODERATION_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as ModerationStatus) : sp.status === "all" ? null : "pending_review";
  const payment = (PAYMENT_STATUSES as readonly string[]).includes(sp.payment ?? "") ? (sp.payment as PaymentStatus) : null;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase
    .from("activity_submissions")
    .select("id,title,category,payment_status,moderation_status,created_at,paid_at", { count: "exact" })
    .order("created_at", { ascending: status === "pending_review" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("moderation_status", status);
  if (payment) query = query.eq("payment_status", payment);
  // Escape LIKE wildcards in the search term.
  if (q) query = query.ilike("title", `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const { data, count, error } = await query;

  const counts = await Promise.all(
    (["pending_review", "needs_changes", "approved", "rejected", "pending_payment"] as const).map(async (s) => {
      const { count } = await supabase.from("activity_submissions").select("id", { count: "exact", head: true }).eq("moderation_status", s);
      return [s, count ?? 0] as const;
    }),
  );

  const tab = (s: string | null, label: string, n?: number) => {
    const p = new URLSearchParams();
    p.set("status", s ?? "all");
    if (q) p.set("q", q);
    const active = (status ?? "all") === (s ?? "all");
    return (
      <Link key={label} href={`/admin?${p}`} aria-current={active ? "true" : undefined} className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm", active ? "border-ink bg-ink text-bg" : "border-line bg-card hover:border-ink/40")}>
        {label}
        {n !== undefined ? <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-bg/20" : "bg-line")}>{n}</span> : null}
      </Link>
    );
  };

  return (
    <Container className="pt-12 sm:pt-16">
      <PageHeading title="Moderation" intro="Review paid submissions. Approving publishes the activity immediately; nothing is published automatically." />
      <AdminNav active="submissions" />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {counts.map(([s, n]) => tab(s, MODERATION_COPY[s].label, n))}
        {tab(null, "All")}
      </div>

      <form className="mt-4 flex flex-col gap-2 sm:flex-row" action="/admin">
        <input type="hidden" name="status" value={status ?? "all"} />
        <label htmlFor="q" className="sr-only">Search titles</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Search titles" className="sm:max-w-xs" />
        <label htmlFor="payment" className="sr-only">Payment status</label>
        <Select id="payment" name="payment" defaultValue={payment ?? ""} className="sm:max-w-[14rem]">
          <option value="">Any payment status</option>
          {PAYMENT_STATUSES.map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
        </Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>

      <div className="mt-6">
        {error ? (
          <EmptyState title="Couldn't load submissions." />
        ) : !data || data.length === 0 ? (
          <EmptyState title="Nothing here.">No submissions match these filters.</EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {data.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/submissions/${s.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-bg/60 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.title}</span>
                    <span className="text-xs text-muted">
                      {s.category} · submitted {new Date(s.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <PaymentBadge status={s.payment_status as PaymentStatus} />
                    <ModerationBadge status={s.moderation_status as ModerationStatus} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {count && count > PAGE_SIZE ? (
          <nav aria-label="Pages" className="mt-4 flex justify-between text-sm">
            {page > 1 ? <Link className="underline" href={`/admin?status=${status ?? "all"}&q=${encodeURIComponent(q)}&page=${page - 1}`}>Previous</Link> : <span />}
            <span className="text-muted">Page {page} of {Math.ceil(count / PAGE_SIZE)}</span>
            {page * PAGE_SIZE < count ? <Link className="underline" href={`/admin?status=${status ?? "all"}&q=${encodeURIComponent(q)}&page=${page + 1}`}>Next</Link> : <span />}
          </nav>
        ) : null}
      </div>
    </Container>
  );
}

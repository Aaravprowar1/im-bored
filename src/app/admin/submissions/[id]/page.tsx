import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityMeta, CategoryBadge } from "@/components/activity-meta";
import { ModerationActions } from "@/components/admin/moderation-actions";
import { ModerationBadge } from "@/components/submit/status-badges";
import { Card, Container } from "@/components/ui/card";
import type { PublicActivity } from "@/lib/activities/types";
import { requireAdminPage } from "@/lib/auth/admin-page";
import type { Submission } from "@/lib/submissions/types";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Review submission", robots: { index: false, follow: false } };

const fmt = (d: string | null) => (d ? `${new Date(d).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC` : "—");

export default async function AdminSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdminPage(`/admin/submissions/${id}`);
  if (!uuidSchema.safeParse(id).success) notFound();

  const [{ data: sub }, { data: audit }] = await Promise.all([
    supabase.from("activity_submissions").select("*").eq("id", id).maybeSingle(),
    supabase.from("moderation_audit_log").select("action,from_status,to_status,notes,created_at,actor_id").eq("submission_id", id).order("created_at", { ascending: false }),
  ]);
  if (!sub) notFound();
  const s = sub as Submission;

  return (
    <Container className="max-w-4xl pt-12 sm:pt-16">
      <Link href="/admin" className="text-sm text-muted hover:text-ink">← Back to queue</Link>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CategoryBadge category={s.category} />
        <ModerationBadge status={s.moderation_status} />
      </div>
      <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{s.title}</h1>

      <Card className="mt-6 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Original submission</p>
        {/* Rendered as text: user content is never treated as HTML. */}
        <p className="mt-3 whitespace-pre-line leading-relaxed">{s.description}</p>
        <div className="mt-6 border-t border-line pt-5">
          <ActivityMeta activity={{ ...(s as unknown as PublicActivity), xp_reward: 0 }} />
        </div>
      </Card>

      <Card className="mt-4 p-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Moderate</p>
        <div className="mt-4">
          <ModerationActions id={s.id} moderationStatus={s.moderation_status} />
        </div>
        {s.review_notes ? <p className="mt-4 text-sm text-muted">Current note to submitter: {s.review_notes}</p> : null}
        {s.published_activity_id ? <p className="mt-2 text-sm text-muted">Published as activity {s.published_activity_id} on {fmt(s.published_at)}.</p> : null}
      </Card>

      <div className="mt-4">
        <Card className="p-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Audit trail</p>
          {audit && audit.length ? (
            <ol className="mt-3 space-y-3 text-sm">
              {audit.map((a, i) => (
                <li key={i}>
                  <p className="font-medium">{a.action.replace(/_/g, " ")} <span className="font-normal text-muted">({a.from_status} → {a.to_status})</span></p>
                  <p className="text-xs text-muted">{fmt(a.created_at)}</p>
                  {a.notes ? <p className="mt-1 whitespace-pre-line text-muted">{a.notes}</p> : null}
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-sm text-muted">No moderation actions yet.</p>}
          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <Row k="Submitted" v={fmt(s.created_at)} />
            <Row k="Updated" v={fmt(s.updated_at)} />
            <Row k="Submitter" v={s.submitter_id ? "Account on file" : "Deleted account"} />
          </dl>
        </Card>
      </div>
    </Container>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="truncate text-right font-medium">{v}</dd>
    </div>
  );
}

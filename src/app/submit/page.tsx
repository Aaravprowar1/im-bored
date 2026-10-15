import type { Metadata } from "next";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { ModerationBadge } from "@/components/submit/status-badges";
import { SubmitForm } from "@/components/submit/submit-form";
import { Card, Container, Notice, PageHeading } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { OWNER_SUBMISSION_COLUMNS, type OwnerSubmission } from "@/lib/submissions/types";

export const metadata: Metadata = {
  title: "Suggest an activity",
  description: "Suggest your own activity idea. It's free, and a moderator reviews every one.",
};

const DO = ["Original ideas anyone can try", "Clear, short instructions", "Safety notes where they matter", "Harmless, kind and legal fun"];
const DONT = ["Dangerous dares or stunts", "Trespassing, vandalism or anything illegal", "Pranks that target or embarrass people", "Pressure to spend money, links or ads"];

export default async function SubmitPage() {
  const { supabase, user } = await getSessionUser();

  let history: OwnerSubmission[] = [];
  if (supabase && user) {
    const { data } = await supabase
      .from("activity_submissions")
      .select(OWNER_SUBMISSION_COLUMNS)
      .eq("submitter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    history = (data ?? []) as OwnerSubmission[];
  }

  return (
    <Container className="pt-12 sm:pt-16">
      <PageHeading title="Suggest an activity." intro="Got an idea that beats boredom? Send it in. A moderator reads every submission, and the best ones join the public library." />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="order-2 p-5 sm:p-8 lg:order-1">
          {!supabase ? (
            <Notice tone="warning" title="Submissions are closed on this site for now">
              Suggesting an activity needs accounts, which aren&apos;t set up on this site yet.
            </Notice>
          ) : (
            <SubmitForm signedIn={Boolean(user)} />
          )}
        </Card>

        <aside className="order-1 space-y-4 lg:order-2">
          <Card tone="blue" className="p-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink/60">Free to suggest</p>
            <p className="mt-2 font-serif text-5xl leading-none">No fee.</p>
            <p className="mt-3 text-sm leading-relaxed text-ink/75">
              Suggest up to 10 activities a day. A real person reads each one, and approved ideas go live in the generator, where everyone can vote on them.
              See our <Link className="underline" href="/terms#submissions">terms</Link>.
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Submission rules</p>
            <ul className="mt-3 space-y-2 text-sm">
              {DO.map((d) => (
                <li key={d} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{d}</li>
              ))}
              {DONT.map((d) => (
                <li key={d} className="flex gap-2 text-muted"><X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />{d}</li>
              ))}
            </ul>
            <ol className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm text-muted">
              <li>1. Fill in the form and send it.</li>
              <li>2. A moderator approves, rejects or asks for changes.</li>
              <li>3. Approved activities go live in the generator.</li>
              <li>4. People vote them up or down.</li>
            </ol>
          </Card>
        </aside>
      </div>

      {user ? (
        <section aria-labelledby="history-heading" className="mt-14">
          <h2 id="history-heading" className="font-serif text-3xl">Your submissions</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-muted">You haven&apos;t submitted anything yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card">
              {history.map((s) => (
                <li key={s.id}>
                  <Link href={`/submit/status/${s.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-bg/60 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.title}</span>
                      <span className="text-xs text-muted">{new Date(s.created_at).toLocaleDateString("en", { dateStyle: "medium" })}</span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <ModerationBadge status={s.moderation_status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </Container>
  );
}

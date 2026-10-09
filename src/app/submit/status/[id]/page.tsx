import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CategoryBadge } from "@/components/activity-card";
import { SubmissionStatus } from "@/components/submit/submission-status";
import { Container } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { isServiceRoleConfigured, isStripeConfigured } from "@/lib/server-config";
import { OWNER_SUBMISSION_COLUMNS, type OwnerSubmission } from "@/lib/submissions/types";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Submission status", robots: { index: false } };

export default async function SubmissionStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { id } = await params;
  const { checkout } = await searchParams;
  const { supabase, user } = await getSessionUser();
  if (!supabase) notFound();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/submit/status/${id}`)}`);
  if (!uuidSchema.safeParse(id).success) notFound();

  // RLS returns the row only to its owner (or an admin); we also filter by owner.
  const { data } = await supabase
    .from("activity_submissions")
    .select(OWNER_SUBMISSION_COLUMNS)
    .eq("id", id)
    .eq("submitter_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  const submission = data as OwnerSubmission;

  return (
    <Container className="max-w-3xl pt-12 sm:pt-16">
      <Link href="/submit" className="text-sm text-muted hover:text-ink">← All submissions</Link>
      <div className="mt-4">
        <CategoryBadge category={submission.category} />
        <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{submission.title}</h1>
        <p className="mt-2 whitespace-pre-line text-muted">{submission.description}</p>
      </div>
      <div className="mt-8">
        <SubmissionStatus
          initial={submission}
          returnedFrom={checkout === "success" ? "success" : checkout === "cancel" ? "cancel" : null}
          checkoutError={checkout === "error"}
          paymentsEnabled={isStripeConfigured() && isServiceRoleConfigured()}
        />
      </div>
    </Container>
  );
}

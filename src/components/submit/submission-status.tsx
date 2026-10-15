"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmissionFields, type SubmissionDraft } from "@/components/submit/submission-fields";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";
import { MODERATION_COPY } from "@/lib/submissions/state";
import type { OwnerSubmission } from "@/lib/submissions/types";
import { fieldErrors, submissionFieldsSchema } from "@/lib/validation";

export function SubmissionStatus({ submission }: { submission: OwnerSubmission }) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <Card className="p-6 sm:p-8" role="status">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Review</p>
        <p className="mt-3 font-serif text-3xl leading-tight">{MODERATION_COPY[submission.moderation_status].label}</p>
        <p className="mt-1 text-[15px] text-muted">{MODERATION_COPY[submission.moderation_status].detail}</p>
        {submission.review_notes && ["needs_changes", "rejected", "approved"].includes(submission.moderation_status) ? (
          <blockquote className="mt-4 whitespace-pre-line rounded-xl border border-line bg-bg/60 p-4 text-sm">
            <span className="mb-1 block text-xs uppercase tracking-[0.12em] text-muted">Moderator note</span>
            {submission.review_notes}
          </blockquote>
        ) : null}
      </Card>

      {submission.moderation_status === "needs_changes" ? (
        <ResubmitForm submission={submission} onDone={() => router.refresh()} />
      ) : null}
    </div>
  );
}

function ResubmitForm({ submission, onDone }: { submission: OwnerSubmission; onDone: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<SubmissionDraft>({
    title: submission.title,
    description: submission.description,
    category: submission.category,
    duration_minutes: String(submission.duration_minutes),
    difficulty: submission.difficulty,
    location: submission.location,
    energy_level: submission.energy_level,
    cost_type: submission.cost_type,
    people_type: submission.people_type,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = submissionFieldsSchema.safeParse(draft);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const res = await api(`/api/submissions/${submission.id}`, { method: "PATCH", body: JSON.stringify(parsed.data) });
    setBusy(false);
    if (!res.ok) {
      if (res.error.fields) setErrors(res.error.fields);
      return toast(res.error.message, "error");
    }
    toast("Sent back for review.", "success");
    onDone();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-serif text-3xl">Edit and resubmit</h2>
      <p className="mt-1 text-sm text-muted">Make the requested changes and send it back.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
        <SubmissionFields draft={draft} errors={errors} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Resubmit for review
        </Button>
      </form>
    </Card>
  );
}

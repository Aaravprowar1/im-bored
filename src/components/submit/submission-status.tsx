"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDashed, CircleX, Clock, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { SubmissionFields, type SubmissionDraft } from "@/components/submit/submission-fields";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";
import { MODERATION_COPY, PAYMENT_DISPLAY_COPY, paymentDisplay, type PaymentDisplay } from "@/lib/submissions/state";
import type { OwnerSubmission } from "@/lib/submissions/types";
import { fieldErrors, submissionFieldsSchema } from "@/lib/validation";

const ICONS: Record<PaymentDisplay, React.ComponentType<{ className?: string }>> = {
  not_started: CircleDashed,
  checkout_in_progress: Clock,
  pending_verification: Loader2,
  confirmed: CheckCircle2,
  failed: CircleX,
  cancelled: CircleX,
  refund_pending: RotateCcw,
  refunded: RotateCcw,
};

const POLL_MS = 3000;
const POLL_LIMIT = 40;

export function SubmissionStatus({
  initial,
  returnedFrom,
  paymentsEnabled,
  checkoutError,
}: {
  initial: OwnerSubmission;
  returnedFrom: "success" | "cancel" | null;
  paymentsEnabled: boolean;
  checkoutError: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [submission, setSubmission] = useState(initial);
  const [paying, setPaying] = useState(false);
  const [polls, setPolls] = useState(0);

  // The display only ever reflects server state. Coming back from Stripe with
  // ?checkout=success shows "pending verification" until the webhook lands.
  const display = paymentDisplay(submission.payment_status, returnedFrom);
  const Icon = ICONS[display];
  const waiting = display === "pending_verification" && polls < POLL_LIMIT;

  useEffect(() => {
    if (!waiting) return;
    const t = window.setTimeout(async () => {
      const res = await api<{ submission: OwnerSubmission }>(`/api/submissions/${submission.id}`);
      if (res.ok) setSubmission(res.data.submission);
      setPolls((p) => p + 1);
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [waiting, polls, submission.id]);

  const canPay = submission.moderation_status === "pending_payment" && ["not_started", "cancelled", "failed", "checkout_in_progress"].includes(display);

  async function pay() {
    setPaying(true);
    const res = await api<{ url: string }>("/api/payments/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({ submissionId: submission.id }),
    });
    if (!res.ok) {
      setPaying(false);
      toast(res.error.message, "error");
      return;
    }
    window.location.assign(res.data.url);
  }

  return (
    <div className="space-y-4">
      {checkoutError ? <Notice tone="error">We couldn&apos;t open checkout. Nothing was charged. Please try again.</Notice> : null}
      <Card className="p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Payment</p>
        <div className="mt-3 flex items-start gap-3" role="status" aria-live="polite">
          <Icon className={`mt-1 size-6 shrink-0 ${display === "pending_verification" && waiting ? "animate-spin" : ""}`} />
          <div>
            <p className="font-serif text-3xl leading-tight">{PAYMENT_DISPLAY_COPY[display].label}</p>
            <p className="mt-1 text-[15px] text-muted">
              {display === "pending_verification" && !waiting
                ? "Stripe hasn't confirmed this payment yet. Refresh in a minute; if you were charged, it will be confirmed shortly."
                : PAYMENT_DISPLAY_COPY[display].detail}
            </p>
          </div>
        </div>
        {canPay ? (
          paymentsEnabled ? (
            <Button className="mt-5" onClick={pay} disabled={paying}>
              {paying ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {display === "checkout_in_progress" ? "Continue to checkout" : "Pay $1.00 USD"}
            </Button>
          ) : (
            <Notice tone="warning" className="mt-5">
              Payments aren&apos;t configured on this site, so this submission can&apos;t be paid for yet. No payment has been taken.
            </Notice>
          )
        ) : null}
      </Card>

      <Card className="p-6 sm:p-8">
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
    toast("Resubmitted for review. No extra payment needed.", "success");
    onDone();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="font-serif text-3xl">Edit and resubmit</h2>
      <p className="mt-1 text-sm text-muted">Make the requested changes. There&apos;s no extra fee.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-6">
        <SubmissionFields draft={draft} errors={errors} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Resubmit for review
        </Button>
      </form>
    </Card>
  );
}

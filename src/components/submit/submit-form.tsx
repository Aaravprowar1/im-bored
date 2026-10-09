"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { EMPTY_DRAFT, SubmissionFields, type SubmissionDraft } from "@/components/submit/submission-fields";
import { api } from "@/lib/api-client";
import { fieldErrors, submissionFieldsSchema } from "@/lib/validation";

const DRAFT_KEY = "imbored:submission-draft:v1";

type Stage = "editing" | "saving" | "redirecting";

export function SubmitForm({ signedIn, paymentsEnabled }: { signedIn: boolean; paymentsEnabled: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SubmissionDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("editing");
  const [agreed, setAgreed] = useState(false);
  // One id per form attempt: retries and double-clicks reuse the same submission.
  const requestId = useRef<string>("");

  useEffect(() => {
    requestId.current = crypto.randomUUID();
    try {
      const saved = window.sessionStorage.getItem(DRAFT_KEY);
      // Restores an unsent draft after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(saved) });
    } catch {
      /* ignore */
    }
  }, []);

  const update = (patch: Partial<SubmissionDraft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      try {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = submissionFieldsSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    if (!agreed) {
      setErrors({ agree: "Please confirm you understand the fee and review terms." });
      return;
    }
    setStage("saving");
    const created = await api<{ id: string }>("/api/submissions", {
      method: "POST",
      body: JSON.stringify({ ...parsed.data, client_request_id: requestId.current }),
    });
    if (!created.ok) {
      setStage("editing");
      if (created.error.fields) setErrors(created.error.fields);
      setFormError(created.error.message);
      return;
    }
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    const id = created.data.id;
    if (!paymentsEnabled) {
      router.push(`/submit/status/${id}`);
      return;
    }
    const checkout = await api<{ url: string }>("/api/payments/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({ submissionId: id }),
    });
    if (!checkout.ok) {
      router.push(`/submit/status/${id}?checkout=error`);
      return;
    }
    setStage("redirecting");
    window.location.assign(checkout.data.url);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <SubmissionFields draft={draft} errors={errors} onChange={update} />

      <label className="flex items-start gap-3 rounded-xl border border-line bg-bg/60 p-4 text-sm leading-relaxed">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[var(--ink)]"
          checked={agreed}
          onChange={(e) => {
            setAgreed(e.target.checked);
            setErrors((prev) => {
              const next = { ...prev };
              delete next.agree;
              return next;
            });
          }}
          aria-describedby={errors.agree ? "agree-error" : undefined}
        />
        <span>
          I understand the <strong>$1.00 USD</strong> fee pays for a moderator to review this activity. It does not guarantee approval or publication.
          {errors.agree ? <span id="agree-error" className="mt-1 block text-danger">{errors.agree}</span> : null}
        </span>
      </label>

      {signedIn ? (
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={stage !== "editing"}>
          {stage === "editing" ? (
            <>
              <Lock className="size-4" aria-hidden /> {paymentsEnabled ? "Continue to pay $1.00 USD" : "Save submission"}
            </>
          ) : (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> {stage === "saving" ? "Saving…" : "Opening secure checkout…"}
            </>
          )}
        </Button>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink href="/login?next=/submit" size="lg">
            Sign in to submit
          </ButtonLink>
          <p className="text-sm text-muted">Your draft is kept in this tab while you sign in.</p>
        </div>
      )}
      {paymentsEnabled ? (
        <p className="text-xs text-muted">Payment is handled by Stripe Checkout. We never see or store your card details.</p>
      ) : null}
    </form>
  );
}

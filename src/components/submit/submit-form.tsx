"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { EMPTY_DRAFT, SubmissionFields, type SubmissionDraft } from "@/components/submit/submission-fields";
import { api } from "@/lib/api-client";
import { fieldErrors, submissionFieldsSchema } from "@/lib/validation";

const DRAFT_KEY = "imbored:submission-draft:v1";

type Stage = "editing" | "saving";

export function SubmitForm({ signedIn }: { signedIn: boolean }) {
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
      setErrors({ agree: "Please confirm this is your own idea and follows the rules." });
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
    router.push(`/submit/status/${created.data.id}`);
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
          This is my own idea and it follows the submission rules. I understand a moderator reviews it first, and approval isn&apos;t guaranteed.
          {errors.agree ? <span id="agree-error" className="mt-1 block text-danger">{errors.agree}</span> : null}
        </span>
      </label>

      {signedIn ? (
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={stage !== "editing"}>
          {stage === "editing" ? (
            <>
              <Send className="size-4" aria-hidden /> Send for review
            </>
          ) : (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Sending…
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
    </form>
  );
}

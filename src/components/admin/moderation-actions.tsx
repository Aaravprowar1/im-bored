"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/confirm-dialog";
import { Field, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";
import { checkModeration, type ModerationAction, type ModerationStatus, type PaymentStatus } from "@/lib/submissions/state";

type Action = ModerationAction | "refund";

const LABELS: Record<Action, { button: string; title: string; notes: string; confirm: string }> = {
  approve: { button: "Approve & publish", title: "Approve and publish?", notes: "Note to the submitter (optional)", confirm: "Approve & publish" },
  request_changes: { button: "Request changes", title: "Request changes", notes: "What should they change? (shown to the submitter)", confirm: "Send request" },
  reject: { button: "Reject", title: "Reject this submission?", notes: "Reason (shown to the submitter)", confirm: "Reject" },
  refund: { button: "Refund $1", title: "Refund the $1 fee?", notes: "Internal note (audit log)", confirm: "Issue refund" },
};

export function ModerationActions({ id, paymentStatus, moderationStatus, refundsEnabled }: { id: string; paymentStatus: PaymentStatus; moderationStatus: ModerationStatus; refundsEnabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [action, setAction] = useState<Action | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sub = { payment_status: paymentStatus, moderation_status: moderationStatus };
  const allowed = (a: ModerationAction) => {
    const r = checkModeration(sub, a, "x");
    return r.ok;
  };
  const canRefund = refundsEnabled && paymentStatus === "paid" && moderationStatus === "rejected";

  async function run() {
    if (!action) return;
    setBusy(true);
    setError(null);
    const res = await api(`/api/admin/submissions/${id}`, { method: "POST", body: JSON.stringify({ action, notes: notes.trim() || null }) });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    toast("Done.", "success");
    setAction(null);
    setNotes("");
    router.refresh();
  }

  const actions: Action[] = (["approve", "request_changes", "reject"] as const).filter(allowed);
  if (canRefund) actions.push("refund");

  return (
    <div>
      {paymentStatus !== "paid" && moderationStatus === "pending_payment" ? (
        <Notice tone="warning">Payment hasn&apos;t been verified by Stripe, so this submission can&apos;t be approved.</Notice>
      ) : null}
      {actions.length === 0 ? (
        <p className="text-sm text-muted">No moderation actions are available in this state.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a} variant={a === "approve" ? "primary" : a === "reject" ? "danger" : "secondary"} onClick={() => setAction(a)}>
              {LABELS[a].button}
            </Button>
          ))}
        </div>
      )}
      <Dialog open={action !== null} onClose={() => setAction(null)} title={action ? LABELS[action].title : ""}>
        {action ? (
          <>
            {action === "approve" ? <p className="text-sm text-muted">The activity will appear in the public generator straight away.</p> : null}
            {error ? <Notice tone="error" className="mt-3">{error}</Notice> : null}
            <Field id="mod-notes" label={LABELS[action].notes} className="mt-4">
              <Textarea id="mod-notes" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button>
              <Button
                variant={action === "reject" || action === "refund" ? "danger" : "primary"}
                onClick={run}
                disabled={busy || ((action === "reject" || action === "request_changes") && !notes.trim())}
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {LABELS[action].confirm}
              </Button>
            </div>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}

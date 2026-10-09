"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api-client";

export function ArchiveButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Archive</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Archive activity?">
        <p className="text-sm text-muted">&ldquo;{title}&rdquo; will be removed from the generator immediately. This is logged.</p>
        {error ? <Notice tone="error" className="mt-3">{error}</Notice> : null}
        <Field id={`reason-${id}`} label="Reason" className="mt-4">
          <Textarea id={`reason-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              const res = await api(`/api/admin/activities/${id}/archive`, { method: "POST", body: JSON.stringify({ reason }) });
              setBusy(false);
              if (!res.ok) return setError(res.error.message);
              toast("Activity archived.", "success");
              setOpen(false);
              router.refresh();
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Archive
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function DailyChallengeForm({ activities, today }: { activities: { id: string; title: string }[]; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [activityId, setActivityId] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await api("/api/admin/daily-challenge", { method: "POST", body: JSON.stringify({ date, activityId }) });
        setBusy(false);
        if (!res.ok) return toast(res.error.message, "error");
        toast(`Daily challenge set for ${date} (UTC).`, "success");
        router.refresh();
      }}
    >
      <Field id="dc-date" label="Date (UTC)">
        <Input id="dc-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field id="dc-activity" label="Activity">
        <Input id="dc-activity" list="dc-activities" placeholder="Start typing a title…" onChange={(e) => setActivityId(activities.find((a) => a.title === e.target.value)?.id ?? "")} />
        <datalist id="dc-activities">
          {activities.map((a) => <option key={a.id} value={a.title} />)}
        </datalist>
      </Field>
      <Button type="submit" disabled={busy || !activityId}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Set challenge</Button>
    </form>
  );
}

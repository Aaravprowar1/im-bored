"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { api } from "@/lib/api-client";

export function CompleteButton({ activityId, completed, returnTo }: { activityId: string; completed: boolean; returnTo: string }) {
  const viewer = useViewer();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(completed);

  if (done) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-green px-3 text-sm font-medium">
        <Check className="size-4" aria-hidden /> Completed
      </span>
    );
  }
  if (!viewer.configured) return <span className="text-sm text-muted">XP needs accounts</span>;
  if (!viewer.user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="text-sm font-medium underline underline-offset-4">
        Sign in to earn XP
      </Link>
    );
  }
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await api<{ awarded: boolean; xp_awarded: number }>(`/api/activities/${activityId}/complete`, { method: "POST" });
        setBusy(false);
        if (!res.ok) return toast(res.error.message, "error");
        setDone(true);
        toast(res.data.awarded ? `Done! +${res.data.xp_awarded} XP` : "Already completed.", res.data.awarded ? "success" : "default");
        router.refresh();
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} I did it
    </Button>
  );
}

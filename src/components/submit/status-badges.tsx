import { MODERATION_COPY, type ModerationStatus } from "@/lib/submissions/state";
import { cn } from "@/lib/cn";

export function ModerationBadge({ status }: { status: ModerationStatus }) {
  const tone = status === "approved" ? "bg-green" : status === "rejected" ? "bg-[#fbe6e4]" : status === "needs_changes" ? "bg-peach" : "bg-card";
  return <span className={cn("inline-flex rounded-full border border-ink/10 px-2.5 py-0.5 text-xs font-medium", tone)}>{MODERATION_COPY[status].label}</span>;
}

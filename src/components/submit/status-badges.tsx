import { MODERATION_COPY, PAYMENT_DISPLAY_COPY, paymentDisplay, type ModerationStatus, type PaymentStatus } from "@/lib/submissions/state";
import { cn } from "@/lib/cn";

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const d = paymentDisplay(status, null);
  const tone = d === "confirmed" ? "bg-green" : d === "failed" ? "bg-[#fbe6e4]" : d.startsWith("refund") ? "bg-blue" : "bg-yellow";
  return <span className={cn("inline-flex rounded-full border border-ink/10 px-2.5 py-0.5 text-xs font-medium", tone)}>{PAYMENT_DISPLAY_COPY[d].label}</span>;
}

export function ModerationBadge({ status }: { status: ModerationStatus }) {
  const tone = status === "approved" ? "bg-green" : status === "rejected" ? "bg-[#fbe6e4]" : status === "needs_changes" ? "bg-peach" : "bg-card";
  return <span className={cn("inline-flex rounded-full border border-ink/10 px-2.5 py-0.5 text-xs font-medium", tone)}>{MODERATION_COPY[status].label}</span>;
}

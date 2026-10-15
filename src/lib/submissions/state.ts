/**
 * Moderation state machine for activity suggestions. Suggestions are free:
 * they start in review and only administrators move them on. The database
 * enforces the same rules (check constraint + moderate_submission).
 */

export const MODERATION_STATUSES = ["pending_review", "needs_changes", "approved", "rejected"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export type ModerationAction = "approve" | "reject" | "request_changes";

export const MODERATION_TRANSITIONS: Record<
  ModerationAction,
  { to: ModerationStatus; from: readonly ModerationStatus[]; requiresNotes: boolean }
> = {
  approve: { to: "approved", from: ["pending_review"], requiresNotes: false },
  reject: { to: "rejected", from: ["pending_review", "needs_changes"], requiresNotes: true },
  request_changes: { to: "needs_changes", from: ["pending_review"], requiresNotes: true },
};

export type ModerationCheck =
  | { ok: true; to: ModerationStatus }
  | { ok: false; reason: "invalid_transition" | "reason_required" };

export function checkModeration(
  submission: { moderation_status: ModerationStatus },
  action: ModerationAction,
  notes?: string | null,
): ModerationCheck {
  const t = MODERATION_TRANSITIONS[action];
  if (!t.from.includes(submission.moderation_status)) return { ok: false, reason: "invalid_transition" };
  if (t.requiresNotes && !notes?.trim()) return { ok: false, reason: "reason_required" };
  return { ok: true, to: t.to };
}

export const MODERATION_COPY: Record<ModerationStatus, { label: string; detail: string }> = {
  pending_review: { label: "In review", detail: "A moderator will look at your activity. Approval isn't guaranteed." },
  needs_changes: { label: "Changes requested", detail: "A moderator asked for changes. Edit it below and send it back." },
  approved: { label: "Approved and published", detail: "Your activity is live in the library." },
  rejected: { label: "Not approved", detail: "This activity wasn't accepted. See the moderator's note below." },
};

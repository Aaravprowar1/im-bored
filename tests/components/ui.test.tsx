// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityCard } from "@/components/activity-card";
import { SubmissionStatus } from "@/components/submit/submission-status";
import { ToastProvider } from "@/components/toast";
import type { OwnerSubmission } from "@/lib/submissions/types";
import type { PublicActivity } from "@/lib/activities/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

const activity: PublicActivity = {
  id: "a1",
  title: "Six-word story",
  description: "Write a complete story in six words.",
  category: "creative",
  duration_minutes: 5,
  difficulty: "easy",
  location: "anywhere",
  energy_level: "low",
  cost_type: "free",
  people_type: "alone",
  xp_reward: 10,
  is_chaos: false,
  is_featured: false,
  safety_note: null,
};

describe("ActivityCard", () => {
  it("shows all metadata and accessible actions", async () => {
    const onToggleSave = vi.fn();
    const onNext = vi.fn();
    render(<ActivityCard activity={activity} saved={false} saveScope="device" onToggleSave={onToggleSave} onComplete={vi.fn()} onNext={onNext} />);
    expect(screen.getByRole("heading", { name: "Six-word story" })).toBeInTheDocument();
    for (const text of ["Creative", "5 min", "Easy", "Anywhere", "Low", "Free", "Alone", "+10 XP"]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    const save = screen.getByRole("button", { name: 'Save "Six-word story" to favourites (this device)' });
    expect(save).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(save);
    await userEvent.click(screen.getByRole("button", { name: /GOT A NEW ONE/ }));
    expect(onToggleSave).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /I DID IT/ })).toBeInTheDocument();
  });
});

const submission: OwnerSubmission = {
  id: "s1",
  title: "Idea",
  description: "Some description of a fun idea.",
  category: "creative",
  duration_minutes: 5,
  difficulty: "easy",
  location: "anywhere",
  energy_level: "low",
  cost_type: "free",
  people_type: "alone",
  payment_status: "checkout_created",
  moderation_status: "pending_payment",
  amount_cents: 100,
  currency: "usd",
  paid_at: null,
  review_notes: null,
  published_activity_id: null,
  published_at: null,
  created_at: "2026-10-09T00:00:00Z",
  updated_at: "2026-10-09T00:00:00Z",
};

function renderStatus(props: Partial<React.ComponentProps<typeof SubmissionStatus>>) {
  return render(
    <ToastProvider>
      <SubmissionStatus initial={submission} returnedFrom={null} paymentsEnabled checkoutError={false} {...props} />
    </ToastProvider>,
  );
}

describe("payment status screens", () => {
  it("returning from Stripe shows pending verification, never success", () => {
    renderStatus({ returnedFrom: "success" });
    expect(screen.getByText("Payment pending verification")).toBeInTheDocument();
    expect(screen.queryByText("Payment confirmed")).not.toBeInTheDocument();
  });

  it("shows confirmed only for a server-verified paid status", () => {
    renderStatus({ initial: { ...submission, payment_status: "paid", moderation_status: "pending_review" }, returnedFrom: "success" });
    expect(screen.getByText("Payment confirmed")).toBeInTheDocument();
    expect(screen.getByText("In review")).toBeInTheDocument();
  });

  it.each([
    [{ payment_status: "unpaid" }, null, "Payment not started"],
    [{ payment_status: "checkout_created" }, null, "Checkout in progress"],
    [{ payment_status: "checkout_created" }, "cancel", "Payment cancelled"],
    [{ payment_status: "failed" }, null, "Payment failed"],
    [{ payment_status: "refund_pending", moderation_status: "rejected" }, null, "Refund pending"],
    [{ payment_status: "refunded", moderation_status: "rejected" }, null, "Refunded"],
  ] as const)("renders %o (%s) as %s", (patch, returnedFrom, label) => {
    renderStatus({ initial: { ...submission, ...patch } as OwnerSubmission, returnedFrom });
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("offers a retry for cancelled payments and explains when payments are unavailable", () => {
    const { unmount } = renderStatus({ initial: { ...submission, payment_status: "unpaid" }, returnedFrom: "cancel" });
    expect(screen.getByRole("button", { name: "Pay $1.00 USD" })).toBeInTheDocument();
    unmount();
    renderStatus({ initial: { ...submission, payment_status: "unpaid" }, paymentsEnabled: false });
    expect(screen.getByText(/Payments aren.t configured/)).toBeInTheDocument();
  });

  it("shows the moderator's note and a resubmit form when changes are requested", () => {
    renderStatus({ initial: { ...submission, payment_status: "paid", moderation_status: "needs_changes", review_notes: "Make it shorter." } });
    expect(screen.getByText("Make it shorter.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resubmit for review/ })).toBeInTheDocument();
  });
});

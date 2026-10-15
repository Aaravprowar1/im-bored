// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityCard } from "@/components/activity-card";
import { SubmissionStatus } from "@/components/submit/submission-status";
import { ToastProvider } from "@/components/toast";
import { ViewerProvider } from "@/components/viewer-context";
import { VotesProvider, VoteButtons, applyVote } from "@/components/votes";
import type { OwnerSubmission } from "@/lib/submissions/types";
import type { PublicActivity } from "@/lib/activities/types";
import type { Viewer } from "@/lib/viewer";

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
  upvotes: 4,
  downvotes: 1,
};

const GUEST: Viewer = { configured: true, user: null, progress: null, favouriteIds: [], votes: {}, isAdmin: false };
const SIGNED_IN: Viewer = {
  ...GUEST,
  user: { id: "u1", email: null, username: "sam", display_name: null, avatar_url: null, show_on_leaderboard: true },
};

function withProviders(ui: React.ReactNode, viewer: Viewer = GUEST) {
  return render(
    <ViewerProvider viewer={viewer}>
      <ToastProvider>
        <VotesProvider>{ui}</VotesProvider>
      </ToastProvider>
    </ViewerProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ActivityCard", () => {
  it("shows all metadata and accessible actions", async () => {
    const onToggleSave = vi.fn();
    const onNext = vi.fn();
    withProviders(<ActivityCard activity={activity} saved={false} saveScope="device" onToggleSave={onToggleSave} onComplete={vi.fn()} onNext={onNext} />);
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
    expect(screen.getByRole("button", { name: "Upvote (4)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Downvote (1)" })).toBeInTheDocument();
  });
});

describe("votes", () => {
  it("asks guests to sign in and changes nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    withProviders(<VoteButtons activity={activity} />);
    await userEvent.click(screen.getByRole("button", { name: "Upvote (4)" }));
    expect(await screen.findByText("Sign in to vote.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Upvote (4)" })).toHaveAttribute("aria-pressed", "false");
  });

  it("votes, switches and removes a vote, showing the server's totals", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { value } = JSON.parse(String(init.body)) as { value: number };
      const totals = { 1: { upvotes: 5, downvotes: 1 }, [-1]: { upvotes: 4, downvotes: 2 }, 0: { upvotes: 4, downvotes: 1 } }[value]!;
      return new Response(JSON.stringify({ ...totals, my_vote: value }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    withProviders(<VoteButtons activity={activity} />, SIGNED_IN);

    await userEvent.click(screen.getByRole("button", { name: "Upvote (4)" }));
    expect(await screen.findByRole("button", { name: "Upvote (5)" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/activities/a1/vote", expect.objectContaining({ method: "POST", body: JSON.stringify({ value: 1 }) }));

    await userEvent.click(screen.getByRole("button", { name: "Downvote (1)" }));
    expect(await screen.findByRole("button", { name: "Downvote (2)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Upvote (4)" })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: "Downvote (2)" }));
    expect(await screen.findByRole("button", { name: "Downvote (1)" })).toHaveAttribute("aria-pressed", "false");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/activities/a1/vote", expect.objectContaining({ body: JSON.stringify({ value: 0 }) }));
  });

  it("rolls back when the server refuses the vote", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "not_found", message: "That activity isn't available." } }), { status: 404 })));
    withProviders(<VoteButtons activity={activity} />, SIGNED_IN);
    await userEvent.click(screen.getByRole("button", { name: "Upvote (4)" }));
    expect(await screen.findByText("That activity isn't available.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upvote (4)" })).toHaveAttribute("aria-pressed", "false");
  });

  it("computes optimistic totals for every change", () => {
    const t = { upvotes: 3, downvotes: 2 };
    expect(applyVote(t, 0, 1)).toEqual({ upvotes: 4, downvotes: 2 });
    expect(applyVote(t, 1, -1)).toEqual({ upvotes: 2, downvotes: 3 });
    expect(applyVote(t, -1, 0)).toEqual({ upvotes: 3, downvotes: 1 });
    expect(applyVote({ upvotes: 0, downvotes: 0 }, 1, 0)).toEqual({ upvotes: 0, downvotes: 0 });
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
  moderation_status: "pending_review",
  review_notes: null,
  published_activity_id: null,
  published_at: null,
  created_at: "2026-10-09T00:00:00Z",
  updated_at: "2026-10-09T00:00:00Z",
};

describe("submission status", () => {
  it.each([
    ["pending_review", "In review"],
    ["approved", "Approved and published"],
    ["rejected", "Not approved"],
  ] as const)("shows %s as %s, with nothing about payment", (status, label) => {
    withProviders(<SubmissionStatus submission={{ ...submission, moderation_status: status }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/pay|\$1/i)).not.toBeInTheDocument();
  });

  it("shows the moderator's note and a resubmit form when changes are requested", () => {
    withProviders(<SubmissionStatus submission={{ ...submission, moderation_status: "needs_changes", review_notes: "Make it shorter." }} />);
    expect(screen.getByText("Make it shorter.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resubmit for review/ })).toBeInTheDocument();
  });
});

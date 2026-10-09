import { describe, expect, it } from "vitest";
import { createSubmissionSchema, profileUpdateSchema, submissionFieldsSchema } from "@/lib/validation";

const valid = {
  title: "  Museum of tiny things  ",
  description: "Collect five tiny objects and write a museum label for each one.",
  category: "creative",
  duration_minutes: "20",
  difficulty: "easy",
  location: "indoors",
  energy_level: "low",
  cost_type: "free",
  people_type: "either",
};

describe("submission validation", () => {
  it("trims and coerces valid input", () => {
    const r = submissionFieldsSchema.parse(valid);
    expect(r.title).toBe("Museum of tiny things");
    expect(r.duration_minutes).toBe(20);
  });

  it("rejects empty, too long and malformed fields", () => {
    const bad = submissionFieldsSchema.safeParse({ ...valid, title: "   ", description: "x".repeat(801), category: "cooking", duration_minutes: "abc" });
    expect(bad.success).toBe(false);
    const paths = bad.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["title", "description", "category", "duration_minutes"]));
  });

  it("rejects unsafe or disallowed activities", () => {
    for (const description of [
      "Sneak into an abandoned factory at night and take photos.",
      "Prank call a stranger and record their reaction.",
      "Climb the tower in town without permission for the view.",
      "Check out https://example.com for the full instructions.",
    ]) {
      expect(submissionFieldsSchema.safeParse({ ...valid, description }).success).toBe(false);
    }
  });

  it("strips client-supplied price, currency, status and owner fields", () => {
    const r = createSubmissionSchema.parse({
      ...valid,
      client_request_id: "6f1c1a1e-1111-4111-8111-111111111111",
      amount_cents: 1,
      currency: "inr",
      payment_status: "paid",
      moderation_status: "approved",
      submitter_id: "someone-else",
    });
    expect(r).not.toHaveProperty("amount_cents");
    expect(r).not.toHaveProperty("currency");
    expect(r).not.toHaveProperty("payment_status");
    expect(r).not.toHaveProperty("moderation_status");
    expect(r).not.toHaveProperty("submitter_id");
  });
});

describe("profile validation", () => {
  it("normalises usernames and never accepts privileged fields", () => {
    const r = profileUpdateSchema.parse({ username: " New_Name ", is_admin: true, total_xp: 9999, is_suspended: false });
    expect(r).toEqual({ username: "new_name" });
    expect(profileUpdateSchema.safeParse({ username: "no spaces" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ avatar_url: "javascript:alert(1)" }).success).toBe(false);
  });
});

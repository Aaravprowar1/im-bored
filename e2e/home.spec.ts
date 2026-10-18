import { expect, test, type Page } from "@playwright/test";
import { filterActivities } from "../src/lib/activities/engine";
import { DEFAULT_FILTERS } from "../src/lib/activities/filters";
import { SEED_ACTIVITIES } from "../src/lib/activities/seed-data";
import { CATEGORIES, CATEGORY_LABELS, COST_TYPES, ENERGY_LEVELS } from "../src/lib/activities/types";

async function generate(page: Page) {
  await page.getByRole("button", { name: "GIVE ME SOMETHING TO DO" }).click();
}

const card = (page: Page) => page.locator("article[aria-labelledby='activity-title']");

test("homepage renders the core experience", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("im bored. — Find something to do");
  await expect(page.getByRole("heading", { level: 1, name: /i.m bored/ })).toBeVisible();
  await expect(page.getByText("Get a random activity to do. Explore. Be creative. Do something different.")).toBeVisible();
  await expect(page.getByRole("switch", { name: /Chaos Mode/ })).toBeVisible();
  await expect(page.getByText("Today's challenge")).toBeVisible();
  await expect(page.getByText("Your progress")).toBeVisible();
  await expect(page.getByRole("link", { name: /Suggest an idea/ })).toBeVisible();
  await expect(page.getByText("$1")).toHaveCount(0);
  for (const link of ["About", "Privacy", "Terms", "Contact"]) {
    await expect(page.getByRole("contentinfo").getByRole("link", { name: link })).toBeVisible();
  }
});

test("generates an activity without a page reload, and a new one on request", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  await generate(page);
  await expect(card(page)).toBeVisible();
  const first = await page.locator("#activity-title").textContent();
  await page.getByRole("button", { name: /GOT A NEW ONE/ }).click();
  await expect(page.locator("#activity-title")).not.toHaveText(first ?? "");
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  await expect(page.getByText(/Development mode: activities come from the built-in seed list/)).toBeVisible();
});

test("activities show vote buttons, and voting explains when accounts are off", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  const up = card(page).getByRole("button", { name: /^Upvote \(\d+\)$/ });
  await expect(up).toBeVisible();
  await expect(card(page).getByRole("button", { name: /^Downvote \(\d+\)$/ })).toBeVisible();
  await up.click();
  await expect(page.getByText("Voting needs accounts, which aren't set up on this site yet.")).toBeVisible();
  await expect(up).toHaveAttribute("aria-pressed", "false");
});

test("skill activities link to popular YouTube tutorials", async ({ page, request }) => {
  const api = await request.get("/api/activities/learn-a-knot/video");
  expect(api.status()).toBe(200);
  // No YouTube key in tests, so it offers YouTube's most-viewed results instead of a picked video.
  expect(await api.json()).toEqual({
    query: "how to tie a bowline knot",
    searchUrl: "https://www.youtube.com/results?search_query=how+to+tie+a+bowline+knot&sp=CAM%3D",
    video: null,
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  let found = false;
  for (let i = 0; i < 25 && !found; i++) {
    if (i > 0) await generate(page);
    await expect(card(page)).toBeVisible();
    found = (await card(page).getByLabel("Video tutorial").count()) > 0;
  }
  expect(found).toBe(true);
  const link = card(page).getByRole("link", { name: /most-viewed tutorials for/ });
  await expect(link).toHaveAttribute("href", /^https:\/\/www\.youtube\.com\/results\?search_query=.+&sp=CAM%3D$/);
  await expect(link).toHaveAttribute("target", "_blank");
});

test("filters work together", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Time").selectOption("15");
  await page.getByLabel("Location").selectOption("outdoors");
  await page.getByLabel("Cost").selectOption("free");
  for (let i = 0; i < 6; i++) {
    await generate(page);
    const meta = card(page).locator("dl");
    const duration = await meta.locator("dt:has-text('Duration') + dd").textContent();
    expect(Number(duration?.replace(/\D/g, ""))).toBeLessThanOrEqual(15);
    await expect(meta.locator("dt:has-text('Location') + dd")).toHaveText(/Outdoors|Anywhere/);
    await expect(meta.locator("dt:has-text('Cost') + dd")).toHaveText("Free");
  }
});

test("impossible filters show the no-match message and reset works", async ({ page }) => {
  await page.goto("/");
  // Outdoors activities never need a screen, so this can't match.
  await page.getByRole("button", { name: "Outdoors", exact: true }).click();
  await page.getByLabel("Location").selectOption("computer");
  await generate(page);
  await expect(page.getByText("No activities match those filters. Try widening your search.")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).first().click();
  await expect(page.getByLabel("Time")).toHaveValue("any");
  await generate(page);
  await expect(card(page)).toBeVisible();
});

test("Chaos Mode is an accessible toggle that changes the pool and survives reloads in the session", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: /Chaos Mode/ });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  for (let i = 0; i < 5; i++) {
    await generate(page);
    await expect(card(page).getByText("Chaos", { exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole("switch", { name: /Chaos Mode/ })).toHaveAttribute("aria-checked", "true");
  // Chaos Mode can't override filters with no chaos activities: it explains and falls back.
  const f = noChaosFilters();
  await page.getByRole("button", { name: CATEGORY_LABELS[f.category], exact: true }).click();
  await page.getByLabel("Time").selectOption(String(f.maxMinutes));
  await page.getByLabel("Location").selectOption(f.location);
  await page.getByLabel("Energy").selectOption(f.energy);
  await page.getByLabel("Cost").selectOption(f.cost);
  await generate(page);
  await expect(page.getByText(/No chaos activities match these filters/)).toBeVisible();
  await expect(card(page).getByText(CATEGORY_LABELS[f.category]).first()).toBeVisible();
});

/** Finds filters that match some activities but no chaos ones in the bundled library. */
function noChaosFilters() {
  for (const category of CATEGORIES) {
    for (const maxMinutes of [5, 15, 30, 60] as const) {
      for (const location of ["indoors", "outdoors", "computer"] as const) {
        for (const energy of ENERGY_LEVELS) {
          for (const cost of COST_TYPES) {
            const filters = { ...DEFAULT_FILTERS, category, maxMinutes, location, energy, cost };
            const pool = filterActivities(SEED_ACTIVITIES.map((a) => ({ ...a, id: a.slug })), filters);
            if (pool.length > 0 && !pool.some((a) => a.is_chaos)) return filters;
          }
        }
      }
    }
  }
  throw new Error("Every filter combination has a chaos activity");
}

test("guest favourites are saved on this device", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  const title = (await page.locator("#activity-title").textContent())!;
  const save = page.getByRole("button", { name: new RegExp(`Save .* to favourites \\(this device\\)`) });
  await save.click();
  await expect(page.getByRole("button", { name: /Remove .* from favourites/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Saved on this device/)).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole("button", { name: `Remove "${title}" from favourites` }).click();
  await expect(page.getByText("No favourites yet.")).toBeVisible();
});

test("the main button works from the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "GIVE ME SOMETHING TO DO" }).focus();
  await page.keyboard.press("Enter");
  await expect(card(page)).toBeVisible();
});

test("I DID IT explains that XP needs accounts when Supabase is not configured", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  await page.getByRole("button", { name: /I DID IT/ }).click();
  await expect(page.getByText(/Accounts aren't set up on this site yet, so XP isn't saved/)).toBeVisible();
});

import { expect, test } from "@playwright/test";

const PAGES = ["/", "/challenges", "/leaderboard", "/submit", "/login", "/signup", "/profile", "/settings", "/about", "/privacy", "/terms", "/contact"];

for (const width of [320, 375, 414, 768, 1024, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test("page titles", async ({ page }) => {
  await page.goto("/challenges");
  await expect(page).toHaveTitle("Challenges — im bored.");
  await page.goto("/leaderboard");
  await expect(page).toHaveTitle("Leaderboard — im bored.");
  await page.goto("/submit");
  await expect(page).toHaveTitle("Suggest an activity — im bored.");
});

test("challenges show a stable daily challenge and featured filters", async ({ page }) => {
  await page.goto("/challenges");
  const daily = page.locator("h3").first();
  const title = await daily.textContent();
  await page.reload();
  await expect(page.locator("h3").first()).toHaveText(title ?? "");
  await expect(page.getByText(/New challenge in \d+h \d{2}m \(00:00 UTC\)/).first()).toBeVisible();
  await page.getByRole("link", { name: "Mischief" }).click();
  await expect(page).toHaveURL(/category=mischief/);
  await page.getByRole("link", { name: "Insane" }).click();
  await expect(page.getByText("No featured challenges here.")).toBeVisible();
});

test("leaderboard never shows fake rankings without a database", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByText("No leaderboard yet.")).toBeVisible();
  await expect(page.getByText(/We don.t show made-up scores/)).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);
});

test("submit page shows the $1 USD fee and an honest unavailable state", async ({ page }) => {
  await page.goto("/submit");
  await expect(page.getByText("$1.00", { exact: true })).toBeVisible();
  await expect(page.getByText("US dollars, per submission")).toBeVisible();
  await expect(page.getByText(/does not guarantee approval/)).toBeVisible();
  await expect(page.getByText("Submissions are closed on this site for now")).toBeVisible();
});

test("auth pages say accounts aren't configured instead of pretending", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Accounts aren't set up yet")).toBeVisible();
  await page.goto("/signup");
  await expect(page.getByText("Accounts aren't set up yet")).toBeVisible();
});

test("admin and private status pages are not reachable", async ({ page }) => {
  expect((await page.goto("/admin"))?.status()).toBe(404);
  expect((await page.goto("/submit/status/44444444-4444-4444-8444-444444444444"))?.status()).toBe(404);
});

test("API protects private operations", async ({ request }) => {
  expect((await request.post("/api/activities/44444444-4444-4444-8444-444444444444/complete")).status()).toBe(503);
  expect((await request.post("/api/payments/create-checkout-session", { data: { submissionId: "x", amount: 1 } })).status()).toBe(503);
  expect((await request.post("/api/webhooks/stripe", { data: {} })).status()).toBe(503);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /admin");
});

test("mobile menu opens and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Leaderboard" }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
});

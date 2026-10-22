// risk: test-plan.md #7 — the flow tags → filters → tiles → details breaks and nobody notices
//       facet: a saved exclusion hides the recipe's tile, and still does after a full SSR reload;
//       the tags → ranked tiles → details round trip is covered by seed.spec.ts
// seed: tests/e2e/seed.spec.ts
import { test, expect, type Page, type Response } from "@playwright/test";

// "Babeczki z jogurtem naturalnym" (supabase/seed.sql) is the only seeded recipe with yoghurt.
const EXCLUSION = "jogurt";
const EXCLUDED_RECIPE = "Babeczki z jogurtem naturalnym";
const KEPT_RECIPE = "Domowe spaghetti";

async function waitForIslands(page: Page) {
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
}

function pantrySaved(page: Page): Promise<Response> {
  return page.waitForResponse((res) => res.url().endsWith("/api/pantry") && res.request().method() === "PUT");
}

// Exclusions are saved per user: remove ours and prove it is gone.
async function removeExclusion(page: Page) {
  await page.goto("/");
  await waitForIslands(page);
  const remove = page.getByRole("button", { name: `Usuń ${EXCLUSION}` });
  if ((await remove.count()) > 0) {
    const saved = pantrySaved(page);
    await remove.click();
    expect((await saved).ok()).toBe(true);
    await page.reload();
  }
  await expect(page.getByRole("heading", { name: "Twoja spiżarka" })).toBeVisible();
  await expect(remove).toHaveCount(0);
}

test.describe("risk #7 — saved exclusions keep excluded recipes off the tiles", () => {
  // Saving an exclusion changes the account's pantry, so this spec runs on its own account (see auth.setup.ts).
  test.use({ storageState: "playwright/.auth/pantry-user.json" });

  // Teardown-before-setup: a run that crashed mid-way may have left the exclusion saved.
  test.beforeEach(async ({ page }) => {
    await removeExclusion(page);
  });

  test.afterEach(async ({ page }) => {
    await removeExclusion(page);
  });

  test("an excluded ingredient hides its recipe's tile, and the hidden tile stays hidden after a reload", async ({
    page,
  }) => {
    // Setup: without exclusions the yoghurt recipe is on the list, so its absence later means something.
    await expect(page.getByRole("link", { name: EXCLUDED_RECIPE })).toBeVisible();

    // Action: exclude yoghurt (saved to the database) and apply the filters.
    const exclude = page.getByRole("textbox", { name: "Wykluczam" });
    const saved = pantrySaved(page);
    await exclude.fill(EXCLUSION);
    await exclude.press("Enter");
    expect((await saved).ok()).toBe(true);
    await page.getByRole("button", { name: "Zastosuj filtry" }).click();

    // Assertion: the yoghurt recipe is gone while the others are still listed.
    await expect(page.getByRole("heading", { name: "Przepisy dopasowane do spiżarki" })).toBeVisible();
    await expect(page.getByRole("link", { name: KEPT_RECIPE })).toBeVisible();
    await expect(page.getByRole("link", { name: EXCLUDED_RECIPE })).toHaveCount(0);

    // Assertion: after a full reload the server reads the saved exclusion and still leaves the tile out.
    await page.reload();
    await expect(page.getByRole("button", { name: `Usuń ${EXCLUSION}` })).toBeVisible();
    await expect(page.getByRole("link", { name: KEPT_RECIPE })).toBeVisible();
    await expect(page.getByRole("link", { name: EXCLUDED_RECIPE })).toHaveCount(0);
  });
});

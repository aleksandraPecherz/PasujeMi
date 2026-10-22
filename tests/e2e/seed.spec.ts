// Seed test — the pattern every generated E2E test copies.
// Protects test-plan.md risk #7: the flow tags → filters → tiles → details breaks and nobody notices.
import { test, expect, type Page } from "@playwright/test";

// The pantry is a React island; wait until every island has hydrated before typing (Astro removes `ssr` then).
async function waitForIslands(page: Page) {
  await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
}

test("risk #7 — pantry tags rank recipe tiles by match and the list survives a visit to the details", async ({
  page,
}) => {
  // Setup: a signed-in user (storageState) opens the pantry. "Mam w domu" is never saved to the database,
  // so this test creates no data and has nothing to clean up.
  await page.goto("/");
  await waitForIslands(page);
  // Known pantry state: the main account has no saved staples or exclusions (pantry-changing specs use their own
  // account), so the expected percentages below depend only on the tags this test adds.
  await expect(page.getByRole("list", { name: "Produkty stałe" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Wykluczam" })).toHaveCount(0);

  // Action: add two products they have and apply the filters.
  const have = page.getByRole("textbox", { name: "Mam w domu" });
  for (const product of ["pomidor", "cebula"]) {
    await have.fill(product);
    await have.press("Enter");
    await expect(page.getByRole("button", { name: `Usuń ${product}` })).toBeVisible();
  }
  await page.getByRole("button", { name: "Zastosuj filtry" }).click();

  // Assertion: the list is now the matched one and every tile carries a match, best match first.
  await expect(page.getByRole("heading", { name: "Przepisy dopasowane do spiżarki" })).toBeVisible();
  const matches = page.getByLabel(/^Dopasowanie \d+%$/);
  await expect(matches.first()).toBeVisible();
  const percents = (await matches.allTextContents()).map((text) => Number.parseInt(text, 10));
  expect(percents.length).toBeGreaterThan(1);
  expect(percents).toEqual([...percents].sort((a, b) => b - a));
  expect(percents[0]).toBeGreaterThan(0);

  // Oracle from the PRD rule (available ingredients / all ingredients), not from the app: "Domowe spaghetti"
  // (supabase/seed.sql) has 11 ingredients and only "Pomidory z puszki" and "Cebula" are owned → 2/11 = 18%.
  // "Babeczki z jogurtem naturalnym" has neither → 0%, which the PRD puts at the end of the list.
  const tile = (name: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name }) });
  await expect(tile("Domowe spaghetti").getByLabel(/^Dopasowanie \d+%$/)).toHaveText("18%");
  await expect(tile("Babeczki z jogurtem naturalnym").getByLabel(/^Dopasowanie \d+%$/)).toHaveText("0%");
  await expect(matches.last()).toHaveText("0%");

  // Remember the whole ranked list (names and percents) to compare after the round trip.
  const titles = page.getByRole("heading", { level: 3 });
  const names = await titles.allTextContents();
  const percentTexts = await matches.allTextContents();

  // Action: open the best tile's details.
  const bestTile = titles.first().getByRole("link");
  const bestName = await bestTile.innerText();
  await bestTile.click();
  await expect(page.getByRole("heading", { name: bestName, level: 1 })).toBeVisible();

  // Assertion: back on the list, the tags and the same ranked list (every name and percent, in order) are there.
  // The details page has the link at the top and at the bottom; either one returns to the list.
  await page.getByRole("link", { name: "Wróć do listy" }).first().click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Usuń pomidor" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Usuń cebula" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Przepisy dopasowane do spiżarki" })).toBeVisible();
  await expect(titles).toHaveText(names);
  await expect(matches).toHaveText(percentTexts);
});

import { test as setup, expect, type Page } from "@playwright/test";

// Two accounts, one saved session each. Specs that change the saved pantry (staples, exclusions) use the pantry
// account, so they never change what the read-only specs on the main account see while running in parallel.
const accounts = [
  { name: "main", file: "playwright/.auth/user.json", username: "E2E_USERNAME", password: "E2E_PASSWORD" },
  {
    name: "pantry",
    file: "playwright/.auth/pantry-user.json",
    username: "E2E_PANTRY_USERNAME",
    password: "E2E_PANTRY_PASSWORD",
  },
] as const;

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/auth/signin");
  // The form is a React island: input typed before it hydrates is dropped. Retry fill + submit until the
  // submit leaves the sign-in page; signing in twice changes nothing. Clear first: re-filling the same value
  // fires no change event.
  await expect(async () => {
    await page.getByLabel("E-mail").fill("");
    await page.getByLabel("E-mail").fill(username);
    await page.getByLabel("Hasło", { exact: true }).fill("");
    await page.getByLabel("Hasło", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/signin"), { timeout: 5_000 });
  }).toPass();
  await expect(page.getByRole("button", { name: "Wyloguj" })).toBeVisible();
}

for (const account of accounts) {
  setup(`sign in once and save the session (${account.name} account)`, async ({ page }) => {
    const username = process.env[account.username];
    const password = process.env[account.password];
    if (!username || !password) {
      throw new Error(`Set ${account.username} and ${account.password} (see context/foundation/test-stack.md, ## E2E)`);
    }
    await signIn(page, username, password);
    await page.context().storageState({ path: account.file });
  });
}

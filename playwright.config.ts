import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Local secrets (E2E_USERNAME, E2E_PASSWORD, SUPABASE_URL/KEY) come from the gitignored .env.
// In CI the file is absent and the variables come from the job.
if (existsSync(".env")) process.loadEnvFile(".env");

// 4321 is the Astro default for `astro preview` (astro.config.mjs sets no port; CI's smoke step uses it too).
// E2E_PORT overrides it when that port is taken on this machine.
const PORT = Number(process.env.E2E_PORT ?? 4321);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // Production-like build + preview on the Workers runtime; preview reads .dev.vars (see the CI workflow).
    command: `npm run build && npm run preview -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Astro 7 moves `astro preview` into a background daemon when it detects an agent; keep it in the foreground.
    env: { ASTRO_PREVIEW_BACKGROUND: "1" },
  },
});

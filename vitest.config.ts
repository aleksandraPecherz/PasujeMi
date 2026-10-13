import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Absolute path: `new URL(...).pathname` would give "/C:/..." on Windows.
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) }],
  },
  test: {
    environment: "node",
    // Only app tests; course tooling in .claude/ ships its own scripts.
    include: ["src/**/*.test.ts"],
  },
});

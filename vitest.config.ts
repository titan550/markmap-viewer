import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/core/**", "src/render/**", "src/ui/paste.ts"],
      exclude: ["**/node_modules/**", "**/e2e/**"],
    },
  },
});

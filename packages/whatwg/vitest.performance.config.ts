import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 120000,
    include: ["test/performance.ts"],
    setupFiles: ["./test/utils/setup.ts"],
  },
});

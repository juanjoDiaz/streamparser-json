import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "plainjs",
          root: "./packages/plainjs",
          globals: true,
          include: ["test/*.ts", "test/types/*.ts"],
          exclude: [...configDefaults.exclude, "test/performance.ts"],
        },
      },
      {
        test: {
          name: "node",
          root: "./packages/node",
          globals: true,
          include: ["test/*.ts", "test/types/*.ts"],
          exclude: [...configDefaults.exclude, "test/performance.ts"],
          setupFiles: ["./test/utils/setup.ts"],
        },
      },
      {
        test: {
          name: "whatwg",
          root: "./packages/whatwg",
          globals: true,
          include: ["test/*.ts", "test/types/*.ts"],
          exclude: [...configDefaults.exclude, "test/performance.ts"],
          setupFiles: ["./test/utils/setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**"],
      exclude: ["**/index.ts", "**/*.d.ts", "**/types/**"],
      reporter: ["text", "lcov"],
    },
  },
});

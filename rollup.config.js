import typescript from "rollup-plugin-typescript2";
import pkg from "./package.json";

export default [
  {
    input: "src/index.ts",
    output: {
      file: pkg.browser,
      format: "umd",
      name: "jsonparse",
    },
    plugins: [
      typescript({
        tsconfigOverride: {
          compilerOptions: {
            target: "es5",
          },
        },
      }),
    ],
  },
];

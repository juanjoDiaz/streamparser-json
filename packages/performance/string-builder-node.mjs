import {
  NonBufferedString,
  BufferedString,
} from "@streamparser/json/utils/bufferedString.js";
import { runStringBuilderBench } from "./string-builder-bench.mjs";

const { results, correctness } = runStringBuilderBench({
  NonBufferedString,
  BufferedString,
});

// All variants must decode to the same string.
const values = Object.values(correctness);
const allEqual = values.every((v) => v === values[0]);
console.log(
  `correctness (all variants identical): ${allEqual} -> ${JSON.stringify(values[0])}`,
);
if (!allEqual) console.log(correctness);

console.log("\nNode:");
printTable(results);

export function printTable(results) {
  const cases = [...new Set(results.map((r) => r.case))];
  const variants = [...new Set(results.map((r) => r.variant))];
  const w = 22;
  console.log("case".padEnd(10) + variants.map((v) => v.padStart(w)).join(""));
  for (const c of cases) {
    let line = c.padEnd(10);
    for (const v of variants) {
      const r = results.find((x) => x.case === c && x.variant === v);
      line += `${r.mbps} MB/s`.padStart(w);
    }
    console.log(line);
  }
}

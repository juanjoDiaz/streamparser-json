import { readFileStrSync } from "https://deno.land/std/fs/mod.ts";
import JSONParse2 from "../dist/deno/jsonparser.ts";

function repeat(str: string, number: number): string {
  return Array(number).fill(str).join("");
}

console.log("====");
console.log("True");
console.log("====");
benchmark(repeat("true", 1000));

console.log("=====");
console.log("False");
console.log("=====");
benchmark(repeat("false", 1000));

console.log("======");
console.log("String");
console.log("======");
benchmark(repeat('"This is a not-very-long text string."', 1000));

console.log("==============");
console.log("Complex object");
console.log("==============");
benchmark(readFileStrSync("../samplejson/basic.json"));

console.log("==============================");
console.log("Complex object with no numbers");
console.log("==============================");
benchmark(readFileStrSync("../samplejson/basic-no-numbers.json"));

console.log("=======================");
console.log("Object with many spaces");
console.log("=======================");
const spaces = Array(1000).fill(" ").join("");
benchmark(
  repeat(
    `${spaces}{${spaces}"test"${spaces}:${spaces}"asdfasdf"${spaces}}`,
    1000
  )
);

console.log("===========");
console.log("Long string");
console.log("===========");
benchmark(`"${Array(100000).fill("a").join("")}"`);

console.log("===========");
console.log("Long number");
console.log("===========");
benchmark(`${Array(100000).fill("9").join("")}`);

function benchmark(jsonStr: string): void {
  const jsonparse2 = new JSONParse2();

  const start = performance.now();
  jsonparse2.write(jsonStr);
  const end = performance.now();
  console.log(`Time: ${end - start} ms.`);
}

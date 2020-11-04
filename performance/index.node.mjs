import { performance } from "perf_hooks";
import { readFileSync } from "fs";
import JSONParser from "../dist/mjs/jsonparse.mjs";

function repeat(str, number) {
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
benchmark(readFileSync("../samplejson/basic.json").toString());

console.log("==============================");
console.log("Complex object with no numbers");
console.log("==============================");
benchmark(readFileSync("../samplejson/basic-no-numbers.json").toString());

console.log("=======================");
console.log("Object with many spaces");
console.log("=======================");
const spaces = Array(1000).fill(" ").join("");
benchmark(
  repeat(
    `${spaces}{${spaces}"test"${spaces}:${spaces}"asdfasdf"${spaces}}`,
    1000,
  ),
);

console.log("===========");
console.log("Long string");
console.log("===========");
benchmark(`"${Array(100000).fill("a").join("")}"`);

console.log("===========");
console.log("Long number");
console.log("===========");
benchmark(`${Array(100000).fill("9").join("")}`);

function benchmark(jsonStr) {
  const jsonparser = new JSONParser();

  const start = performance.now();
  jsonparser.write(jsonStr);
  const end = performance.now();
  console.log(`Time: ${end - start} ms.`);
}

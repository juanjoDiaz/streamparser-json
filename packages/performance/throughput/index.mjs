import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Benchmark from "benchmark";
import { JSONParser } from "@streamparser/json";
import { JSONParser as JSONParserTransform } from "@streamparser/json-node";
import { JSONParser as JSONParserTransformStream } from "@streamparser/json-whatwg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleJsonDir = join(__dirname, "..", "..", "..", "samplejson");

function repeat(str, count) {
  return Array(count).fill(str).join("");
}

function runPlainjs(jsonStr) {
  const parser = new JSONParser({ separator: "" });
  parser.onValue = () => {
    /* Do nothing */
  };
  parser.onError = (err) => {
    throw err;
  };
  parser.write(jsonStr);
  if (!parser.isEnded) parser.end();
}

function runNode(jsonStr, deferred) {
  const parser = new JSONParserTransform({ separator: "" });
  parser.on("data", () => {
    /* Do nothing */
  });
  parser.on("error", (err) => {
    throw err;
  });
  parser.on("finish", () => deferred.resolve());
  parser.end(jsonStr);
}

async function runWhatwg(jsonStr) {
  const transformStream = new JSONParserTransformStream({ separator: "" });
  const writer = transformStream.writable.getWriter();
  const reader = transformStream.readable.getReader();

  const readLoop = (async () => {
    for (;;) {
      const { done } = await reader.read();
      if (done) return;
    }
  })();

  await writer.write(jsonStr);
  await writer.close();
  await readLoop;
}

function runWhatwgDeferred(jsonStr, deferred) {
  runWhatwg(jsonStr).then(
    () => deferred.resolve(),
    (err) => {
      throw err;
    },
  );
}

// Each scenario is run through all three packages' public APIs (the core
// parser directly, the Node Transform, and the WHATWG TransformStream), so
// results are comparable across adapters -- revealing stream-plumbing
// overhead on top of the shared core, and giving a baseline to compare
// against when validating future performance work on any of the three.
function runScenario(name, jsonStr) {
  return new Promise((resolve) => {
    console.log(`\n=== ${name} ===`);

    new Benchmark.Suite()
      .add("plainjs (core)", () => runPlainjs(jsonStr))
      .add("node (Transform)", {
        defer: true,
        fn: (deferred) => runNode(jsonStr, deferred),
      })
      .add("whatwg (TransformStream)", {
        defer: true,
        fn: (deferred) => runWhatwgDeferred(jsonStr, deferred),
      })
      .on("cycle", (event) => console.log(String(event.target)))
      .on("complete", function () {
        console.log(`Fastest: ${this.filter("fastest").map("name")}`);
        resolve();
      })
      .run({ async: true });
  });
}

const scenarios = [
  ["Boolean true", repeat("true", 1000)],
  ["Boolean false", repeat("false", 1000)],
  ["String", repeat('"This is a not-very-long text string."', 1000)],
  [
    "Complex object",
    readFileSync(join(sampleJsonDir, "basic.json")).toString(),
  ],
  [
    "Complex object with no numbers",
    readFileSync(join(sampleJsonDir, "basic-no-numbers.json")).toString(),
  ],
  [
    "Object with many spaces",
    (() => {
      const spaces = " ".repeat(1000);
      return repeat(
        `${spaces}{${spaces}"test"${spaces}:${spaces}"asdfasdf"${spaces}}`,
        1000,
      );
    })(),
  ],
  ["Long string", `"${"a".repeat(100_000)}"`],
  ["Long number", "9".repeat(100_000)],
];

for (const [name, jsonStr] of scenarios) {
  await runScenario(name, jsonStr);
}

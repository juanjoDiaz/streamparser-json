// Pure end-to-end throughput benchmark: parses a range of JSON shapes and a
// range of parser settings through the public parser API(s) and reports MB/s.
// Takes the parser classes as an argument so the identical code runs in Node
// (core + Node Transform + WHATWG TransformStream) and in browsers (core +
// WHATWG; the Node adapter needs node:stream and can't run in a browser). No
// imports of its own.
//
// It is deliberately a *measurement*, not a correctness check: every parse is
// driven to completion and any thrown error propagates, but the emitted values
// are discarded. Input is fed as bytes (Uint8Array), the way a real stream
// arrives, so the tokenizer's UTF-8 decode path is exercised for real.
//
// Scenarios are exposed one at a time (labels + runThroughputScenario) as well
// as all at once (runThroughputBench). The browser runner drives them one page
// per scenario so the page returns to idle between scenarios -- that keeps only
// one scenario's data live at a time and gives the engine's GC room to run,
// which Firefox needs to get through the whole matrix: in a single long-lived
// page it degrades to ~0 MB/s, and in one continuous task it OOM-crashes.

function now() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Number(process.hrtime.bigint()) / 1e6;
}
function median(a) {
  a = a.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

const NOOP = () => {
  /* discard the value; we only measure parse time */
};
const THROW = (err) => {
  throw err;
};

// --- drivers: one full parse of `bytes` with `opts`, resolved when done ------
function coreDriver(JSONParser) {
  return async (opts, bytes) => {
    const parser = new JSONParser(opts);
    parser.onValue = NOOP;
    parser.onError = THROW;
    parser.write(bytes);
    if (!parser.isEnded) parser.end();
  };
}
function nodeDriver(JSONParserNode) {
  return (opts, bytes) =>
    new Promise((resolve, reject) => {
      const parser = new JSONParserNode(opts);
      parser.on("data", NOOP);
      parser.on("error", reject);
      parser.on("finish", resolve);
      parser.end(bytes);
    });
}
function whatwgDriver(JSONParserWhatwg) {
  return async (opts, bytes) => {
    const transformStream = new JSONParserWhatwg(opts);
    const writer = transformStream.writable.getWriter();
    const reader = transformStream.readable.getReader();
    const readLoop = (async () => {
      for (;;) {
        const { done } = await reader.read();
        if (done) return;
      }
    })();
    await writer.write(bytes);
    await writer.close();
    await readLoop;
  };
}

function adaptersFor(parsers) {
  const a = [];
  if (parsers.JSONParser) a.push(["core", coreDriver(parsers.JSONParser)]);
  if (parsers.JSONParserNode)
    a.push(["node", nodeDriver(parsers.JSONParserNode)]);
  if (parsers.JSONParserWhatwg)
    a.push(["whatwg", whatwgDriver(parsers.JSONParserWhatwg)]);
  return a;
}

async function measure(drive, opts, bytes) {
  try {
    for (let i = 0; i < 3; i++) await drive(opts, bytes); // warm up the JIT
  } catch {
    return null; // this adapter can't run this input/setting; skip it
  }
  const t = [];
  for (let i = 0; i < 9; i++) {
    const start = now();
    await drive(opts, bytes);
    t.push(now() - start);
  }
  return Math.round(bytes.length / 1024 / 1024 / (median(t) / 1000));
}

// --- data generators (all synthetic, so they run identically everywhere) -----
function arrayOf(item, n) {
  const parts = new Array(n);
  for (let i = 0; i < n; i++) parts[i] = item(i);
  return "[" + parts.join(",") + "]";
}
function nested(depth) {
  return "{" + '"a":{'.repeat(depth) + '"v":1' + "}".repeat(depth + 1);
}
function whitespaceHeavy(count) {
  const s = " ".repeat(200);
  let out = "[";
  for (let i = 0; i < count; i++) {
    if (i) out += ",";
    out += `${s}{${s}"k"${s}:${s}"v"${s}}${s}`;
  }
  return out + "]";
}
function ndjson(item, n) {
  const parts = new Array(n);
  for (let i = 0; i < n; i++) parts[i] = item(i);
  return parts.join("\n");
}

const object = (i) => `{"id":${i},"name":"item-${i}","ok":${i % 2 === 0}}`;
const settingSource = () => arrayOf(object, 5000); // shared by the settings group

// Each scenario builds its own bytes lazily via make(), so only the scenario
// currently being measured is held in memory. `opts` are the parser options.
function scenarios() {
  const enc = new TextEncoder();
  const b = (source) => enc.encode(source());
  return [
    // Group 1: input shapes, default settings.
    {
      label: "array booleans",
      make: () => b(() => arrayOf((i) => (i % 2 ? "true" : "false"), 15000)),
    },
    {
      label: "array ints",
      make: () => b(() => arrayOf((i) => String(i), 15000)),
    },
    {
      label: "array floats",
      make: () => b(() => arrayOf((i) => `${i}.25`, 15000)),
    },
    {
      label: "array ascii str",
      make: () => b(() => arrayOf((i) => `"item-${i}"`, 15000)),
    },
    {
      label: "array cjk str",
      make: () => b(() => arrayOf((i) => `"日本語テキスト${i}"`, 10000)),
    },
    {
      label: "array escaped str",
      make: () => b(() => arrayOf((i) => `"line\\ntab\\t\\u00e9-${i}"`, 10000)),
    },
    { label: "array objects", make: () => b(() => arrayOf(object, 6000)) },
    {
      label: "nested objects",
      make: () => b(() => arrayOf(() => nested(8), 4000)),
    },
    { label: "whitespace heavy", make: () => b(() => whitespaceHeavy(2000)) },
    {
      label: "long string",
      make: () => b(() => '"' + "a".repeat(100000) + '"'),
    },
    { label: "long number", make: () => b(() => "9".repeat(100000)) },
    {
      label: "ndjson objects",
      make: () => b(() => ndjson(object, 6000)),
      opts: { separator: "\n" },
    },
    // Group 2: one representative input, a range of parser settings.
    { label: "opt default", make: () => b(settingSource), opts: {} },
    {
      label: "opt paths $.*",
      make: () => b(settingSource),
      opts: { paths: ["$.*"] },
    },
    {
      label: "opt keepStack:false",
      make: () => b(settingSource),
      opts: { paths: ["$.*"], keepStack: false },
    },
    {
      label: "opt buffered string",
      make: () => b(settingSource),
      opts: { stringBufferSize: 64 * 1024 },
    },
    {
      label: "opt partial tokens",
      make: () => b(settingSource),
      opts: { emitPartialTokens: true, emitPartialValues: true },
    },
  ];
}

export function throughputScenarioLabels() {
  return scenarios().map((s) => s.label);
}

export function throughputAdapterNames(parsers) {
  return adaptersFor(parsers).map((a) => a[0]);
}

// Measure a single scenario across the available adapters. Returns one row.
export async function runThroughputScenario(parsers, index) {
  const sc = scenarios()[index];
  const bytes = sc.make();
  const mbps = {};
  for (const [name, drive] of adaptersFor(parsers)) {
    mbps[name] = await measure(drive, sc.opts || {}, bytes);
  }
  return { label: sc.label, kb: Math.round(bytes.length / 1024), mbps };
}

// Measure the whole matrix in one call (used for the in-process Node run).
export async function runThroughputBench(parsers) {
  const count = scenarios().length;
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push(await runThroughputScenario(parsers, i));
  }
  return { adapters: throughputAdapterNames(parsers), rows };
}

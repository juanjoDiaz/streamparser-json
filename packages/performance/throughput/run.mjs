// Whole-library throughput benchmark runner.
//
// Measures MB/s to parse representative JSON, across the three public APIs
// (core, Node Transform, WHATWG TransformStream) on four engines (Node +
// Chromium/Firefox/WebKit), against the native JSON.parse baseline. Node also
// runs a settings/selector sweep, a stress tier, and a peak-memory + TTFV
// demonstration. Browsers run only the representative Tier-1 set (fed one
// scenario per fresh page so Firefox's heap resets -- see lib/serve.mjs).
//
// Usage: node throughput/run.mjs [--node-only]
import os from "node:os";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { JSONParser } from "@streamparser/json";
import { JSONParser as JSONParserNode } from "@streamparser/json-node";
import { JSONParser as JSONParserWhatwg } from "@streamparser/json-whatwg";
import {
  runTier1Scenario,
  tier1Scenarios,
  measureCells,
  measureTTFV,
  DEFAULT_TARGET_BYTES,
} from "./bench.mjs";
import { TIER1, TIER3_STRESS, generate } from "./corpus.mjs";
import { mbps } from "../lib/stats.mjs";
import { startServer, benchInBrowser } from "../lib/serve.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesDir = join(__dirname, "..", "..");
const NODE_ONLY = process.argv.includes("--node-only");

// Re-exec once under --expose-gc so we can force GC between timed samples (the
// repo's forced-GC practice; keeps samples independent). Skip if already have it.
if (!global.gc) {
  const r = spawnSync(
    process.execPath,
    ["--expose-gc", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 0);
}
const forceGC = () => global.gc();

const NODE_PARSERS = { JSONParser, JSONParserNode, JSONParserWhatwg };
const CANON = ["core", "node", "whatwg", "jsonparse"];
const ADAPTER_LABEL = {
  core: "core",
  node: "node",
  whatwg: "whatwg",
  jsonparse: "JSON.parse",
};

// ---------- formatting helpers ----------
const fmtMBps = (v) =>
  v == null ? "n/a" : v < 10 ? v.toFixed(1) : String(Math.round(v));
const cellMBps = (cell, bytes) => (cell ? mbps(bytes, cell.medianMs) : null);

// Minimum timed samples for a cell to count as replicated (mirrors the timed
// floor in lib/stats.mjs). Below it, or with null CV, the cell is low-confidence.
const MIN_SAMPLES = 5;
function fmtCell(cell, bytes) {
  if (!cell) return "n/a";
  const v = fmtMBps(cellMBps(cell, bytes));
  // A single/under-replicated sample can't have a meaningful CV; show n= and
  // flag it so it can't masquerade as the most-stable cell in the grid.
  if (cell.cv == null || cell.samples < MIN_SAMPLES) {
    return `${v} (n=${cell.samples}!)`;
  }
  const cv = Math.round(cell.cv * 100);
  return `${v} (${cv}%${cv > 15 ? "!" : ""})`;
}

function pad(s, w, right = true) {
  s = String(s);
  return right ? s.padStart(w) : s.padEnd(w);
}

// Print one grid: rows with a corpus/label column, KB, and one column per adapter.
function printGrid(title, rows, columns) {
  console.log(`\n=== ${title} ===`);
  const w = 13;
  let header = pad("input", 20, false) + pad("KB", 7);
  for (const c of columns) header += pad(ADAPTER_LABEL[c] || c, w);
  header += pad("core ×native", 14);
  console.log(header);
  for (const row of rows) {
    let line =
      pad(row.corpus || row.label, 20, false) +
      pad(Math.round(row.bytes / 1000), 7);
    for (const c of columns) line += pad(fmtCell(row.cells[c], row.bytes), w);
    // streaming tax: JSON.parse median / core median
    const core = cellMBps(row.cells.core, row.bytes);
    const native = cellMBps(row.cells.jsonparse, row.bytes);
    const tax =
      core && native ? `${(native / core).toFixed(1)}× slower` : "n/a";
    line += pad(tax, 14);
    console.log(line);
  }
}

// Which adapter columns actually have data in this set of rows (canonical order).
function presentColumns(rows) {
  const present = new Set();
  for (const row of rows)
    for (const c of CANON) if (row.cells[c]) present.add(c);
  return CANON.filter((c) => present.has(c));
}

// ---------- Node run ----------
console.log("streamparser-json — whole-library throughput benchmark\n");
const cpu = os.cpus()[0] ? os.cpus()[0].model : "unknown";
console.log(
  `node ${process.version} · ${os.type()} ${os.arch()} · ${cpu} · ${os.cpus().length} cores`,
);
console.log(
  `date ${new Date().toISOString()} · target ≈ ${(DEFAULT_TARGET_BYTES / 1e6).toFixed(1)} MB/corpus · MB/s = 10^6 B/s, median (CV%)`,
);
console.log(
  "Streaming parsers are expected to be slower than native JSON.parse; the benchmark quantifies that tax and compares adapters/engines.",
);

const results = {
  env: {
    node: process.version,
    os: `${os.type()} ${os.arch()}`,
    cpu,
    cores: os.cpus().length,
    date: new Date().toISOString(),
  },
  engines: {},
};

async function runNodeTier1() {
  const rows = [];
  const scenarios = tier1Scenarios();
  for (let i = 0; i < scenarios.length; i++) {
    process.stderr.write(`  node · ${scenarios[i].label}\r`);
    rows.push(
      await runTier1Scenario(NODE_PARSERS, i, DEFAULT_TARGET_BYTES, forceGC),
    );
  }
  process.stderr.write("".padEnd(60) + "\r");
  return rows;
}

const nodeTier1 = await runNodeTier1();
results.engines.node = { tier1: nodeTier1 };

// ---------- Tier 2: settings / selector sweep (Node, chunked) ----------
const TIER2_TARGET = 512_000;
async function runTier2() {
  const shapes = ["catalog", "records-array"].map((n) =>
    TIER1.find((e) => e.name === n),
  );
  const rows = [];
  for (const entry of shapes) {
    const { bytes, ndjson } = generate(entry, TIER2_TARGET);
    const base = ndjson ? { separator: "\n" } : {};
    const sel = entry.selector;
    const optsets = [
      ["default", { ...base }],
      [`paths ${sel}`, { ...base, paths: [sel] }],
      [`paths+keepStack:false`, { ...base, paths: [sel], keepStack: false }],
      [`stringBufferSize 64k`, { ...base, stringBufferSize: 64 * 1024 }],
      [
        `emitPartial*`,
        { ...base, emitPartialTokens: true, emitPartialValues: true },
      ],
    ];
    for (const [label, opts] of optsets) {
      process.stderr.write(`  node tier2 · ${entry.name} · ${label}\r`);
      const cells = await measureCells(NODE_PARSERS, {
        bytes,
        ndjson,
        opts,
        feedMode: "chunk16k",
        baseline: false,
        beforeSample: forceGC,
      });
      rows.push({
        corpus: `${entry.name}: ${label}`,
        bytes: bytes.length,
        cells,
      });
    }
  }
  process.stderr.write("".padEnd(60) + "\r");
  return rows;
}
const nodeTier2 = await runTier2();
results.engines.node.tier2 = nodeTier2;

// ---------- Tier 3: stress (Node, whole-blob core + baseline) ----------
async function runTier3() {
  const rows = [];
  for (const entry of TIER3_STRESS) {
    process.stderr.write(`  node tier3 · ${entry.name}\r`);
    const { bytes, ndjson } = generate(entry, DEFAULT_TARGET_BYTES);
    const cells = await measureCells(NODE_PARSERS, {
      bytes,
      ndjson,
      feedMode: "blob",
      beforeSample: forceGC,
    });
    rows.push({ corpus: entry.name, bytes: bytes.length, cells });
  }
  process.stderr.write("".padEnd(60) + "\r");
  return rows;
}
const nodeTier3 = await runTier3();
results.engines.node.tier3 = nodeTier3;

// ---------- Memory + TTFV demonstration (Node) ----------
// RETAINED heap after a forced GC (not peak-during: sampling heapUsed inside a
// sync parse just captures uncollected garbage, which is unfair vs JSON.parse's
// single internal call). Measures the memory you're actually left holding:
//   - JSON.parse: the whole materialized structure -- O(n), you must hold it.
//   - streaming, collect all top-level elements: also O(n) (streaming alone
//     doesn't save memory if you keep everything).
//   - streaming, keepStack:false, drop each element after emit: O(1), flat as
//     input grows -- the actual streaming win.
// GC before establishes the baseline; GC after (with the result still live)
// removes transient garbage so the delta is the true retained working set.
const CHUNK = 16 * 1024;
function retainedJsonParse(bytes) {
  forceGC();
  const base = process.memoryUsage().heapUsed;
  const r = JSON.parse(new TextDecoder().decode(bytes));
  forceGC();
  const delta = process.memoryUsage().heapUsed - base;
  globalThis.__memsink =
    (globalThis.__memsink || 0) + (Array.isArray(r) ? r.length : 1);
  return delta / 1e6;
}
function retainedStreaming(bytes, keep) {
  forceGC();
  const base = process.memoryUsage().heapUsed;
  const kept = [];
  const opts = keep ? { paths: ["$.*"] } : { paths: ["$.*"], keepStack: false };
  const p = new JSONParser(opts);
  p.onValue = (info) => {
    if (info.partial) return;
    if (keep) kept.push(info.value);
  };
  p.onError = (e) => {
    throw e;
  };
  for (let o = 0; o < bytes.length; o += CHUNK) {
    p.write(bytes.subarray(o, Math.min(o + CHUNK, bytes.length)));
  }
  if (!p.isEnded) p.end();
  forceGC();
  const delta = process.memoryUsage().heapUsed - base;
  globalThis.__memsink = (globalThis.__memsink || 0) + kept.length;
  return delta / 1e6;
}
function runMemory() {
  const entry = TIER1.find((e) => e.name === "records-array");
  const rows = [];
  for (const targetMB of [2, 8]) {
    const { bytes } = generate(entry, targetMB * 1e6);
    process.stderr.write(`  node memory · ${targetMB}MB\r`);
    rows.push({
      inputMB: +(bytes.length / 1e6).toFixed(1),
      jsonParse: +retainedJsonParse(bytes).toFixed(1),
      streamCollectAll: +retainedStreaming(bytes, true).toFixed(1),
      streamDrop: +retainedStreaming(bytes, false).toFixed(1),
    });
  }
  process.stderr.write("".padEnd(60) + "\r");
  return rows;
}
const memory = runMemory();
results.memory = memory;

// ---------- Time to first value (Node) ----------
// Measured WITH each shape's item selector, so "first value" is the first
// selected top-level record (not a trivial envelope leaf); consistent with the
// settings/memory tiers. JSON.parse yields nothing until the whole doc parses.
async function runTTFV() {
  const rows = [];
  for (const entry of TIER1) {
    process.stderr.write(`  node ttfv · ${entry.name}\r`);
    const { bytes, ndjson } = generate(entry, DEFAULT_TARGET_BYTES);
    const base = ndjson ? { separator: "\n" } : {};
    const opts = ndjson ? base : { ...base, paths: [entry.selector] };
    rows.push({
      corpus: entry.name,
      ttfv: await measureTTFV(NODE_PARSERS, { bytes, ndjson, opts }),
    });
  }
  process.stderr.write("".padEnd(60) + "\r");
  return rows;
}
const ttfv = await runTTFV();
results.ttfv = ttfv;

// ---------- Browsers ----------
if (!NODE_ONLY) {
  const { chromium, firefox, webkit } = await import("playwright");
  const importmap = {
    "@streamparser/json": "/plainjs/dist/mjs/index.js",
    "@streamparser/json/": "/plainjs/dist/mjs/",
  };
  // Browsers run the CHUNKED tier only (the realistic streaming path). Whole-blob
  // for a sync core in a browser is a marginal curiosity and running two feed
  // modes per page compounds the no-GC heap interference; the Node run keeps the
  // whole-blob reference where GC is forced and it's cheap.
  const moduleScript = `
import { JSONParser } from '/plainjs/dist/mjs/index.js';
import { JSONParser as JSONParserWhatwg } from '/whatwg/dist/mjs/index.js';
import { runTier1Scenario, tier1Scenarios, adapterNames } from '/performance/throughput/bench.mjs';
const parsers = { JSONParser, JSONParserWhatwg };
const all = tier1Scenarios();
const idx = all.map((s, i) => i).filter((i) => all[i].feedMode === 'chunk16k');
window.__bench = {
  labels: idx.map((i) => all[i].corpus),
  adapters: adapterNames(parsers),
  run: (k) => runTier1Scenario(parsers, idx[k]),
};`;
  const server = await startServer(packagesDir, { importmap, moduleScript });
  try {
    for (const [name, type] of [
      ["chromium", chromium],
      ["firefox", firefox],
      ["webkit", webkit],
    ]) {
      process.stderr.write(`  launching ${name}…\r`);
      try {
        const { rows } = await benchInBrowser(type, server.url, {
          onScenario: (label) =>
            process.stderr.write(`  ${name} · ${label}`.padEnd(60) + "\r"),
        });
        results.engines[name] = { tier1: rows.filter(Boolean) };
      } catch (e) {
        process.stderr.write(
          `  ${name} could not run: ${e.message.split("\n")[0]}\n`,
        );
      }
      process.stderr.write("".padEnd(60) + "\r");
    }
  } finally {
    server.close();
  }
}

// ---------- Report ----------
for (const [engine, data] of Object.entries(results.engines)) {
  if (!data.tier1) continue;
  const blob = data.tier1.filter((r) => r.feedMode === "blob");
  const chunk = data.tier1.filter((r) => r.feedMode === "chunk16k");
  if (blob.length)
    printGrid(
      `${engine} — whole-blob (core vs native)`,
      blob,
      presentColumns(blob),
    );
  if (chunk.length)
    printGrid(
      `${engine} — 16 KB chunks (streaming; realistic)`,
      chunk,
      presentColumns(chunk),
    );
}

// Tier 2 (Node)
console.log(
  "\n=== node — settings / selector sweep (16 KB chunks, 512 KB corpora) ===",
);
{
  const w = 13,
    cols = presentColumns(nodeTier2);
  let h = pad("shape: option", 34, false);
  for (const c of cols) h += pad(ADAPTER_LABEL[c], w);
  console.log(h);
  for (const row of nodeTier2) {
    let line = pad(row.corpus, 34, false);
    for (const c of cols) line += pad(fmtCell(row.cells[c], row.bytes), w);
    console.log(line);
  }
}

// Tier 3 (Node)
console.log("\n=== node — stress tier (whole-blob; NOT representative) ===");
{
  const cols = presentColumns(nodeTier3);
  let h = pad("shape", 20, false) + pad("KB", 7);
  for (const c of cols) h += pad(ADAPTER_LABEL[c], 13);
  console.log(h);
  for (const row of nodeTier3) {
    let line =
      pad(row.corpus, 20, false) + pad(Math.round(row.bytes / 1000), 7);
    for (const c of cols) line += pad(fmtCell(row.cells[c], row.bytes), 13);
    console.log(line);
  }
}

// Memory + TTFV (Node)
console.log("\n=== node — retained heap after parse (MB; lower is better) ===");
console.log(
  pad("input MB", 10) +
    pad("JSON.parse", 12) +
    pad("stream collect-all", 20) +
    pad("stream keepStack:false", 24),
);
for (const r of memory) {
  console.log(
    pad(r.inputMB, 10) +
      pad(r.jsonParse, 12) +
      pad(r.streamCollectAll, 20) +
      pad(r.streamDrop, 24),
  );
}
console.log(
  "(JSON.parse & collect-all grow O(n); keepStack:false drops each element after emit → stays flat)",
);

console.log(
  "\n=== node — time to first record, 16 KB chunks (ms; lower = lower latency) ===",
);
console.log(
  pad("corpus", 20, false) +
    pad("core", 10) +
    pad("node", 10) +
    pad("whatwg", 10) +
    pad("JSON.parse", 12),
);
for (const row of ttfv) {
  const t = (c) =>
    row.ttfv[c] != null ? row.ttfv[c].toFixed(row.ttfv[c] < 10 ? 2 : 1) : "n/a";
  console.log(
    pad(row.corpus, 20, false) +
      pad(t("core"), 10) +
      pad(t("node"), 10) +
      pad(t("whatwg"), 10) +
      pad(t("jsonparse"), 12),
  );
}
console.log(
  "(streaming = latency to first selected record; JSON.parse = full parse, yields nothing sooner)",
);

// Cross-engine summary (realistic-mixed, 16 KB chunks)
console.log("\n=== cross-engine summary — realistic-mixed, 16 KB chunks ===");
console.log(
  pad("engine", 12, false) +
    pad("core", 10) +
    pad("whatwg", 10) +
    pad("JSON.parse", 12) +
    pad("core % of native", 18),
);
for (const [engine, data] of Object.entries(results.engines)) {
  if (!data.tier1) continue;
  const row = data.tier1.find(
    (r) => r.corpus === "realistic-mixed" && r.feedMode === "chunk16k",
  );
  if (!row) continue;
  const core = cellMBps(row.cells.core, row.bytes);
  const whatwg = cellMBps(row.cells.whatwg, row.bytes);
  const native = cellMBps(row.cells.jsonparse, row.bytes);
  const pct = core && native ? `${Math.round((core / native) * 100)}%` : "n/a";
  console.log(
    pad(engine, 12, false) +
      pad(fmtMBps(core), 10) +
      pad(fmtMBps(whatwg), 10) +
      pad(fmtMBps(native), 12) +
      pad(pct, 18),
  );
}

// DCE guard: reference the accumulated sink so the parses can't be optimized away.
if (globalThis.__sink === 0xdeadbeef && globalThis.__memsink === -1)
  console.error("impossible", globalThis.__sink);

const outPath = join(__dirname, "results.json");
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nwrote ${outPath}`);

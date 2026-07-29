// Whole-library throughput benchmark. Pure and portable: it imports only the
// (import-free) corpus generators and shared stats, and takes the parser classes
// as arguments, so the identical code runs in Node (core + Node Transform +
// WHATWG TransformStream + JSON.parse) and in a browser page (core + WHATWG +
// JSON.parse; the Node adapter needs node:stream). The Node runner also drives
// the settings/stress tiers through the same primitives.
import { measureCell, median, now } from "../lib/stats.mjs";
import { generate, TIER1 } from "./corpus.mjs";

export const DEFAULT_TARGET_BYTES = 2_000_000; // ~2 MB per corpus (runtime knob)
const CHUNK_BYTES = 16 * 1024; // realistic socket/file read

// Cheap, data-dependent checksum folded from every COMPLETED value so the engine
// can't prove the parse side-effect-free and elide it. Identical in the three
// streaming drivers so the accumulator cost doesn't bias one against another.
// Note: the streaming drivers fold once per emitted node (default opts emit the
// whole tree) whereas the JSON.parse baseline folds once on the root, so the
// streaming sink does more work. Measured worst case ~1.5-2% on the most
// node-dense corpus (numbers-array); the bias is conservative (it only ever
// understates the library vs native) and well below the CV noise floor. A
// data-dependent per-node fold is kept anyway because a root-only fold on an
// array/object root is constant (+1) and would not defeat dead-code elimination.
function foldValue(sink, value) {
  if (typeof value === "number") return (sink + value) | 0;
  if (typeof value === "string") return (sink + value.length) | 0;
  return (sink + 1) | 0;
}

// O(1), data-dependent size of a JSON.parse result root, for the baseline sink.
// Must special-case strings: Object.keys(str) would materialize a per-character
// index-key array (O(n)) and dominate the timing for a string-rooted document.
function rootCount(r) {
  if (typeof r === "string") return r.length;
  if (Array.isArray(r)) return r.length;
  if (r && typeof r === "object") return Object.keys(r).length;
  return 1;
}

const decoder = new TextDecoder();

// --- drivers: each runs ONE complete parse of `bytes` fed in `chunk`-byte
// pieces, returns { sink, ttfvMs } (ttfvMs = time from feed start to first
// completed value -- the streaming-latency signal).
function coreDriver(JSONParser, opts) {
  return (bytes, chunk) => {
    const parser = new JSONParser(opts);
    let sink = 0,
      ttfvMs = -1;
    const start = now();
    parser.onValue = (info) => {
      if (info.partial) return;
      if (ttfvMs < 0) ttfvMs = now() - start;
      sink = foldValue(sink, info.value);
    };
    parser.onError = (e) => {
      throw e;
    };
    for (let o = 0; o < bytes.length; o += chunk) {
      parser.write(bytes.subarray(o, Math.min(o + chunk, bytes.length)));
    }
    if (!parser.isEnded) parser.end();
    return { sink, ttfvMs: ttfvMs < 0 ? 0 : ttfvMs };
  };
}

function nodeDriver(JSONParserNode, opts) {
  return (bytes, chunk) =>
    new Promise((resolve, reject) => {
      const parser = new JSONParserNode(opts);
      let sink = 0,
        ttfvMs = -1;
      const start = now();
      parser.on("data", (info) => {
        if (info.partial) return;
        if (ttfvMs < 0) ttfvMs = now() - start;
        sink = foldValue(sink, info.value);
      });
      parser.on("error", reject);
      parser.on("end", () =>
        resolve({ sink, ttfvMs: ttfvMs < 0 ? 0 : ttfvMs }),
      );
      for (let o = 0; o < bytes.length; o += chunk) {
        parser.write(bytes.subarray(o, Math.min(o + chunk, bytes.length)));
      }
      parser.end();
    });
}

function whatwgDriver(JSONParserWhatwg, opts) {
  return async (bytes, chunk) => {
    const ts = new JSONParserWhatwg(opts);
    const writer = ts.writable.getWriter();
    const reader = ts.readable.getReader();
    let sink = 0,
      ttfvMs = -1;
    const start = now();
    const readLoop = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        if (value.partial) continue;
        if (ttfvMs < 0) ttfvMs = now() - start;
        sink = foldValue(sink, value.value);
      }
    })();
    for (let o = 0; o < bytes.length; o += chunk) {
      await writer.write(bytes.subarray(o, Math.min(o + chunk, bytes.length)));
    }
    await writer.close();
    await readLoop;
    return { sink, ttfvMs: ttfvMs < 0 ? 0 : ttfvMs };
  };
}

// Native baseline: bytes -> values via TextDecoder + JSON.parse (the honest
// apples-to-apples; the streaming parser also decodes). NDJSON: split + parse
// per line. TTFV is the full parse time (native yields nothing until done).
function jsonParseDriver(ndjson) {
  return (bytes) => {
    const start = now();
    const str = decoder.decode(bytes);
    let sink = 0;
    if (ndjson) {
      for (const line of str.split("\n")) {
        if (!line) continue;
        sink = (sink + rootCount(JSON.parse(line))) | 0;
      }
    } else {
      sink = (sink + rootCount(JSON.parse(str))) | 0;
    }
    return { sink, ttfvMs: now() - start };
  };
}

// Build the ordered [name, drive] list for a corpus/opts/feed-mode.
//
// The Node Transform and WHATWG TransformStream are STREAM adapters: their real
// use is a sequence of bounded chunks, and feeding one giant blob to Node's
// TransformStream is pathologically slow (a ~2 MB single enqueue takes seconds --
// a Node stream-queue quirk, not the parser). So the streaming adapters run only
// in chunked mode; whole-blob measures the sync core against the JSON.parse
// baseline (the pure-parse upper bound). Core and the baseline run in both modes.
function driversFor(parsers, opts, ndjson, feedMode, baseline) {
  const streaming = feedMode === "chunk16k";
  const list = [];
  // Measurement order matters in browsers: they can't force GC between cells, so
  // the heavy WHATWG run's leftover heap would degrade whatever runs after it in
  // the same page. Measure the JSON.parse baseline and the sync core FIRST
  // (clean), leaving the slow/erratic WHATWG adapter last. Display order is fixed
  // separately (adapterNames), so the reordering is invisible in the tables.
  if (baseline) list.push(["jsonparse", jsonParseDriver(ndjson)]);
  if (parsers.JSONParser)
    list.push(["core", coreDriver(parsers.JSONParser, opts)]);
  if (streaming && parsers.JSONParserNode)
    list.push(["node", nodeDriver(parsers.JSONParserNode, opts)]);
  if (streaming && parsers.JSONParserWhatwg)
    list.push(["whatwg", whatwgDriver(parsers.JSONParserWhatwg, opts)]);
  return list;
}

// Canonical column order, filtered to adapters actually present.
export function adapterNames(parsers, baseline = true) {
  const order = [];
  if (parsers.JSONParser) order.push("core");
  if (parsers.JSONParserNode) order.push("node");
  if (parsers.JSONParserWhatwg) order.push("whatwg");
  if (baseline) order.push("jsonparse");
  return order;
}

// Measure every applicable adapter on one corpus/opts/feed-mode. Returns
// { adapter: cell|null }. Streaming adapters appear only in chunked mode.
export async function measureCells(
  parsers,
  {
    bytes,
    ndjson,
    opts = {},
    feedMode = "blob",
    baseline = true,
    beforeSample,
  } = {},
) {
  const chunk = feedMode === "chunk16k" ? CHUNK_BYTES : bytes.length;
  const cells = {};
  for (const [name, drive] of driversFor(
    parsers,
    opts,
    ndjson,
    feedMode,
    baseline,
  )) {
    cells[name] = await measureCell(() => drive(bytes, chunk), {
      beforeSample,
    });
  }
  return cells;
}

// Time-to-first-value per adapter, chunked feed. Measured with a light fixed
// sample count (TTFV is stable and cheap) rather than the full timing policy.
// Pass opts.paths so "first value" is the first SELECTED top-level record, not
// the first trivial envelope leaf. Returns { adapter: medianTtfvMs|null }.
export async function measureTTFV(
  parsers,
  { bytes, ndjson, opts = {}, samples = 7 } = {},
) {
  const out = {};
  for (const [name, drive] of driversFor(
    parsers,
    opts,
    ndjson,
    "chunk16k",
    true,
  )) {
    const ts = [];
    try {
      for (let i = 0; i < samples; i++) {
        const r = await drive(bytes, CHUNK_BYTES);
        ts.push(r.ttfvMs);
      }
      out[name] = median(ts);
    } catch {
      out[name] = null;
    }
  }
  return out;
}

// --- Tier-1 scenario list (8 corpora x 2 feed modes), the browser-facing set ---
const FEED_LABEL = { blob: "whole-blob", chunk16k: "16 KB chunks" };

export function tier1Scenarios() {
  const out = [];
  for (const entry of TIER1) {
    for (const feedMode of ["blob", "chunk16k"]) {
      out.push({
        label: `${entry.name} · ${FEED_LABEL[feedMode]}`,
        corpus: entry.name,
        feedMode,
      });
    }
  }
  return out;
}

// Run one Tier-1 scenario by index (used by both Node and the browser page).
export async function runTier1Scenario(
  parsers,
  index,
  targetBytes = DEFAULT_TARGET_BYTES,
  beforeSample,
) {
  const scenarios = tier1Scenarios();
  const scen = scenarios[index];
  const entry = TIER1.find((e) => e.name === scen.corpus);
  const { bytes, ndjson } = generate(entry, targetBytes);
  // NDJSON is many documents separated by newlines -- the streaming parser needs
  // the separator option to accept doc-after-doc (native baseline splits lines).
  const opts = ndjson ? { separator: "\n" } : {};
  const cells = await measureCells(parsers, {
    bytes,
    ndjson,
    opts,
    feedMode: scen.feedMode,
    beforeSample,
  });
  return {
    label: scen.label,
    corpus: scen.corpus,
    feedMode: scen.feedMode,
    bytes: bytes.length,
    cells,
  };
}

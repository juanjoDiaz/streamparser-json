# @streamparser/json-performance

Benchmarks for [streamparser-json](../../). The **primary** deliverable is a
whole-library throughput suite; a secondary `micro/` area keeps internal
decision benchmarks.

The library packages must be built first (the benchmarks import their built
ESM): from the repo root run `npm run build`, then:

```sh
# whole-library throughput, all 4 engines (Node + Chromium/Firefox/WebKit) — ~3 min
npm run benchmark            -w packages/performance

# same, Node only (fast inner loop, no Playwright)
npm run benchmark:node       -w packages/performance

# internal micro-benchmarks (decision tools, not overall-impact)
npm run benchmark:micro      -w packages/performance
```

## Throughput (`throughput/`)

Measures **MB/s** (decimal, 10⁶ B/s) to parse representative JSON into
materialized values, across the three public APIs — the core `JSONParser`, the
Node `Transform`, and the WHATWG `TransformStream` — on four engines, anchored
to native `JSON.parse`. Results also land in `throughput/results.json`.

- **Corpus** (`corpus.mjs`): 8 deterministic, in-process generators (~2 MB
  each) covering the shapes a general parser meets in production — a
  heterogeneous "real JSON" record set, number-heavy GeoJSON, a deeply-nested
  catalog, a unicode-heavy social feed, a flat record export, single-type
  number/string arrays, and an NDJSON log stream. Shapes mirror the canonical
  `nativejson-benchmark` trio (canada / citm_catalog / twitter) so numbers line
  up with the literature. All synthetic — no real data, nothing committed.
- **Feed modes**: *whole-blob* (one `write` — the pure-parse upper bound, core +
  `JSON.parse` only) and *16 KB chunks* (the realistic streaming path — all
  adapters). Stream adapters run only chunked; feeding a `TransformStream` one
  multi-MB blob hits a Node stream-queue pathology, not the parser.
- **Method**: bytes are fed (real UTF-8 decode path); adaptive warmup + median
  of N samples with forced GC between them; a data-dependent checksum defeats
  dead-code elimination; `CV%` flags noisy cells (`!` if >15%). Firefox runs one
  scenario per fresh page (its heap otherwise degrades / OOM-crashes).
- Node also runs a **settings/selector sweep** (paths, keepStack:false, buffered
  string, partial tokens), a **stress tier** (explicitly non-representative), a
  **retained-memory** demonstration (JSON.parse O(n) vs keepStack:false O(1)),
  and **time-to-first-value** (streaming latency vs native).

Streaming parsers are expected to be slower than native `JSON.parse` (C++,
whole-document, no per-value callback); the suite quantifies that tax and
compares the adapters against each other and across engines. Absolute MB/s is
hardware-specific — the native-relative ratio is the portable number.

## Micro-benchmarks (`micro/`)

Narrow internal benchmarks used to justify specific optimizations, not to
measure overall library throughput: `string-builder` (NonBuffered vs Buffered
string building), `string-crossover` (the length where buffering wins), and
`string-span` (per-code-point vs maximal-span multibyte decode). Kept because
they are the evidence base for the landed string-path perf commits.

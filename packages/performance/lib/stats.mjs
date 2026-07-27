// Shared measurement primitives. Import-free and browser-safe: no `process`,
// no `global.gc` -- GC is injected by the Node runner via the `beforeSample`
// hook so the same code runs unchanged in a browser page.

export function now() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Number(process.hrtime.bigint()) / 1e6;
}

export function median(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx];
}

// Dispersion as coefficient of variation from the interquartile spread, which
// (unlike stddev) isn't dragged by the right-skewed GC/scheduling tail.
export function stats(times) {
  const s = times.slice().sort((x, y) => x - y);
  const med = median(s);
  // cv is meaningless with a single sample -- return null (rendered as a
  // low-confidence flag) rather than 0, which would read as "perfectly stable".
  const cv =
    s.length < 2
      ? null
      : med
        ? (percentile(s, 75) - percentile(s, 25)) / med
        : 0;
  return { medianMs: med, minMs: s[0], cv, samples: s.length };
}

// Adaptive, time-boxed measurement of one cell. `drive` runs one complete parse
// and returns { sink, ttfvMs } (ttfvMs optional). Self-scaling: cheap cells get
// many reps, expensive ones stop at the floors -- keeps a 4-engine run tolerable.
// Returns null if warmup throws (adapter can't run this input/option).
export async function measureCell(drive, opts = {}) {
  const { beforeSample } = opts;
  const WARM_MIN_ITERS = 3,
    WARM_MIN_MS = 50,
    WARM_MAX_ITERS = 10,
    WARM_MAX_MS = 500;
  const TIME_MIN_SAMPLES = 5,
    TIME_MIN_MS = 300,
    TIME_MAX_SAMPLES = 30,
    TIME_MAX_MS = 3000;

  try {
    let warm = 0;
    const w0 = now();
    for (;;) {
      await drive();
      warm++;
      const el = now() - w0;
      if (warm >= WARM_MAX_ITERS || el >= WARM_MAX_MS) break;
      if (warm >= WARM_MIN_ITERS && el >= WARM_MIN_MS) break;
    }
  } catch {
    return null;
  }

  const times = [],
    ttfvs = [];
  let sinkAcc = 0;
  const t0 = now();
  let n = 0;
  for (;;) {
    if (beforeSample) beforeSample();
    const start = now();
    const r = await drive();
    times.push(now() - start);
    if (r) {
      if (typeof r.sink === "number") sinkAcc = (sinkAcc + r.sink) | 0;
      if (typeof r.ttfvMs === "number") ttfvs.push(r.ttfvMs);
    }
    n++;
    const el = now() - t0;
    if (n >= TIME_MAX_SAMPLES || el >= TIME_MAX_MS) break;
    if (n >= TIME_MIN_SAMPLES && el >= TIME_MIN_MS) break;
  }

  // Fold the checksum into a global so the engine can't prove the parse output
  // unused and elide the work (dead-code elimination guard).
  globalThis.__sink = ((globalThis.__sink || 0) ^ sinkAcc) >>> 0;

  return { ...stats(times), ttfvMedianMs: ttfvs.length ? median(ttfvs) : null };
}

// MB/s (decimal: 1 MB = 10^6 bytes) from a time in ms.
export const mbps = (bytes, ms) => (ms > 0 ? bytes / 1e6 / (ms / 1000) : 0);

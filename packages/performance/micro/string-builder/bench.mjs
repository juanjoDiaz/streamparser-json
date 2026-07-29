// Pure benchmark logic shared by the Node runner and the Playwright browser
// runner. It takes the three StringBuilder implementations as an argument so
// the identical code runs everywhere; it has no imports of its own.
//
// It mimics how the tokenizer feeds a builder: ASCII string bytes go through
// appendChar one at a time (the hot path this change targets), and the builder
// instance is reused across strings via reset(), exactly as the tokenizer does.

function makeCases() {
  const enc = new TextEncoder();
  // many small strings (typical JSON values), ~10 bytes each
  const small = [];
  for (let i = 0; i < 40000; i++) small.push(enc.encode(`value-${i}-abc`));
  // medium strings, ~100 bytes each
  const medium = [];
  for (let i = 0; i < 15000; i++) medium.push(enc.encode("x".repeat(100) + i));
  // one very large string
  const large = [enc.encode("a".repeat(4000000))];
  // many typical JSON numbers: a mix of short ints and floats, ~1-8 bytes each
  const numTypical = [];
  for (let i = 0; i < 40000; i++) {
    numTypical.push(enc.encode(String(i)));
    numTypical.push(enc.encode(String(i + 0.25)));
  }
  // one very long number
  const numLong = [enc.encode(`1.${"9".repeat(200000)}`)];
  return { small, medium, large, numTypical, numLong };
}

function totalBytes(chunks) {
  let n = 0;
  for (const c of chunks) n += c.length;
  return n;
}

// Feed each chunk to a reused builder via appendChar-per-byte, toString, reset.
function driveOnce(makeBuilder, chunks) {
  const sb = makeBuilder();
  let sink = 0;
  for (let c = 0; c < chunks.length; c++) {
    const bytes = chunks[c];
    for (let i = 0; i < bytes.length; i++) sb.appendChar(bytes[i]);
    sink += sb.toString().length;
    sb.reset();
  }
  return sink;
}

function median(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// now() works in both Node and browsers.
function now() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Number(process.hrtime.bigint()) / 1e6;
}

export function runStringBuilderBench(builders) {
  const { NonBufferedString, BufferedString } = builders;
  const variants = [
    // The default (stringBufferSize: 0 / numberBufferSize: 0).
    { name: "NonBuffered (default)", make: () => new NonBufferedString() },
    // The opt-in (stringBufferSize/numberBufferSize > 4).
    { name: "Buffered 4KB", make: () => new BufferedString(4096) },
  ];
  const cases = makeCases();

  // Correctness: every variant must reproduce the exact string when fed the
  // way the tokenizer feeds it -- ASCII bytes (< 128) via appendChar, multibyte
  // sequences via appendBuf (appendChar is ASCII-only by contract).
  const sample = new TextEncoder().encode("he:llo-wörld-éè-123");
  const correctness = {};
  for (const v of variants) {
    const sb = v.make();
    for (let i = 0; i < sample.length; ) {
      const b = sample[i];
      if (b < 128) {
        sb.appendChar(b);
        i += 1;
      } else {
        const len = b >= 240 ? 4 : b >= 224 ? 3 : 2;
        sb.appendBuf(sample, i, i + len);
        i += len;
      }
    }
    correctness[v.name] = sb.toString();
  }

  const results = [];
  for (const [caseName, chunks] of Object.entries(cases)) {
    const mb = totalBytes(chunks) / 1024 / 1024;
    for (const v of variants) {
      for (let i = 0; i < 5; i++) driveOnce(v.make, chunks); // warm up
      const times = [];
      for (let i = 0; i < 15; i++) {
        const t = now();
        driveOnce(v.make, chunks);
        times.push(now() - t);
      }
      const ms = median(times);
      results.push({
        case: caseName,
        variant: v.name,
        ms: Number(ms.toFixed(2)),
        mbps: Math.round(mb / (ms / 1000)),
      });
    }
  }
  return { results, correctness };
}

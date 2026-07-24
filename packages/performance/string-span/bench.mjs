// Pure benchmark: multibyte string building, per-code-point appendBuf (what the
// tokenizer does today) vs a single maximal-span appendBuf. Takes the builder
// classes as an argument; no imports of its own. Runs in Node and browsers.

function now() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Number(process.hrtime.bigint()) / 1e6;
}
function median(a) {
  a = a.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

// per-code-point: appendBuf once per 3-byte CJK char (mimics current tokenizer)
function drivePerCP(make, chunks) {
  const sb = make();
  let sink = 0;
  for (let c = 0; c < chunks.length; c++) {
    const b = chunks[c];
    for (let k = 0; k < b.length; k += 3) sb.appendBuf(b, k, k + 3);
    sink += sb.toString().length;
    sb.reset();
  }
  return sink;
}
// maximal-span: appendBuf the whole run once
function driveSpan(make, chunks) {
  const sb = make();
  let sink = 0;
  for (let c = 0; c < chunks.length; c++) {
    sb.appendBuf(chunks[c], 0, chunks[c].length);
    sink += sb.toString().length;
    sb.reset();
  }
  return sink;
}

function measure(fn, make, chunks, totalBytes) {
  try {
    for (let i = 0; i < 4; i++) fn(make, chunks);
  } catch {
    return null; // e.g. BufferedString overflow on large spans
  }
  const t = [];
  for (let i = 0; i < 13; i++) {
    const s = now();
    fn(make, chunks);
    t.push(now() - s);
  }
  return Math.round(totalBytes / 1024 / 1024 / (median(t) / 1000));
}

export function runSpanBench(builders) {
  const { NonBufferedString, BufferedString } = builders;
  const enc = new TextEncoder();
  const cjk = (n) => {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(0x4e00 + (i % 0x1000));
    return enc.encode(s); // 3 bytes/char
  };
  const cases = [
    { name: "short CJK (8 chars)", n: 8, count: 40000 },
    { name: "medium CJK (40 chars)", n: 40, count: 12000 },
  ];
  const results = [];
  for (const { name, n, count } of cases) {
    const chunks = new Array(count);
    for (let i = 0; i < count; i++) chunks[i] = cjk(n);
    const total = chunks.reduce((a, c) => a + c.length, 0);
    for (const [bname, make] of [
      ["NonBuffered", () => new NonBufferedString()],
      ["Buffered4K", () => new BufferedString(4096)],
    ]) {
      const perCP = measure(drivePerCP, make, chunks, total);
      const span = measure(driveSpan, make, chunks, total);
      results.push({ case: name, builder: bname, perCP, span });
    }
  }
  return results;
}

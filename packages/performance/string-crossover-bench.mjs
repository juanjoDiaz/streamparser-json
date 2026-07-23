// Pure benchmark: sweeps string length to find where buffered (default) starts
// beating the per-character NonBuffered builder on each JS engine. Takes the
// builder classes as an argument so the identical code runs in Node and in a
// browser page. No imports of its own.

function now() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Number(process.hrtime.bigint()) / 1e6;
}

function median(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// Feed each chunk to a reused builder via appendChar-per-byte (the tokenizer's
// ASCII path), toString, reset -- exactly as makeCases-driven bench does.
function drive(makeBuilder, chunks) {
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

export function runCrossoverBench(builders) {
  const { NonBufferedString, BufferedString } = builders;
  const lengths = [8, 16, 24, 32, 48, 64, 96];
  const enc = new TextEncoder();
  const TARGET_BYTES = 3_000_000; // ~constant total work per length

  const results = [];
  for (const L of lengths) {
    const count = Math.max(1, Math.floor(TARGET_BYTES / L));
    const chunks = new Array(count);
    for (let i = 0; i < count; i++) {
      let s = "";
      for (let j = 0; j < L; j++) s += String.fromCharCode(97 + ((i + j) % 26));
      chunks[i] = enc.encode(s); // exactly L ASCII bytes
    }
    const totalMB = (L * count) / 1024 / 1024;

    const row = { length: L };
    for (const [name, make] of [
      ["nonBuffered", () => new NonBufferedString()],
      ["buffered", () => new BufferedString(4096)],
    ]) {
      for (let w = 0; w < 3; w++) drive(make, chunks); // warm up
      const times = [];
      for (let k = 0; k < 11; k++) {
        const t = now();
        drive(make, chunks);
        times.push(now() - t);
      }
      row[name] = Math.round(totalMB / (median(times) / 1000));
    }
    results.push(row);
  }
  return results;
}

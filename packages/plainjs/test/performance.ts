import * as v8 from "node:v8";
import * as vm from "node:vm";
import JSONParser from "../src/jsonparser.js";
import { charset } from "../src/utils/utf-8.js";
import { runJSONParserTest } from "./utils/testRunner.js";

const quote = String.fromCharCode(charset.QUOTATION_MARK);

const oneKB = 1024;
const oneMB = 1024 * oneKB;
const twoHundredMB = 200 * oneMB;
const kbsIn200MBs = twoHundredMB / oneKB;

// Run a real garbage collection without needing the `--expose-gc` CLI flag, so
// the heap assertions measure *live* memory (post-collection) rather than live
// plus uncollected garbage -- the latter is what made an absolute heapUsed
// threshold flaky, since it depended on when GC happened to run.
function forceGC(): void {
  v8.setFlagsFromString("--expose-gc");
  try {
    const gc = vm.runInNewContext("gc");
    if (typeof gc === "function") gc();
  } finally {
    v8.setFlagsFromString("--no-expose-gc");
  }
}

describe("performance", () => {
  describe("buffered parsing", () => {
    test("can handle large strings without running out of memory", async () => {
      await runJSONParserTest(
        new JSONParser({ stringBufferSize: 64 * 1024 }),
        function* () {
          const chunk = new Uint8Array(oneKB).fill(
            charset.LATIN_SMALL_LETTER_A,
          );
          yield quote;
          for (let index = 0; index < kbsIn200MBs; index++) {
            yield chunk;
          }
          yield quote;
        },
        ({ value }) => expect((value as string).length).toEqual(twoHundredMB),
      );
    });

    test("can handle large numbers without running out of memory", async () => {
      const jsonParser = new JSONParser({ numberBufferSize: 64 * 1024 });
      await runJSONParserTest(
        jsonParser,
        function* () {
          const chunk = new Uint8Array(oneKB).fill(charset.DIGIT_ONE);
          yield "1.";
          for (let index = 0; index < kbsIn200MBs; index++) {
            yield chunk;
          }
        },
        ({ value }) => expect(value).toEqual(1.1111111111111112),
      );
    });
  });

  test(`should keep memory stable if keepStack === false on array`, async () => {
    const chunk = new Uint8Array(oneKB).fill(charset.LATIN_SMALL_LETTER_A);
    chunk[0] = charset.QUOTATION_MARK;
    chunk[chunk.length - 1] = charset.QUOTATION_MARK;
    const commaChunk = new Uint8Array([charset.COMMA]);

    let maxParentLength = 0;

    forceGC();
    const heapBefore = process.memoryUsage().heapUsed;

    await runJSONParserTest(
      new JSONParser({
        paths: ["$.*"],
        keepStack: false,
        stringBufferSize: oneKB,
      }),
      function* () {
        yield new Uint8Array([charset.LEFT_SQUARE_BRACKET]);
        // decreasing so the number doesn't need to be reallocated
        for (let index = kbsIn200MBs; index > 0; index--) {
          yield chunk;
          yield commaChunk;
        }
        yield chunk;
        yield new Uint8Array([charset.RIGHT_SQUARE_BRACKET]);
      },
      ({ parent }) => {
        if (Array.isArray(parent)) {
          maxParentLength = Math.max(maxParentLength, parent.length);
        }
      },
    );

    forceGC();
    const retainedMBs = (process.memoryUsage().heapUsed - heapBefore) / oneMB;

    // Primary, GC-independent signal: with keepStack:false each emitted element
    // is dropped from its parent array right after emission, so the parent never
    // accumulates. (This is a mid-parse peak that's released by the end, which
    // is why the deterministic parent check -- not the heap check below -- is
    // what guards the drop.)
    expect(maxParentLength).toBeLessThanOrEqual(1);
    // Broad safety net for any *persistent* leak (e.g. a string buffer that
    // stops resetting, or internal accumulation the parser holds past the end):
    // after forcing GC, live heap growth is a fraction of a MB, nowhere near the
    // 200MB parsed. Forcing GC first is what makes this reliable rather than
    // flaky on GC timing.
    expect(retainedMBs).toBeLessThan(50);
  });

  test(`should not take quadratically longer to parse a large flat array with keepStack === false`, async () => {
    const elementCount = 50_000;
    const items: string[] = [];
    for (let index = 0; index < elementCount; index++) {
      items.push(`{"id":${index}}`);
    }
    const json = `[${items.join(",")}]`;

    let maxParentLength = 0;
    const start = Date.now();
    await runJSONParserTest(
      new JSONParser({ paths: ["$.*"], keepStack: false }),
      [json],
      ({ parent }) => {
        if (Array.isArray(parent)) {
          maxParentLength = Math.max(maxParentLength, parent.length);
        }
      },
    );
    const elapsed = Date.now() - start;

    // `parent` is the top-level array as it's built. With keepStack:false,
    // each already-emitted element should be dropped (not just hidden),
    // otherwise `parent` keeps every prior slot forever and cloning/reading
    // it on each subsequent event costs O(current length) instead of O(1):
    // quadratic total for a flat n-element array. 50k elements comfortably
    // finishing in under a couple seconds -- rather than the tens of
    // seconds a quadratic regression here would take -- is a reliable
    // signal on its own, without depending on GC/heap-timing the way an
    // absolute memory threshold would.
    expect(maxParentLength).toBeLessThanOrEqual(1);
    expect(elapsed).toBeLessThan(3000);
  });

  test(`should not take quadratically longer to emit partial tokens for a large string streamed in small chunks`, () => {
    const totalChars = 200_000;
    const bytes = new TextEncoder().encode(
      quote + "a".repeat(totalChars) + quote,
    );

    function parseMs(chunkSize: number): number {
      const parser = new JSONParser({
        emitPartialTokens: true,
        emitPartialValues: true,
      });
      let finalLength = -1;
      parser.onValue = ({ value, partial }) => {
        if (!partial && typeof value === "string") finalLength = value.length;
      };
      const start = Date.now();
      for (let index = 0; index < bytes.length; index += chunkSize) {
        parser.write(
          bytes.subarray(index, Math.min(index + chunkSize, bytes.length)),
        );
      }
      if (!parser.isEnded) parser.end();
      expect(finalLength).toEqual(totalChars);
      return Date.now() - start;
    }

    // Warm up both paths so the JIT state is comparable.
    parseMs(bytes.length);
    parseMs(64);

    // The single-chunk parse emits one partial (at the end) and is O(n) on any
    // implementation. The 64-byte-chunk parse emits a partial per chunk; if
    // each partial rebuilds the whole accumulated string via toString(), those
    // rebuilds are O(n^2) and this parse is hundreds of times slower. Comparing
    // both on the same machine is self-calibrating -- measured ~1.3x when the
    // builder folds incrementally vs ~335x when it re-joins every time -- so the
    // 25x bound (plus a small absolute floor for the sub-millisecond baseline)
    // catches a quadratic regression with a wide margin without depending on any
    // absolute machine speed. Best-of-3 sheds GC/scheduling noise.
    const single = Math.min(
      parseMs(bytes.length),
      parseMs(bytes.length),
      parseMs(bytes.length),
    );
    const many = Math.min(parseMs(64), parseMs(64), parseMs(64));

    expect(many).toBeLessThan(single * 25 + 50);
  });

  test(`should match selectors in time independent of the number of configured paths`, () => {
    const items: string[] = [];
    for (let record = 0; record < 20000; record++) {
      const fields: string[] = [];
      for (let f = 0; f < 5; f++) fields.push(`"f${f}":${record * 10 + f}`);
      items.push(`{${fields.join(",")}}`);
    }
    const bytes = new TextEncoder().encode(`[${items.join(",")}]`);

    function parseMs(paths: string[]): number {
      const parser = new JSONParser({ paths });
      parser.onValue = () => {
        /* matching runs per value regardless of what the callback does */
      };
      const start = Date.now();
      parser.write(bytes);
      if (!parser.isEnded) parser.end();
      return Date.now() - start;
    }

    const few = ["$.0.f0"];
    const many = Array.from({ length: 500 }, (_, i) => `$.${i}.f0`);

    parseMs(few);
    parseMs(many); // warm up

    // shouldEmit() runs on every value. Rescanning the configured selectors made
    // matching O(number of selectors) per value, so 500 paths took ~13x as long
    // as 1 (measured ~569ms vs ~44ms). Compiling selectors into a trie makes
    // matching O(depth) regardless of path count, so the two are ~equal.
    // Comparing them on the same machine self-calibrates; the 4x bound (plus a
    // small floor for the sub-millisecond baseline) catches a return to per-value
    // rescanning with a wide margin. Best-of-3 sheds noise.
    const fewMs = Math.min(parseMs(few), parseMs(few), parseMs(few));
    const manyMs = Math.min(parseMs(many), parseMs(many), parseMs(many));

    expect(manyMs).toBeLessThan(fewMs * 4 + 50);
  });

  test(`should keep memory stable if keepStack === false on object`, async () => {
    const chunk = new Uint8Array(oneKB).fill(charset.LATIN_SMALL_LETTER_A);
    chunk[0] = charset.QUOTATION_MARK;
    chunk[1] = charset.LATIN_SMALL_LETTER_A;
    chunk[2] = charset.QUOTATION_MARK;
    chunk[3] = charset.COLON;
    chunk[4] = charset.QUOTATION_MARK;
    chunk[chunk.length - 1] = charset.QUOTATION_MARK;
    const commaChunk = new Uint8Array([charset.COMMA]);

    let maxParentKeys = 0;

    forceGC();
    const heapBefore = process.memoryUsage().heapUsed;

    await runJSONParserTest(
      new JSONParser({
        paths: ["$.*"],
        keepStack: false,
        stringBufferSize: oneKB,
      }),
      function* () {
        yield new Uint8Array([charset.LEFT_CURLY_BRACKET]);
        // decreasing so the number doesn't need to be reallocated
        for (let index = kbsIn200MBs; index > 0; index--) {
          yield chunk;
          yield commaChunk;
        }
        yield chunk;
        yield new Uint8Array([charset.RIGHT_CURLY_BRACKET]);
      },
      ({ parent }) => {
        if (parent && typeof parent === "object" && !Array.isArray(parent)) {
          maxParentKeys = Math.max(maxParentKeys, Object.keys(parent).length);
        }
      },
    );

    forceGC();
    const retainedMBs = (process.memoryUsage().heapUsed - heapBefore) / oneMB;

    // Primary, GC-independent signal: keepStack:false deletes each emitted
    // member from its parent object right after emission, so the parent never
    // accumulates.
    expect(maxParentKeys).toBeLessThanOrEqual(1);
    // Broad safety net for any persistent leak, made reliable by forcing GC
    // before sampling (see the array test above for the rationale).
    expect(retainedMBs).toBeLessThan(50);
  });
});

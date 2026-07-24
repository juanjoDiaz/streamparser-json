import * as v8 from "v8";
import * as vm from "vm";
import { runJSONParserTest } from "./utils/testRunner.js";
import JSONParser from "../src/jsonparser.js";
import { charset } from "@streamparser/json/utils/utf-8.js";

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
  test("streaming a large array with the default keepStack:true stays fast when parent is not read", async () => {
    // With keepStack:true the parser's containers are append-only, so the
    // adapter snapshots each event's `parent`/`stack` lazily. A consumer that
    // only reads `value` (the overwhelmingly common `paths:["$.*"]` case) then
    // never forces those snapshots, so the per-event cost stays O(1) and the
    // whole parse is linear. Cloning them eagerly instead made every one of
    // the N events copy the whole growing array -- O(N^2), tens of seconds (or
    // an out-of-memory crash) at this size.
    const elementCount = 100_000;
    const items: string[] = [];
    for (let index = 0; index < elementCount; index++) {
      items.push(`{"id":${index}}`);
    }
    const json = `[${items.join(",")}]`;

    let seen = 0;
    const start = Date.now();
    await runJSONParserTest(
      new JSONParser({ paths: ["$.*"] }),
      [json],
      ({ value }) => {
        void value;
        seen++;
      },
    );
    const elapsed = Date.now() - start;

    expect(seen).toBe(elementCount);
    // Lazy keeps this linear -- ~5s at this size through the TransformStream
    // plumbing, whose per-event constant is much higher than the Node
    // Transform's (async read loop + a microtask per element). Eager cloning is
    // quadratic: cloning a growing 100k-element array on each of 100k events is
    // ~10^10 ops -- minutes, or an out-of-memory crash. So a generous bound well
    // above the linear constant still reliably separates the two.
    expect(elapsed).toBeLessThan(20000);
  });

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

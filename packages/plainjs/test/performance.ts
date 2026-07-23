import { runJSONParserTest } from "./utils/testRunner.js";
import JSONParser from "../src/jsonparser.js";
import { charset } from "../src/utils/utf-8.js";

const quote = String.fromCharCode(charset.QUOTATION_MARK);

const oneKB = 1024;
const oneMB = 1024 * oneKB;
const twoHundredMB = 200 * oneMB;
const kbsIn200MBs = twoHundredMB / oneKB;

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

    const intialMemoryUsage = process.memoryUsage().heapUsed;
    const thirtyMBs = 20 * 1024 * 1024;
    let valuesLeft = kbsIn200MBs;

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
      () => {
        if (valuesLeft-- % oneKB !== 0) return;

        const actualMemoryUsage = process.memoryUsage().heapUsed;
        expect(actualMemoryUsage - intialMemoryUsage < thirtyMBs).toBeTruthy();
      },
    );
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

  test(`should keep memory stable if keepStack === false on object`, async () => {
    const chunk = new Uint8Array(oneKB).fill(charset.LATIN_SMALL_LETTER_A);
    chunk[0] = charset.QUOTATION_MARK;
    chunk[1] = charset.LATIN_SMALL_LETTER_A;
    chunk[2] = charset.QUOTATION_MARK;
    chunk[3] = charset.COLON;
    chunk[4] = charset.QUOTATION_MARK;
    chunk[chunk.length - 1] = charset.QUOTATION_MARK;
    const commaChunk = new Uint8Array([charset.COMMA]);

    const intialMemoryUsage = process.memoryUsage().heapUsed;
    const thirtyMBs = 20 * 1024 * 1024;
    let valuesLeft = kbsIn200MBs;

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
      () => {
        if (valuesLeft-- % oneKB !== 0) return;

        const actualMemoryUsage = process.memoryUsage().heapUsed;
        expect(actualMemoryUsage - intialMemoryUsage < thirtyMBs).toBeTruthy();
      },
    );
  });
});

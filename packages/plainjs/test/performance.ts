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

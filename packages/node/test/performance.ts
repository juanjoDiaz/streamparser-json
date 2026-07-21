import { runJSONParserTest } from "./utils/testRunner.js";
import JSONParser from "../src/jsonparser.js";
import { charset } from "@streamparser/json/utils/utf-8.js";

const quote = String.fromCharCode(charset.QUOTATION_MARK);

const oneKB = 1024;
const oneMB = 1024 * oneKB;
const twoHundredMB = 200 * oneMB;
const kbsIn200MBs = twoHundredMB / oneKB;

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
    // Lazy keeps this well under a second; eager cloning is quadratic and takes
    // many seconds at this size, so a generous bound reliably separates them.
    expect(elapsed).toBeLessThan(3000);
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

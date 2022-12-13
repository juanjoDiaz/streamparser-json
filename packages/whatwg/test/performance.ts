// Commented out due to timing
test("", () => {
  /* Do nothing */
});
// import { runJSONParserTest } from "./utils/testRunner.js";
// import JSONParser from "../src/jsonparser.js";
// import { charset } from "@streamparser/json/utils/utf-8.js";
// const {
//   LATIN_SMALL_LETTER_A,
//   QUOTATION_MARK,
//   DIGIT_ONE,
//   LEFT_SQUARE_BRACKET,
//   RIGHT_SQUARE_BRACKET,
//   LEFT_CURLY_BRACKET,
//   RIGHT_CURLY_BRACKET,
//   COMMA,
//   COLON,
// } = charset;

// const quote = String.fromCharCode(QUOTATION_MARK);

// const oneKB = 1024;
// const oneMB = 1024 * oneKB;
// const twoHundredMB = 200 * oneMB;
// const kbsIn200MBs = twoHundredMB / oneKB;

// describe("buffered parsing", () => {
//   test("can handle large strings without running out of memory", async () => {
//     await runJSONParserTest(
//       new JSONParser({ stringBufferSize: 64 * 1024 }),
//       function* () {
//         const chunk = new Uint8Array(oneKB).fill(LATIN_SMALL_LETTER_A);
//         yield quote;
//         for (let index = 0; index < kbsIn200MBs; index++) {
//           yield chunk;
//         }
//         yield quote;
//       },
//       ({ value }) => expect((value as string).length).toEqual(twoHundredMB),
//     );
//   });

//   test("can handle large numbers without running out of memory", async () => {
//     const jsonParser = new JSONParser({ numberBufferSize: 64 * 1024 });
//     await runJSONParserTest(
//       jsonParser,
//       function* () {
//         const chunk = new Uint8Array(oneKB).fill(DIGIT_ONE);
//         yield "1.";
//         for (let index = 0; index < kbsIn200MBs; index++) {
//           yield chunk;
//         }
//       },
//       ({ value }) => expect(value).toEqual(1.1111111111111112),
//     );
//   });
// });

// test(`should keep memory stable if keepStack === false on array`, async() => {
//   const chunk = new Uint8Array(oneKB).fill(LATIN_SMALL_LETTER_A);
//   chunk[0] = QUOTATION_MARK;
//   chunk[chunk.length - 1] = QUOTATION_MARK;
//   const commaChunk = new Uint8Array([COMMA]);

//   const intialMemoryUsage = process.memoryUsage().heapUsed;
//   const thirtyMBs = 20 * 1024 * 1024;
//   let valuesLeft = kbsIn200MBs;

//   await runJSONParserTest(
//     new JSONParser({
//       paths: ["$.*"],
//       keepStack: false,
//       stringBufferSize: oneKB,
//     }),
//     function* () {
//       yield new Uint8Array([LEFT_SQUARE_BRACKET]);
//       // decreasing so the number doesn't need to be reallocated
//       for (let index = kbsIn200MBs; index > 0; index--) {
//         yield chunk;
//         yield commaChunk;
//       }
//       yield chunk;
//       yield new Uint8Array([RIGHT_SQUARE_BRACKET]);
//     },
//     () => {
//       if (valuesLeft-- % oneKB !== 0) return;

//       const actualMemoryUsage = process.memoryUsage().heapUsed;
//       expect(actualMemoryUsage - intialMemoryUsage < thirtyMBs).toBeTruthy();
//     },
//   );
// });

// test(`should keep memory stable if keepStack === false on object`, async () => {
//   const chunk = new Uint8Array(oneKB).fill(LATIN_SMALL_LETTER_A);
//   chunk[0] = QUOTATION_MARK;
//   chunk[1] = LATIN_SMALL_LETTER_A;
//   chunk[2] = QUOTATION_MARK;
//   chunk[3] = COLON;
//   chunk[4] = QUOTATION_MARK;
//   chunk[chunk.length - 1] = QUOTATION_MARK;
//   const commaChunk = new Uint8Array([COMMA]);

//   const intialMemoryUsage = process.memoryUsage().heapUsed;
//   const thirtyMBs = 20 * 1024 * 1024;
//   let valuesLeft = kbsIn200MBs;

//   await runJSONParserTest(
//     new JSONParser({
//       paths: ["$.*"],
//       keepStack: false,
//       stringBufferSize: oneKB,
//     }),
//     function* () {
//       yield new Uint8Array([LEFT_CURLY_BRACKET]);
//       // decreasing so the number doesn't need to be reallocated
//       for (let index = kbsIn200MBs; index > 0; index--) {
//         yield chunk;
//         yield commaChunk;
//       }
//       yield chunk;
//       yield new Uint8Array([RIGHT_CURLY_BRACKET]);
//     },
//     () => {
//       if (valuesLeft-- % oneKB !== 0) return;

//       const actualMemoryUsage = process.memoryUsage().heapUsed;
//       expect(actualMemoryUsage - intialMemoryUsage < thirtyMBs).toBeTruthy();
//     },
//   );
// });

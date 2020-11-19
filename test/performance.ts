import tap from "tap";
import JSONParser from "../src/jsonparser";
import { charset } from "../src/utils/utf-8";

const { test } = tap;
const {
  LATIN_SMALL_LETTER_A,
  QUOTATION_MARK,
  DIGIT_ONE,
  LEFT_SQUARE_BRACKET,
  RIGHT_SQUARE_BRACKET,
  LEFT_CURLY_BRACKET,
  RIGHT_CURLY_BRACKET,
  COMMA,
  COLON,
} = charset;

const quote = String.fromCharCode(QUOTATION_MARK);

const oneKB = 1024;
const oneMB = 1024 * oneKB;
const twoHundredMB = 200 * oneMB;
const kbsIn200MBs = twoHundredMB / oneKB;

test("buffered parsing", (t) => {
  t.plan(3);

  t.test("can handle large strings without running out of memory", (t) => {
    t.plan(1);

    const chunk = new Uint8Array(oneKB).fill(LATIN_SMALL_LETTER_A);

    const p = new JSONParser({ stringBufferSize: 64 * 1024 });
    p.onToken = (type, value) =>
      t.equal(
        (value as string).length,
        twoHundredMB,
        "token should be size of input json"
      );

    p.write(quote);
    for (let index = 0; index < kbsIn200MBs; index++) {
      p.write(chunk);
    }
    p.write(quote);
  });

  t.test("can handle large numbers without running out of memory", (t) => {
    t.plan(1);

    const chunk = new Uint8Array(oneKB).fill(DIGIT_ONE);

    const p = new JSONParser({ numberBufferSize: 64 * 1024 });
    p.onToken = (type, value) =>
      t.equal(value, 1.1111111111111112, "token should be correct");

    p.write("1.");
    for (let index = 0; index < kbsIn200MBs; index++) {
      p.write(chunk);
    }
    p.end();
  });

  t.test("can handle multi-byte unicode splits", (t) => {
    t.plan(1);

    const p = new JSONParser({ stringBufferSize: 1 });
    p.onToken = (type, value) => t.equal(value, "𠜎");

    p.write('"𠜎"');
  });
});

test(`should keep memory stable if keepStack === false on array`, {}, (t) => {
  t.plan(201);

  const chunk = new Uint8Array(oneKB).fill(LATIN_SMALL_LETTER_A);
  chunk[0] = QUOTATION_MARK;
  chunk[chunk.length - 1] = QUOTATION_MARK;
  const commaChunk = new Uint8Array([COMMA]);

  const thirtyMBs = 20 * 1024 * 1024;
  let valuesLeft = kbsIn200MBs;

  const p = new JSONParser({
    paths: ["$.*"],
    keepStack: false,
    stringBufferSize: oneKB,
  });
  p.onValue = () => {
    if (valuesLeft-- % oneKB !== 0) return;

    const actualMemoryUsage = process.memoryUsage().heapUsed;
    t.ok(
      actualMemoryUsage - intialMemoryUsage < thirtyMBs,
      `${actualMemoryUsage} is significantly larger than ${intialMemoryUsage}`
    );
  };

  const intialMemoryUsage = process.memoryUsage().heapUsed;

  p.write(new Uint8Array([LEFT_SQUARE_BRACKET]));
  // decreasing so the number doesn't need to be reallocated
  for (let index = kbsIn200MBs; index > 0; index--) {
    p.write(chunk);
    p.write(commaChunk);
  }
  p.write(chunk);
  p.write(new Uint8Array([RIGHT_SQUARE_BRACKET]));
});

test(`should keep memory stable if keepStack === false on object`, {}, (t) => {
  t.plan(201);

  const chunk = new Uint8Array(oneKB).fill(LATIN_SMALL_LETTER_A);
  chunk[0] = QUOTATION_MARK;
  chunk[1] = LATIN_SMALL_LETTER_A;
  chunk[2] = QUOTATION_MARK;
  chunk[3] = COLON;
  chunk[4] = QUOTATION_MARK;
  chunk[chunk.length - 1] = QUOTATION_MARK;
  const commaChunk = new Uint8Array([COMMA]);

  const thirtyMBs = 20 * 1024 * 1024;
  let valuesLeft = kbsIn200MBs;

  const p = new JSONParser({
    paths: ["$.*"],
    keepStack: false,
    stringBufferSize: oneKB,
  });
  p.onValue = () => {
    if (valuesLeft-- % oneKB !== 0) return;

    const actualMemoryUsage = process.memoryUsage().heapUsed;
    t.ok(
      actualMemoryUsage - intialMemoryUsage < thirtyMBs,
      `${actualMemoryUsage} is significantly larger than ${intialMemoryUsage}`
    );
  };

  const intialMemoryUsage = process.memoryUsage().heapUsed;
  p.write(new Uint8Array([LEFT_CURLY_BRACKET]));
  // decreasing so the number doesn't need to be reallocated
  for (let index = kbsIn200MBs; index > 0; index--) {
    p.write(chunk);
    p.write(commaChunk);
  }
  p.write(chunk);
  p.write(new Uint8Array([RIGHT_CURLY_BRACKET]));
});

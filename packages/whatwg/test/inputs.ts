import { runJSONParserTest, type TestData } from "./utils/testRunner.js";
import JSONParser from "../src/jsonparser.js";
import { charset } from "@streamparser/json/utils/utf-8.js";

const quote = String.fromCharCode(charset.QUOTATION_MARK);

describe("inputs", () => {
  const testData: TestData[] = [
    {
      value: "test",
      expected: ["test"],
    },
    {
      value: new Uint8Array([116, 101, 115, 116]),
      expected: ["test"],
    },
    {
      value: new Uint16Array([25972, 29811]),
      expected: ["test"],
    },
    {
      value: new Uint32Array([1953719668]),
      expected: ["test"],
    },
    {
      value: [116, 101, 115, 116],
      expected: ["test"],
    },
  ];

  testData.forEach(({ value, expected: [expected] }) => {
    test(`write accept ${value}`, async () => {
      await runJSONParserTest(
        new JSONParser(),
        [quote, value, quote],
        ({ value }) => expect(value).toEqual(expected),
      );
    });
  });

  // write()'s public signature is `Iterable<number> | string`, not just
  // Array/TypedArray/string -- any iterable of numbers must be accepted.
  test("write accept a Set<number>", async () => {
    // Distinct char codes: a Set would silently dedupe a repeated one.
    const codes = new Set([102, 108, 97, 103]); // "flag"
    await runJSONParserTest(
      new JSONParser(),
      [quote, codes, quote],
      ({ value }) => expect(value).toEqual("flag"),
    );
  });

  test("write accept a generator yielding numbers", async () => {
    function* gen() {
      yield 116;
      yield 101;
      yield 115;
      yield 116;
    }
    await runJSONParserTest(
      new JSONParser(),
      [quote, gen(), quote],
      ({ value }) => expect(value).toEqual("test"),
    );
  });

  test("write accept a Map values() iterator", async () => {
    const values = new Map([
      [0, 116],
      [1, 101],
      [2, 115],
      [3, 116],
    ]).values();
    await runJSONParserTest(
      new JSONParser(),
      [quote, values, quote],
      ({ value }) => expect(value).toEqual("test"),
    );
  });

  test("write throw on invalid type", async () => {
    try {
      await runJSONParserTest(
        new JSONParser(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [745674 as any],
      );
      fail("Expected to fail!");
    } catch {
      // Expected error
    }
  });
});

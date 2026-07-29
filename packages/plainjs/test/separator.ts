import JSONParser from "../src/jsonparser.js";
import TokenParser from "../src/tokenparser.js";
import TokenType from "../src/utils/types/tokenType.js";
import {
  runJSONParserTest,
  runTokenParserTest,
  type TestData,
} from "./utils/testRunner.js";

describe("separator", () => {
  const testData: TestData[] = [
    { value: "true", expected: [true] },
    { value: "false", expected: [false] },
    { value: "null", expected: [null] },
    { value: '"string"', expected: ["string"] },
    { value: "[1,2,3]", expected: [1, 2, 3, [1, 2, 3]] },
    {
      value: '{ "a": 0, "b": 1, "c": -1 }',
      expected: [0, 1, -1, { a: 0, b: 1, c: -1 }],
    },
  ];

  const expected = testData
    .map(({ expected }) => expected)
    // biome-ignore lint/performance/noAccumulatingSpread: test fixture setup, not a hot path
    .reduce((acc, val) => [...acc, ...val], []);

  const separators = ["", "\n", "\t\n", "abc", "SEPARATOR"];
  separators.forEach((separator) => {
    test(`separator: "${separator}"`, async () => {
      let i = 0;

      await runJSONParserTest(
        new JSONParser({ separator }),
        testData.flatMap(({ value }) => [value, separator]),
        ({ value }) => {
          expect(value).toEqual(expected[i]);
          i += 1;
        },
      );
    });
  });

  test("support multiple whitespace separators", async () => {
    let i = 0;
    const value = "1 2\t3\n4\n\r5 \n6\n\n7\n\r\n\r8 \t\n\n\r9";
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const separator = "";

    await runJSONParserTest(
      new JSONParser({ separator }),
      value,
      ({ value }) => {
        expect(value).toEqual(expected[i]);
        i += 1;
      },
    );
  });

  test(`separator: fail on invalid value`, async () => {
    try {
      await runJSONParserTest(new JSONParser({ separator: "abc" }), ["abe"]);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toEqual(
        'Unexpected "e" at chunk position "2" (absolute position "2") in state SEPARATOR',
      );
    }
  });

  test(`fail on invalid token type`, async () => {
    expect.assertions(2);
    try {
      await runTokenParserTest(new TokenParser({ separator: "\n" }), [
        { token: TokenType.TRUE, value: true },
        { token: TokenType.TRUE, value: true },
      ]);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toEqual(
        "Unexpected TRUE (true) in state SEPARATOR",
      );
    }
  });

  test("fail on invalid value passed to TokenParser", async () => {
    expect.assertions(2);
    try {
      await runTokenParserTest(new TokenParser({ separator: "\n" }), [
        { token: TokenType.TRUE, value: true },
        { token: TokenType.SEPARATOR, value: "\r\n" },
      ]);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toEqual(
        'Unexpected SEPARATOR ("\\r\\n") in state SEPARATOR',
      );
    }
  });

  test("fail when the stream ends mid-way through a multi-byte separator", async () => {
    let didThrow = false;
    try {
      // "\r\n" separator, but the input ends right after the "\r", missing
      // the "\n" -- this must not be mistaken for a clean end of stream.
      await runJSONParserTest(new JSONParser({ separator: "\r\n" }), [
        "{}",
        "\r",
      ]);
    } catch {
      didThrow = true;
    }
    expect(didThrow).toEqual(true);
  });

  test("fail when the stream ends after only part of a longer multi-byte separator", async () => {
    let didThrow = false;
    try {
      await runJSONParserTest(new JSONParser({ separator: "<->" }), [
        "{}",
        "<-",
      ]);
    } catch {
      didThrow = true;
    }
    expect(didThrow).toEqual(true);
  });

  test("not fail when whitespaces match separator", async () => {
    let i = 0;
    const value = `{
      "a": 0,
      "b": 1,
      "c": -1
    }`;
    const expected = [0, 1, -1, { a: 0, b: 1, c: -1 }];
    const separator = "\n";

    await runJSONParserTest(
      new JSONParser({ separator }),
      value,
      ({ value }) => {
        expect(value).toEqual(expected[i]);
        i += 1;
      },
    );
  });
});

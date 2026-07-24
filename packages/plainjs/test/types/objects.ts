import { runJSONParserTest, type TestData } from "../utils/testRunner.js";
import { readFileSync } from "fs";
import JSONParser from "../../src/jsonparser.js";

describe("objects", () => {
  const testData: TestData[] = [
    { value: "{}", expected: [[[], {}]] },
    {
      value: '{ "a": 0, "b": 1, "c": -1 }',
      expected: [
        [["a"], 0],
        [["b"], 1],
        [["c"], -1],
        [[], { a: 0, b: 1, c: -1 }],
      ],
    },
    {
      value: '{ "a": 1.0, "b": 1.1, "c": -1.1, "d": -1.0 }',
      expected: [
        [["a"], 1],
        [["b"], 1.1],
        [["c"], -1.1],
        [["d"], -1],
        [[], { a: 1, b: 1.1, c: -1.1, d: -1 }],
      ],
    },
    {
      value: '{ "e": -1 }',
      expected: [
        [["e"], -1],
        [[], { e: -1 }],
      ],
    },
    {
      value: '{ "f": -0.1 }',
      expected: [
        [["f"], -0.1],
        [[], { f: -0.1 }],
      ],
    },
    {
      value: '{ "a": 6.02e23, "b": 6.02e+23, "c": 6.02e-23, "d": 0e23 }',
      expected: [
        [["a"], 6.02e23],
        [["b"], 6.02e23],
        [["c"], 6.02e-23],
        [["d"], 0e23],
        [[], { a: 6.02e23, b: 6.02e23, c: 6.02e-23, d: 0e23 }],
      ],
    },
    {
      value: '{ "a": 7161093205057351174 }',
      expected: [
        [["a"], 7161093205057352000],
        [[], { a: 7161093205057352000 }],
      ],
    },
  ];

  testData.forEach(({ value, expected }) => {
    test(value as string, async () => {
      let i = 0;

      await runJSONParserTest(
        new JSONParser(),
        [value],
        ({ value, key, stack }) => {
          const keys = stack
            .slice(1)
            .map((item) => item.key)
            .concat(key !== undefined ? key : []);

          expect([keys, value]).toEqual(expected[i]);
          i += 1;
        },
      );
    });

    test("chuncked", async () => {
      let i = 0;

      await runJSONParserTest(
        new JSONParser(),
        (value as string).split(""),
        ({ value, key, stack }) => {
          const keys = stack
            .slice(1)
            .map((item) => item.key)
            .concat(key !== undefined ? key : []);

          expect([keys, value]).toEqual(expected[i]);
          i += 1;
        },
      );
    });
  });

  test("complex object", async () => {
    const stringifiedJson = readFileSync(
      `${__dirname}/../../../../samplejson/basic.json`,
    ).toString();

    await runJSONParserTest(
      new JSONParser(),
      [stringifiedJson],
      ({ value, stack }) => {
        if (stack.length === 0) {
          expect(value).toEqual(JSON.parse(stringifiedJson));
        }
      },
    );
  });

  const invalidValues = [
    "{,",
    '{"test": eer[ }',
    "{ test: 1 }",
    '{ "test": 1 ;',
    '{ "test": 1 ]',
    '{ "test": 1, }',
    '{ "test", }',
  ];

  invalidValues.forEach((value) => {
    test(`fail on invalid values: ${value}`, async () => {
      expect.assertions(1);
      try {
        await runJSONParserTest(new JSONParser(), [value]);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });

  describe("prototype pollution", () => {
    test("a __proto__ key becomes an own property instead of altering the prototype", async () => {
      await runJSONParserTest(
        new JSONParser(),
        ['{"__proto__":{"isAdmin":true}}'],
        ({ value, stack }) => {
          if (stack.length !== 0) return;

          expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
          expect(Object.prototype.hasOwnProperty.call(value, "__proto__")).toBe(
            true,
          );
          expect((value as { isAdmin?: boolean }).isAdmin).toBeUndefined();
          expect(value).toEqual(JSON.parse('{"__proto__":{"isAdmin":true}}'));
        },
      );
    });

    test("a nested __proto__ key becomes an own property instead of altering the prototype", async () => {
      await runJSONParserTest(
        new JSONParser(),
        ['{"a":{"__proto__":{"isAdmin":true}}}'],
        ({ value, stack }) => {
          if (stack.length !== 0) return;

          const nested = (value as { a: object }).a;
          expect(Object.getPrototypeOf(nested)).toBe(Object.prototype);
          expect(
            Object.prototype.hasOwnProperty.call(nested, "__proto__"),
          ).toBe(true);
        },
      );
    });
  });
});

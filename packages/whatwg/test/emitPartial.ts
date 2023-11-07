import TokenType from "@streamparser/json/utils/types/tokenType.js";
import JSONParser from "../src/jsonparser.js";
import Tokenizer from "../src/tokenizer.js";
import {
  TestData,
  runJSONParserTest,
  runTokenizerTest,
} from "./utils/testRunner.js";

describe("Emit Partial", () => {
  describe("Tokenizer emit partial tokens", () => {
    const emitPartialTokenTestData: TestData[] = [
      {
        value: ["tr", "ue"],
        expected: [
          { token: TokenType.TRUE, value: true, partial: true },
          { token: TokenType.TRUE, value: true, partial: false },
        ],
      },
      {
        value: ["t", "ru", "e"],
        expected: [
          { token: TokenType.TRUE, value: true, partial: true },
          { token: TokenType.TRUE, value: true, partial: true },
          { token: TokenType.TRUE, value: true, partial: false },
        ],
      },
      {
        value: ["f", "al", "se"],
        expected: [
          { token: TokenType.FALSE, value: false, partial: true },
          { token: TokenType.FALSE, value: false, partial: true },
          { token: TokenType.FALSE, value: false, partial: false },
        ],
      },
      {
        value: ["fal", "se"],
        expected: [
          { token: TokenType.FALSE, value: false, partial: true },
          { token: TokenType.FALSE, value: false, partial: false },
        ],
      },
      {
        value: ["0", ".", "123"],
        expected: [
          { token: TokenType.NUMBER, value: 0, partial: true },
          { token: TokenType.NUMBER, value: 0.123, partial: true },
          { token: TokenType.NUMBER, value: 0.123, partial: false },
        ],
      },
      {
        value: ["n", "u", "l", "l"],
        expected: [
          { token: TokenType.NULL, value: null, partial: true },
          { token: TokenType.NULL, value: null, partial: true },
          { token: TokenType.NULL, value: null, partial: true },
          { token: TokenType.NULL, value: null, partial: false },
        ],
      },
      {
        value: ["n", "u", "l", "l"],
        expected: [
          { token: TokenType.NULL, value: null, partial: true },
          { token: TokenType.NULL, value: null, partial: true },
          { token: TokenType.NULL, value: null, partial: true },
          { token: TokenType.NULL, value: null, partial: false },
        ],
      },
      {
        value: "{",
        expected: [{ token: TokenType.LEFT_BRACE, value: "{", partial: false }],
      },
      {
        value: ['{ "fo', "o", '"', ': "', '"'],
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "fo", partial: true },
          { token: TokenType.STRING, value: "foo", partial: true },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "", partial: true },
          { token: TokenType.STRING, value: "", partial: false },
        ],
      },
      {
        value: ['{ "foo": "ba', "r", '"'],
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "ba", partial: true },
          { token: TokenType.STRING, value: "bar", partial: true },
          { token: TokenType.STRING, value: "bar", partial: false },
        ],
      },
      {
        value: ['{ "foo": "bar"', "}"],
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.RIGHT_BRACE, value: "}", partial: false },
        ],
      },
      {
        value: '{ "foo": "bar" }',
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.RIGHT_BRACE, value: "}", partial: false },
        ],
      },
      {
        value: [
          '{ "foo": "bar", "ba',
          "z",
          '": [',
          '{ "foo": "bar", "baz": [',
          '{ "foo": "bar", "baz": [1',
          "2",
          "3, ",
        ],
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
          { token: TokenType.STRING, value: "ba", partial: true },
          { token: TokenType.STRING, value: "baz", partial: true },
          { token: TokenType.STRING, value: "baz", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.LEFT_BRACKET, value: "[", partial: false },
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
          { token: TokenType.STRING, value: "baz", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.LEFT_BRACKET, value: "[", partial: false },
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
          { token: TokenType.STRING, value: "baz", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.LEFT_BRACKET, value: "[", partial: false },
          { token: TokenType.NUMBER, value: 1, partial: true },
          { token: TokenType.NUMBER, value: 12, partial: true },
          { token: TokenType.NUMBER, value: 123, partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
        ],
      },
      {
        value: '{ "foo": "bar", "baz": [1]',
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
          { token: TokenType.STRING, value: "baz", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.LEFT_BRACKET, value: "[", partial: false },
          { token: TokenType.NUMBER, value: 1, partial: false },
          { token: TokenType.RIGHT_BRACKET, value: "]", partial: false },
        ],
      },
      {
        value: ['{ "foo": "bar", ', ' "baz": [1,'],
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
          { token: TokenType.STRING, value: "baz", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.LEFT_BRACKET, value: "[", partial: false },
          { token: TokenType.NUMBER, value: 1, partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
        ],
      },
      {
        value: ['{ "foo": "bar", "baz": [1,2', "3, 4", "5", "6]   }"],
        expected: [
          {
            type: "complete",
            token: TokenType.LEFT_BRACE,
            value: "{",
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.STRING,
            value: "foo",
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.COLON,
            value: ":",
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.STRING,
            value: "bar",
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.COMMA,
            value: ",",
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.STRING,
            value: "baz",
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.COLON,
            value: ":",
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.LEFT_BRACKET,
            value: "[",
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.NUMBER,
            value: 1,
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.COMMA,
            value: ",",
            partial: false,
          },
          { token: TokenType.NUMBER, value: 2, partial: true },
          {
            type: "complete",
            token: TokenType.NUMBER,
            value: 23,
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.COMMA,
            value: ",",
            partial: false,
          },
          { token: TokenType.NUMBER, value: 4, partial: true },
          { token: TokenType.NUMBER, value: 45, partial: true },
          {
            type: "complete",
            token: TokenType.NUMBER,
            value: 456,
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.RIGHT_BRACKET,
            value: "]",
            partial: false,
          },
          {
            type: "complete",
            token: TokenType.RIGHT_BRACE,
            value: "}",
            partial: false,
          },
        ],
      },
      {
        value: ['{ "foo": "bar", "baz"', ": [{"],
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
          { token: TokenType.STRING, value: "baz", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.LEFT_BRACKET, value: "[", partial: false },
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
        ],
      },
      {
        value: ['{ "foo": "bar", "baz": [{ "a', '"'],
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
          { token: TokenType.STRING, value: "baz", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.LEFT_BRACKET, value: "[", partial: false },
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "a", partial: true },
          { token: TokenType.STRING, value: "a", partial: false },
        ],
      },
      {
        value: ['{ "foo": "bar", "baz": [{ "a": "b', '"'],
        expected: [
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "foo", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "bar", partial: false },
          { token: TokenType.COMMA, value: ",", partial: false },
          { token: TokenType.STRING, value: "baz", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.LEFT_BRACKET, value: "[", partial: false },
          { token: TokenType.LEFT_BRACE, value: "{", partial: false },
          { token: TokenType.STRING, value: "a", partial: false },
          { token: TokenType.COLON, value: ":", partial: false },
          { token: TokenType.STRING, value: "b", partial: true },
          { token: TokenType.STRING, value: "b", partial: false },
        ],
      },
    ];

    emitPartialTokenTestData.forEach(({ value, expected }) => {
      test(`Tokenizer emit partial tokens: ${value}`, async () => {
        let i = 0;
        await runTokenizerTest(
          new Tokenizer({ emitPartialTokens: true }),
          value,
          ({ token, value, partial }) => {
            const expectedData = expected[i];
            expect(token).toEqual(expectedData.token);
            expect(value).toEqual(expectedData.value);
            expect(partial ?? false).toEqual(expectedData.partial);
            i += 1;
          },
        );
        expect(i).toEqual(expected.length);
      });
    });
  });

  describe("TokenParser emit partial values", () => {
    const emitPartialValuesTestData: TestData[] = [
      {
        value: ['"a', "bc", '"'],
        expected: [
          { value: "a", key: undefined, parent: undefined, partial: true },
          { value: "abc", key: undefined, parent: undefined, partial: true },
          { value: "abc", key: undefined, parent: undefined, partial: false },
        ],
      },
      {
        value: ["12", ".34"],
        expected: [
          { value: 12, key: undefined, parent: undefined, partial: true },
          { value: 12.34, key: undefined, parent: undefined, partial: true },
          { value: 12.34, key: undefined, parent: undefined, partial: false },
        ],
      },
      {
        value: ["[", "]"],
        expected: [
          { value: undefined, key: 0, parent: [], partial: true },
          { value: [], key: undefined, parent: undefined, partial: false },
        ],
      },
      {
        value: ["[", '"a', "bc", '"', ",", '"def"', "]"],
        expected: [
          { value: undefined, key: 0, parent: [], partial: true },
          { value: "a", key: 0, parent: [], partial: true },
          { value: "abc", key: 0, parent: [], partial: true },
          { value: "abc", key: 0, parent: ["abc"], partial: false },
          { value: "def", key: 1, parent: ["abc", "def"], partial: false },
          {
            value: ["abc", "def"],
            key: undefined,
            parent: undefined,
            partial: false,
          },
        ],
      },
      {
        value: [
          "{",
          '"a',
          "bc",
          '"',
          ":",
          '"def"',
          ",",
          '"ghi":',
          '"jkl"',
          "}",
        ],
        expected: [
          { value: undefined, key: undefined, parent: {}, partial: true },
          { value: undefined, key: "a", parent: {}, partial: true },
          { value: undefined, key: "abc", parent: {}, partial: true },
          { value: undefined, key: "abc", parent: {}, partial: true },
          { value: "def", key: "abc", parent: { abc: "def" }, partial: false },
          {
            value: undefined,
            key: "ghi",
            parent: { abc: "def" },
            partial: true,
          },
          {
            value: "jkl",
            key: "ghi",
            parent: { abc: "def", ghi: "jkl" },
            partial: false,
          },
          {
            value: { abc: "def", ghi: "jkl" },
            key: undefined,
            parent: undefined,
            partial: false,
          },
        ],
      },
      {
        value: [
          '{ "foo"',
          ": ",
          '{ "foo1": "ba',
          "r",
          '" , "baz',
          '": [',
          '{ "foo2": "bar2", "baz2": [',
          '{ "foo3": "bar3", "baz3": [1',
          "2",
          "3, ",
          "3, 4",
          "5",
          "6]   }",
          "] }]  }}",
        ],
        expected: [
          { value: undefined, key: undefined, parent: {}, partial: true },
          { value: undefined, key: "foo", parent: {}, partial: true },
          { value: undefined, key: undefined, parent: {}, partial: true },
          { value: undefined, key: "foo1", parent: {}, partial: true },
          { value: "ba", key: "foo1", parent: {}, partial: true },
          { value: "bar", key: "foo1", parent: {}, partial: true },
          {
            value: "bar",
            key: "foo1",
            parent: { foo1: "bar" },
            partial: false,
          },
          {
            value: undefined,
            key: "baz",
            parent: { foo1: "bar" },
            partial: true,
          },
          {
            value: undefined,
            key: "baz",
            parent: { foo1: "bar" },
            partial: true,
          },
          { value: undefined, key: 0, parent: [], partial: true },
          { value: undefined, key: undefined, parent: {}, partial: true },
          { value: undefined, key: "foo2", parent: {}, partial: true },
          {
            value: "bar2",
            key: "foo2",
            parent: { foo2: "bar2" },
            partial: false,
          },
          {
            value: undefined,
            key: "baz2",
            parent: { foo2: "bar2" },
            partial: true,
          },
          { value: undefined, key: 0, parent: [], partial: true },
          { value: undefined, key: undefined, parent: {}, partial: true },
          { value: undefined, key: "foo3", parent: {}, partial: true },
          {
            value: "bar3",
            key: "foo3",
            parent: { foo3: "bar3" },
            partial: false,
          },
          {
            value: undefined,
            key: "baz3",
            parent: { foo3: "bar3" },
            partial: true,
          },
          { value: undefined, key: 0, parent: [], partial: true },
          { value: 1, key: 0, parent: [], partial: true },
          { value: 12, key: 0, parent: [], partial: true },
          { value: 123, key: 0, parent: [123], partial: false },
          { value: 3, key: 1, parent: [123, 3], partial: false },
          { value: 4, key: 2, parent: [123, 3], partial: true },
          { value: 45, key: 2, parent: [123, 3], partial: true },
          { value: 456, key: 2, parent: [123, 3, 456], partial: false },
          {
            value: [123, 3, 456],
            key: "baz3",
            parent: { foo3: "bar3", baz3: [123, 3, 456] },
            partial: false,
          },
          {
            value: { foo3: "bar3", baz3: [123, 3, 456] },
            key: 0,
            parent: [{ foo3: "bar3", baz3: [123, 3, 456] }],
            partial: false,
          },
          {
            value: [{ foo3: "bar3", baz3: [123, 3, 456] }],
            key: "baz2",
            parent: {
              foo2: "bar2",
              baz2: [{ foo3: "bar3", baz3: [123, 3, 456] }],
            },
            partial: false,
          },
          {
            value: {
              foo2: "bar2",
              baz2: [{ foo3: "bar3", baz3: [123, 3, 456] }],
            },
            key: 0,
            parent: [
              { foo2: "bar2", baz2: [{ foo3: "bar3", baz3: [123, 3, 456] }] },
            ],
            partial: false,
          },
          {
            value: [
              { foo2: "bar2", baz2: [{ foo3: "bar3", baz3: [123, 3, 456] }] },
            ],
            key: "baz",
            parent: {
              foo1: "bar",
              baz: [
                { foo2: "bar2", baz2: [{ foo3: "bar3", baz3: [123, 3, 456] }] },
              ],
            },
            partial: false,
          },
          {
            value: {
              foo1: "bar",
              baz: [
                { foo2: "bar2", baz2: [{ foo3: "bar3", baz3: [123, 3, 456] }] },
              ],
            },
            key: "foo",
            parent: {
              foo: {
                foo1: "bar",
                baz: [
                  {
                    foo2: "bar2",
                    baz2: [{ foo3: "bar3", baz3: [123, 3, 456] }],
                  },
                ],
              },
            },
            partial: false,
          },
          {
            value: {
              foo: {
                foo1: "bar",
                baz: [
                  {
                    foo2: "bar2",
                    baz2: [{ foo3: "bar3", baz3: [123, 3, 456] }],
                  },
                ],
              },
            },
            key: undefined,
            parent: undefined,
            partial: false,
          },
        ],
      },
    ];

    emitPartialValuesTestData.forEach(({ value, expected }) => {
      test(`TokenParser emit partial values: ${value}`, async () => {
        let i = 0;
        await runJSONParserTest(
          new JSONParser({ emitPartialTokens: true, emitPartialValues: true }),
          value,
          ({ value, key, parent, partial }) => {
            const expectedData = expected[i];
            expect(value).toEqual(expectedData.value);
            expect(key).toEqual(expectedData.key);
            expect(parent).toEqual(expectedData.parent);
            expect(partial ?? false).toEqual(expectedData.partial);
            i += 1;
          },
        );
        expect(i).toEqual(expected.length);
      });
    });
  });

  test("TokenParser emit partial values only if matching paths when paths is present", async () => {
    const value = ['{ "a"', ": 1,", '"b":', '{ "c":', "1 } }"];
    const expected = [
      { value: undefined, key: "c", parent: {}, partial: true },
      { value: 1, key: "c", parent: { c: 1 }, partial: false },
    ];
    let i = 0;
    await runJSONParserTest(
      new JSONParser({
        paths: ["$.b.c"],
        emitPartialTokens: true,
        emitPartialValues: true,
      }),
      value,
      ({ value, key, parent, partial }) => {
        const expectedData = expected[i];
        expect(value).toEqual(expectedData.value);
        expect(key).toEqual(expectedData.key);
        expect(parent).toEqual(expectedData.parent);
        expect(partial ?? false).toEqual(expectedData.partial);
        i += 1;
      },
    );
    expect(i).toEqual(expected.length);
  });
});

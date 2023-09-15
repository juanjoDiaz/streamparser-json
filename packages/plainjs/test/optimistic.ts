import { OptimisticJSONParser } from "../src/optimistic/jsonparser.js";
import { OptimisticTokenizer } from "../src/optimistic/tokenizer.js";
import TokenType from "../src/utils/types/tokenType.js";

interface TokenizerTestData {
  value: string;
  expected: unknown[];
}

describe("optimistic tokenizing", () => {
  const testData: TokenizerTestData[][] = [
    [
      {
        value: "tr",
        expected: [{ type: "incomplete", token: TokenType.TRUE, value: true }],
      },
    ],
    [
      {
        value: "t",
        expected: [{ type: "incomplete", token: TokenType.TRUE, value: true }],
      },
      {
        value: "ru",
        expected: [{ type: "incomplete", token: TokenType.TRUE, value: true }],
      },
    ],
    [
      {
        value: "fal",
        expected: [
          { type: "incomplete", token: TokenType.FALSE, value: false },
        ],
      },
    ],
    [
      {
        value: "n",
        expected: [{ type: "incomplete", token: TokenType.NULL, value: null }],
      },
    ],
    [
      {
        value: "n",
        expected: [{ type: "incomplete", token: TokenType.NULL, value: null }],
      },
      {
        value: "u",
        expected: [{ type: "incomplete", token: TokenType.NULL, value: null }],
      },
      {
        value: "l",
        expected: [{ type: "incomplete", token: TokenType.NULL, value: null }],
      },
      {
        value: "l",
        expected: [{ type: "complete", token: TokenType.NULL, value: null }],
      },
    ],
    [
      {
        value: "{",
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
        ],
      },
    ],
    [
      {
        value: '{ "fo',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "incomplete", token: TokenType.STRING, value: "fo" },
        ],
      },
      {
        value: "o",
        expected: [
          { type: "incomplete", token: TokenType.STRING, value: "foo" },
        ],
      },
    ],
    [
      {
        value: '{ "foo"',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
        ],
      },
      {
        value: ': "',
        expected: [
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "incomplete", token: TokenType.STRING, value: "" },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "ba',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "incomplete", token: TokenType.STRING, value: "ba" },
        ],
      },
      {
        value: "r",
        expected: [
          { type: "incomplete", token: TokenType.STRING, value: "bar" },
        ],
      },
      {
        value: '"',
        expected: [{ type: "complete", token: TokenType.STRING, value: "bar" }],
      },
    ],
    [
      {
        value: '{ "foo": "bar"',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
        ],
      },
      {
        value: "}",
        expected: [
          { type: "complete", token: TokenType.RIGHT_BRACE, value: "}" },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar" }',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.RIGHT_BRACE, value: "}" },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar", "ba',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "incomplete", token: TokenType.STRING, value: "ba" },
        ],
      },
      {
        value: "z",
        expected: [
          { type: "incomplete", token: TokenType.STRING, value: "baz" },
        ],
      },
      {
        value: '": [',
        expected: [
          { type: "complete", token: TokenType.STRING, value: "baz" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.LEFT_BRACKET, value: "[" },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "complete", token: TokenType.STRING, value: "baz" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.LEFT_BRACKET, value: "[" },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [1',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "complete", token: TokenType.STRING, value: "baz" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.LEFT_BRACKET, value: "[" },
          { type: "incomplete", token: TokenType.NUMBER, value: 1 },
        ],
      },
      {
        value: "2",
        expected: [{ type: "incomplete", token: TokenType.NUMBER, value: 12 }],
      },
      {
        value: "3, ",
        expected: [
          { type: "complete", token: TokenType.NUMBER, value: 123 },
          { type: "complete", token: TokenType.COMMA, value: "," },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [1]',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "complete", token: TokenType.STRING, value: "baz" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.LEFT_BRACKET, value: "[" },
          { type: "complete", token: TokenType.NUMBER, value: 1 },
          { type: "complete", token: TokenType.RIGHT_BRACKET, value: "]" },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar", ',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.COMMA, value: "," },
        ],
      },
      {
        value: ' "baz": [1,',
        expected: [
          { type: "complete", token: TokenType.STRING, value: "baz" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.LEFT_BRACKET, value: "[" },
          { type: "complete", token: TokenType.NUMBER, value: 1 },
          { type: "complete", token: TokenType.COMMA, value: "," },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [1,2',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "complete", token: TokenType.STRING, value: "baz" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.LEFT_BRACKET, value: "[" },
          { type: "complete", token: TokenType.NUMBER, value: 1 },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "incomplete", token: TokenType.NUMBER, value: 2 },
        ],
      },
      {
        value: "3, 4",
        expected: [
          { type: "complete", token: TokenType.NUMBER, value: 23 },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "incomplete", token: TokenType.NUMBER, value: 4 },
        ],
      },
      {
        value: "5",
        expected: [{ type: "incomplete", token: TokenType.NUMBER, value: 45 }],
      },
      {
        value: "6]   }",
        expected: [
          { type: "complete", token: TokenType.NUMBER, value: 456 },
          { type: "complete", token: TokenType.RIGHT_BRACKET, value: "]" },
          { type: "complete", token: TokenType.RIGHT_BRACE, value: "}" },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz"',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "complete", token: TokenType.STRING, value: "baz" },
        ],
      },
      {
        value: ": [{",
        expected: [
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.LEFT_BRACKET, value: "[" },
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [{ "a',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "complete", token: TokenType.STRING, value: "baz" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.LEFT_BRACKET, value: "[" },
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "incomplete", token: TokenType.STRING, value: "a" },
        ],
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [{ "a": "b',
        expected: [
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "foo" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.STRING, value: "bar" },
          { type: "complete", token: TokenType.COMMA, value: "," },
          { type: "complete", token: TokenType.STRING, value: "baz" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "complete", token: TokenType.LEFT_BRACKET, value: "[" },
          { type: "complete", token: TokenType.LEFT_BRACE, value: "{" },
          { type: "complete", token: TokenType.STRING, value: "a" },
          { type: "complete", token: TokenType.COLON, value: ":" },
          { type: "incomplete", token: TokenType.STRING, value: "b" },
        ],
      },
    ],
  ];

  testData.forEach((chunks, i) => {
    const name = `[${i}] ${chunks.map((c) => c.value).join("")} (${
      chunks.length
    } chunks)`;
    const expected = chunks.map((c) => c.expected).flat();

    test(name, async () => {
      const tokenizer = new OptimisticTokenizer();

      const tokens: unknown[] = [];
      tokenizer.onToken = (t) =>
        tokens.push({ type: t.type, token: t.token, value: t.value });

      for (const chunk of chunks) {
        tokenizer.write(chunk.value);
      }

      expect(tokens).toMatchObject(expected);
    });
  });
});

interface ParserTestData {
  value: string;
  expected: unknown;
}

describe("optimistic parsing", () => {
  const testData: ParserTestData[][] = [
    [
      {
        value: " ",
        expected: undefined,
      },
      {
        value: "   ",
        expected: undefined,
      },
    ],
    [
      {
        value: "{",
        expected: {},
      },
    ],
    [
      {
        value: '{ "fo',
        expected: { fo: undefined },
      },
      {
        value: "o",
        expected: { foo: undefined },
      },
    ],
    [
      {
        value: '{ "foo"',
        expected: { foo: undefined },
      },
      {
        value: ': "',
        expected: { foo: "" },
      },
    ],
    [
      {
        value: '{ "foo": "ba',
        expected: { foo: "ba" },
      },
      {
        value: "r",
        expected: { foo: "bar" },
      },
      {
        value: '"',
        expected: { foo: "bar" },
      },
    ],
    [
      {
        value: '{ "foo": "bar"',
        expected: { foo: "bar" },
      },
      {
        value: "}",
        expected: { foo: "bar" },
      },
    ],
    [
      {
        value: '{ "foo": "bar" }',
        expected: { foo: "bar" },
      },
    ],
    [
      {
        value: '{ "foo": "bar", "ba',
        expected: { foo: "bar", ba: undefined },
      },
      {
        value: "z",
        expected: { foo: "bar", baz: undefined },
      },
      {
        value: '": [',
        expected: { foo: "bar", baz: [] },
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [',
        expected: { foo: "bar", baz: [] },
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [1',
        expected: { foo: "bar", baz: [1] },
      },
      {
        value: "2",
        expected: { foo: "bar", baz: [12] },
      },
      {
        value: "3, ",
        expected: { foo: "bar", baz: [123] },
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [1]',
        expected: { foo: "bar", baz: [1] },
      },
    ],
    [
      {
        value: '{ "foo": "bar", ',
        expected: { foo: "bar" },
      },
      {
        value: ' "baz": [1,',
        expected: { foo: "bar", baz: [1] },
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [1,2',
        expected: { foo: "bar", baz: [1, 2] },
      },
      {
        value: "3, 4",
        expected: { foo: "bar", baz: [1, 23, 4] },
      },
      {
        value: "5",
        expected: { foo: "bar", baz: [1, 23, 45] },
      },
      {
        value: "6]   }",
        expected: { foo: "bar", baz: [1, 23, 456] },
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz"',
        expected: { foo: "bar", baz: undefined },
      },
      {
        value: ": [{",
        expected: { foo: "bar", baz: [{}] },
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [{ "a',
        expected: { foo: "bar", baz: [{ a: undefined }] },
      },
    ],
    [
      {
        value: '{ "foo": "bar", "baz": [{ "a": "b',
        expected: { foo: "bar", baz: [{ a: "b" }] },
      },
    ],
  ];

  testData.forEach((chunks, i) => {
    const name = `[${i}] ${chunks.map((c) => c.value).join("")} (${
      chunks.length
    } chunks)`;
    const expected = chunks.map((c) => c.expected);

    test(name, async () => {
      const parser = new OptimisticJSONParser();

      const values: unknown[] = [];
      for (const chunk of chunks) {
        parser.write(chunk.value);

        if (parser.value) {
          values.push(structuredClone(parser.value));
        } else {
          values.push(undefined);
        }
      }

      expect(values).toMatchObject(expected);
    });
  });
});

function structuredClone(x: unknown): unknown {
  if (x === undefined || x === null) {
    return x;
  }

  if (Array.isArray(x)) {
    return x.map(structuredClone);
  }

  if (typeof x === "object") {
    return Object.fromEntries(
      Object.entries(x).map(([k, v]) => [k, structuredClone(v)])
    );
  }

  return x;
}

import TokenType from "@streamparser/json/utils/types/tokenType.js";
import JSONParser from "../src/jsonparser.js";
import TokenParser from "../src/tokenparser.js";
import { runJSONParserTest, runTokenParserTest } from "./utils/testRunner.js";

describe("end", () => {
  test("should fail if writing after ending", async () => {
    const p = new JSONParser({ separator: "" });

    await runJSONParserTest(p, ['"test"']);

    // The stream has finished; writing to it now must report an error via the
    // write callback. (The error originates in Node's stream internals, so it
    // isn't `instanceof` this realm's Error under vitest -- assert it's present
    // rather than its type, and outside the callback so a failure can't hang.)
    const writeError = await new Promise((resolve) => {
      p.write('"test"', (err) => resolve(err));
    });
    expect(writeError).toBeTruthy();
  });

  const autoEndValues = ["2 2", "2.33456{}", "{}{}{}"];

  autoEndValues.forEach((value) => {
    test(`should auto-end after emiting one object: ${value}`, async () => {
      const p = new JSONParser();

      expect.assertions(1);
      try {
        await runJSONParserTest(p, [value]);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });

  const numberValues = [
    "0",
    "2",
    "2.33456",
    "2.33456e+1",
    "-2",
    "-2.33456",
    "-2.33456e+1",
  ];

  numberValues.forEach((numberValue) => {
    test(`should emit numbers if ending on a valid number: ${numberValue}`, async () => {
      const p = new JSONParser({ separator: "" });

      await runJSONParserTest(p, [numberValue], ({ value }) =>
        expect(value).toEqual(JSON.parse(numberValue)),
      );
    });
  });

  const endingFailingValues = [
    "2.",
    "2.33456e",
    "2.33456e+",
    '"asdfasd',
    "tru",
    '"fa',
    '"nul',
    "{",
    "[",
    '{ "a":',
    '{ "a": { "b": 1, ',
    '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 }',
  ];

  endingFailingValues.forEach((value) => {
    test(`should fail if ending in the middle of parsing: ${value}`, async () => {
      const p = new JSONParser();

      expect.assertions(1);
      try {
        await runJSONParserTest(p, [value]);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });

  test("should not fail if ending waiting for a separator", async () => {
    const separator = "\n";
    const p = new JSONParser({ separator });

    await runJSONParserTest(p, ["1", separator, "2"]);
  });

  test("should not fail on trailing whitespace received after the root value has completed", async () => {
    const p = new JSONParser();

    // biome-ignore lint/suspicious/noImplicitAnyLet: assigned inside the async callback below
    let value;
    await runJSONParserTest(p, ["{}", " "], (parsedElementInfo) => {
      if (parsedElementInfo.stack.length === 0) value = parsedElementInfo.value;
    });

    expect(value).toEqual({});
  });

  test("TokenParser transform should not end its writable side when the root value completes", async () => {
    const p = new TokenParser();

    // A trailing (whitespace-separator) token after the root value completes
    // must not trip "write after end": the transform's writable side should
    // only close in response to the upstream ending, via Node's _final hook.
    // biome-ignore lint/suspicious/noImplicitAnyLet: assigned inside the async callback below
    let value;
    await runTokenParserTest(
      p,
      [
        { token: TokenType.LEFT_BRACE, value: "{" },
        { token: TokenType.RIGHT_BRACE, value: "}" },
        { token: TokenType.SEPARATOR, value: " " },
      ],
      (parsedElementInfo) => {
        if (parsedElementInfo.stack.length === 0)
          value = parsedElementInfo.value;
      },
    );

    expect(value).toEqual({});
  });
});

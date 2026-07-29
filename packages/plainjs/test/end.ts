import JSONParser from "../src/jsonparser.js";
import { runJSONParserTest } from "./utils/testRunner.js";

describe("end", () => {
  test("should fail if writing after ending", async () => {
    const p = new JSONParser({ separator: "" });

    await runJSONParserTest(p, ['"test"']);

    expect.assertions(1);
    try {
      await runJSONParserTest(p, ['"test"']);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  const autoEndValues = ["2 2", "2.33456{}", "{}{}{}"];

  autoEndValues.forEach((value) => {
    test(`should auto-end after emiting one object: ${value}`, async () => {
      const p = new JSONParser();

      expect.assertions(1);
      try {
        await runJSONParserTest(p, [value]);
      } catch {
        expect(p.isEnded).toBeTruthy();
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

      await runJSONParserTest(
        p,
        [numberValue],
        ({ value }) => expect(value).toEqual(JSON.parse(numberValue)),
        false,
      );
      p.end();

      expect(p.isEnded).toBeTruthy();
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
        p.end();
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });

  test("should not fail if ending waiting for a separator", async () => {
    const separator = "\n";
    const p = new JSONParser({ separator });

    await runJSONParserTest(p, ["1", separator, "2"], undefined, false);
    p.end();

    expect(p.isEnded).toBeTruthy();
  });
});

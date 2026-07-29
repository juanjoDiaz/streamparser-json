import JSONParser from "../../src/jsonparser.js";
import { runJSONParserTest } from "../utils/testRunner.js";

describe("boolean", () => {
  const values = ["true", "false"];

  values.forEach((stringValue) => {
    test(stringValue, async () => {
      await runJSONParserTest(new JSONParser(), [stringValue], ({ value }) => {
        expect(value).toEqual(JSON.parse(stringValue));
      });
    });

    test(`${stringValue} (chuncked)`, async () => {
      await runJSONParserTest(
        new JSONParser(),
        (stringValue as string).split(""),
        ({ value }) => {
          expect(value).toEqual(JSON.parse(stringValue));
        },
      );
    });
  });

  const invalidValues = [
    "tRue",
    "trUe",
    "truE",
    "fAlse",
    "faLse",
    "falSe",
    "falsE",
  ];

  invalidValues.forEach((value) => {
    test("fail on invalid values", async () => {
      expect.assertions(1);
      try {
        await runJSONParserTest(new JSONParser(), [value]);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });
});

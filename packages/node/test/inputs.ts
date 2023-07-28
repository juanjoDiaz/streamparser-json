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
      value: Buffer.from([116, 101, 115, 116]),
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
});

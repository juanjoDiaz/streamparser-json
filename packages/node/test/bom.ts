import JSONParser from "../src/jsonparser.js";
import { runJSONParserTest } from "./utils/testRunner.js";

describe("BOM", () => {
  test("should support UTF-8 BOM", () => {
    runJSONParserTest(
      new JSONParser(),
      new Uint8Array([0xef, 0xbb, 0xbf, 0x31]),
      ({ value }) => expect(value).toBe(1),
    );
  });

  test("should support UTF-8 BOM split across separate writes", () => {
    runJSONParserTest(
      new JSONParser(),
      [new Uint8Array([0xef, 0xbb]), new Uint8Array([0xbf, 0x31])],
      ({ value }) => expect(value).toBe(1),
    );
  });
});

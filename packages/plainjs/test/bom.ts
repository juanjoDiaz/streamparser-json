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

  test("should support UTF-16 BE BOM", () => {
    runJSONParserTest(
      new JSONParser(),
      new Uint16Array([0xfeff, 0x3131]),
      ({ value }) => expect(value).toBe(11),
    );
  });

  test("should support UTF-16 LE BOM", () => {
    runJSONParserTest(
      new JSONParser(),
      new Uint16Array([0xfffe, 0x3131]),
      ({ value }) => expect(value).toBe(11),
    );
  });

  test("should support UTF-32 BE BOM", () => {
    runJSONParserTest(
      new JSONParser(),
      new Uint32Array([0x0000feff, 0x31313131]),
      ({ value }) => expect(value).toBe(1111),
    );
  });

  test("should support UTF-32 LE BOM", () => {
    runJSONParserTest(
      new JSONParser(),
      new Uint32Array([0xfffe0000, 0x31313131]),
      ({ value }) => expect(value).toBe(1111),
    );
  });
});

import { charset } from "@streamparser/json/utils/utf-8.js";
import JSONParser from "../src/jsonparser.js";
import { runJSONParserTest, type TestData } from "./utils/testRunner.js";

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

  // write()'s public signature is `Iterable<number> | string`, and the core
  // Tokenizer.write() accepts any iterable (Set, generator, Map values(),
  // etc), not just Array/TypedArray/string -- see plainjs/whatwg's
  // "write accept a Set<number>" / "...generator..." / "...Map values()..."
  // tests. Not tested here: Node's own Writable stream, in the non-object
  // writableObjectMode this Transform uses, rejects any chunk that isn't a
  // string/Buffer/TypedArray/DataView *before* it ever reaches this
  // library's code (`TypeError: The "chunk" argument must be of type
  // string or an instance of Buffer, TypedArray, or DataView`), confirmed
  // directly against a bare JSONParserTransform#write() call. That's a
  // Node stream platform limitation, not something fixable at the
  // tokenizer level for this adapter.
});

import JSONParser from "../src/jsonparser.js";
import { runJSONParserTest } from "./utils/testRunner.js";

describe("keepStack", () => {
  const testData = [
    {
      value: '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 } }',
      paths: ["$"],
    },
    {
      value: '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 } }',
      paths: ["$.a.*"],
    },
    {
      value: '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 } }',
      paths: ["$.a.e"],
    },
    {
      value: '{ "a": { "b": [1,2,3,4,5,6] } }',
      paths: ["$.a.b.*"],
      expected: 6,
    },
    {
      value: '[{ "a": 1 }, { "a": 2 }, { "a": 3 }]',
      paths: ["$.*"],
    },
  ];

  testData.forEach(({ value, paths }) => {
    test(`should keep parent empty if keepStack === false (${value} - ${paths})`, async () => {
      await runJSONParserTest(
        new JSONParser({ paths, keepStack: false }),
        [value],
        ({ parent }) => {
          if (parent === undefined) return;
          expect(Object.keys(parent).length).toEqual(0);
        },
      );
    });
  });

  // With keepStack === false, emitted properties are deleted from the
  // materialized object to save memory (see above). Object emptiness must
  // therefore be tracked independently of that object, otherwise a trailing
  // comma (invalid JSON) is mistaken for a legitimately empty object once its
  // only property has been purged.
  describe("trailing commas", () => {
    const invalidTestData = [
      '{"a":1,}',
      '{"a":1,"b":2,}',
      '{"a":{},}',
      '{"a":[],}',
    ];

    invalidTestData.forEach((value) => {
      test(`should reject trailing comma (${value})`, async () => {
        let didThrow = false;
        try {
          await runJSONParserTest(
            new JSONParser({ paths: ["$.*"], keepStack: false }),
            [value],
          );
        } catch {
          didThrow = true;
        }
        expect(didThrow).toEqual(true);
      });
    });
  });
});

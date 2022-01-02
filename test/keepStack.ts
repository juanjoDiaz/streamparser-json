import tap from "tap";
import JSONParser from "../src/jsonparser";

const { test } = tap;

const testData = [
  {
    value: '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 } }',
    paths: ["$"],
    expected: 1,
  },
  {
    value: '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 } }',
    paths: ["$.a.*"],
    expected: 4,
  },
  {
    value: '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 } }',
    paths: ["$.a.e"],
    expected: 1,
  },
  { value: '{ "a": { "b": [1,2,3,4,5,6] } }', paths: ["$.a.b.*"], expected: 6 },
  {
    value: '[{ "a": 1 }, { "a": 2 }, { "a": 3 }]',
    paths: ["$.*"],
    expected: 3,
  },
];

testData.forEach(({ value, paths, expected }) => {
  test(`should keep parent empty if keepStack === false`, {}, (t) => {
    t.plan(expected);

    const p = new JSONParser({ paths, keepStack: false });
    p.onValue = (value, key, parent) => {
      if (parent === undefined) {
        t.pass();
        return;
      }
      t.equal(Object.keys(parent).length, 0);
    };

    p.write(value);
  });
});

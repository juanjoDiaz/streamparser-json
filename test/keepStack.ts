import tap from "tap";
import JsonParser from "../src/jsonparse";

const { test } = tap;

const testData = [
  { value: '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 } }', path: "$", expected: 1 },
  { value: '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 }', path: "$.a.*", expected: 4 },
  { value: '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 }', path: "$.a.e", expected: 1 },
  { value: '{ "a": { "b": [1,2,3,4,5,6] }', path: "$.a.b.*", expected: 6 },
];

testData.forEach(({ value, path, expected }) => {
  test(`should keep parent empty if keepStack === false`, {}, (t) => {
    t.plan(expected);
    const p = new JsonParser({ path, keepStack: false });
    p.onValue = (value, key, parent) => {
      if (parent === undefined) {
        t.pass();
        return;
      }
      t.equals(Object.keys(parent).length, 0);
    };

    p.write(value);
  });
});

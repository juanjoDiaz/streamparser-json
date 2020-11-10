import tap from "tap";
import JsonParser from "../src/jsonparse";

const { test } = tap;

const testData = [
  { value: "[0,1,-1]", path: "$", expected: [[0,1,-1]] },
  { value: "[0,1,-1]", path: "$.*", expected: [0,1,-1] },
  { value: "[0,1,-1]", path: "$.1", expected: [1] },
  { value: '{ "a": { "b": 1, "c": 2 } }', path: "$.a.*", expected: [1,2] },
  { value: '{ "a": { "b": 1, "c": 2 } }', path: "$.a.c", expected: [2] },
  { value: '{ "a": { "b": [1,2], "c": [3, 4] } }', path: "$.a.*.*", expected: [1,2,3,4] },
  { value: '{ "a": { "b": [1,2], "c": [3, 4] } }', path: "$.a.*.1", expected: [2,4] },
  { value: '{ "a": { "b": [1,2], "c": [3, 4] } }', path: "$.a.c.*", expected: [3,4] },
  { value: '{ "a": { "b": [1,2], "c": [3, 4] } }', path: "$.a.c.1", expected: [4] },
];

testData.forEach(({ value, path, expected }) => {
  test(`Using selector ${path} should emit only selected values`, {}, (t) => {
    t.plan(expected.length);

    let i = 0;

    const p = new JsonParser({ path });
    p.onValue = (value) => {
      t.deepEqual(
        value,
        expected[i],
        `Error on expectation ${i} (${value} !== ${expected[i]})`,
      );
      i += 1;
    };
    p.onEnd = () => t.end();

    p.write(value);

    p.end();
  });
});


const invalidTestData = [
  { path: "*", expectedError: 'Invalid selector "*". Should start with "$".' },
  { path: ".*", expectedError: 'Invalid selector ".*". Should start with "$".' },
  { path: "$..*", expectedError: 'Invalid selector "$..*". ".." syntax not supported.' },
];

invalidTestData.forEach(({ path, expectedError }) => {
  test(`fail on invalid selector ${path}`, {}, (t) => {
    t.plan(1);

    try {
      new JsonParser({ path });
      t.fail('Error expected on invalid selector');
    } catch (err) {
      t.equal(err.message, expectedError);
    }
  });
});

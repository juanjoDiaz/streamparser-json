import tap from "tap";
import JSONParser from "../src/jsonparser";

const { test } = tap;

const testData = [
  { value: "[0,1,-1]", paths: ["$"], expected: [[0, 1, -1]] },
  { value: "[0,1,-1]", paths: ["$.*"], expected: [0, 1, -1] },
  { value: "[0,1,-1]", paths: [undefined], expected: [0, 1, -1, [0, 1, -1]] },
  { value: "[0,1,-1]", paths: ["$*"], expected: [0, 1, -1, [0, 1, -1]] },
  {
    value: "[0,1,[-1, 2]]",
    paths: ["$", "$.*"],
    expected: [0, 1, [-1, 2], [0, 1, [-1, 2]]],
  },
  { value: "[0,1,-1]", paths: ["$.1"], expected: [1] },
  { value: '{ "a": { "b": 1, "c": 2 } }', paths: ["$.a.*"], expected: [1, 2] },
  { value: '{ "a": { "b": 1, "c": 2 } }', paths: ["$.a.c"], expected: [2] },
  {
    value: '{ "a": { "b": [1,2], "c": [3, 4] } }',
    paths: ["$.a.*.*"],
    expected: [1, 2, 3, 4],
  },
  {
    value: '{ "a": { "b": [1,2], "c": [3, 4] } }',
    paths: ["$.a.*.1"],
    expected: [2, 4],
  },
  {
    value: '{ "a": { "b": [1,2], "c": [3, 4] } }',
    paths: ["$.a.c.*"],
    expected: [3, 4],
  },
  {
    value: '{ "a": { "b": [1,2], "c": [3, 4] } }',
    paths: ["$.a.c.1"],
    expected: [4],
  },
];

testData.forEach(({ value, paths, expected }) => {
  test(`Using selector ${paths} should emit only selected values`, {}, (t) => {
    t.plan(expected.length);

    let i = 0;

    const p = new JSONParser({ paths });
    p.onValue = (value) => {
      t.same(
        value,
        expected[i],
        `Error on expectation ${i} (${value} !== ${expected[i]})`
      );
      i += 1;
    };

    p.write(value);
  });
});

const invalidTestData = [
  {
    paths: ["*"],
    expectedError: 'Invalid selector "*". Should start with "$".',
  },
  {
    paths: [".*"],
    expectedError: 'Invalid selector ".*". Should start with "$".',
  },
  {
    paths: ["$..*"],
    expectedError: 'Invalid selector "$..*". ".." syntax not supported.',
  },
];

invalidTestData.forEach(({ paths, expectedError }) => {
  test(`fail on invalid selector ${paths}`, {}, (t) => {
    t.plan(1);

    try {
      new JSONParser({ paths });
      t.fail("Error expected on invalid selector");
    } catch (err) {
      t.equal(err.message, expectedError);
    }
  });
});

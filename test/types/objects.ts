const { readFileSync } = require('fs');
import tap from "tap";
import JsonParser from "../../src/jsonparse";

const { test } = tap;

const values = [
  "{}",
  '{ "a": 0, "b": 1, "c": -1 }',
  '{ "a": 1.0, "b": 1.1, "c": -1.1, "d": -1.0 }',
  '{ "e": -1 }',
  '{ "f": -0.1 }',
  '{ "a": 6.02e23, "b": 6.02e+23, "c": 6.02e-23, "d": 0e23 }',
  '{ "a": 7161093205057351174 }',
];

const expected = [
  [[], {}],
  [["a"], 0],
  [["b"], 1],
  [["c"], -1],
  [[], { a: 0, b: 1, c: -1 }],
  [["a"], 1],
  [["b"], 1.1],
  [["c"], -1.1],
  [["d"], -1],
  [[], { a: 1, b: 1.1, c: -1.1, d: -1 }],
  [["e"], -1],
  [[], { e: -1 }],
  [["f"], -0.1],
  [[], { f: -0.1 }],
  [["a"], 6.02e+23],
  [["b"], 6.02e+23],
  [["c"], 6.02e-23],
  [["d"], 0e23],
  [[], { a: 6.02e+23, b: 6.02e+23, c: 6.02e-23, d: 0e23 }],
  [["a"], "7161093205057351174"],
  [[], { a: "7161093205057351174" }],
];

test("objects", (t) => {
  t.plan(expected.length);

  let i = 0;

  values.forEach((str) => {
    const p = new JsonParser();
    p.onValue = function (value) {
      const keys = this.stack
        .slice(1)
        .map((item) => item.key)
        .concat(this.key !== undefined ? this.key : []);

      t.deepEqual(
        [keys, value],
        expected[i],
        `Error on expectation ${i} (${[keys, value]} !== ${expected[i]})`,
      );
      i += 1;
    };

    p.write(str);
  });
});

test("objects chuncked", (t) => {
  t.plan(expected.length);

  let i = 0;

  values.forEach((str) => {
    const p = new JsonParser();
    p.onValue = function (value) {
      const keys = this.stack
        .slice(1)
        .map((item) => item.key)
        .concat(this.key !== undefined ? this.key : []);

      t.deepEqual(
        [keys, value],
        expected[i],
        `Error on expectation ${i} (${[keys, value]} !== ${expected[i]})`,
      );
      i += 1;
    };

    str.split("").forEach(c => p.write(c));
  });
});

test("objects complex ", (t) => {
  t.plan(1);

  const stringifiedJson = readFileSync(`${process.cwd()}/samplejson/basic.json`)
    .toString();

  const p = new JsonParser();
  p.onValue = (value, key, parent, stack) => {
    if (stack.length === 0) {
      t.deepEqual(JSON.parse(stringifiedJson), value);
    }
  };

  p.write(stringifiedJson);
});

test("fail on invalid values", (t) => {
  const invalidValues = [
    "{,",
    '{"test": eer[ }',
    "{ test: 1 }",
    '{ "test": 1 ;',
    '{ "test": 1 ]',
    '{ "test": 1, }',
    '{ "test", }',
  ];

  t.plan(invalidValues.length);

  invalidValues.forEach((str) => {
    const p = new JsonParser();
    p.onValue = () => {};

    try {
      p.write(str);
      t.fail(`Expected to fail on value "${str}"`);
    } catch (e) {
      t.pass();
    }
  });
});

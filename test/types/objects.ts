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
  t.plan(expected.length + values.length);

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
    p.onEnd = () => t.pass();

    p.write(str);

    p.end();
  });
});

test("objects unbound", (t) => {
  t.plan(expected.length);

  let i = 0;

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
  p.onEnd = () => t.end();

  values.forEach((str) => p.write(str));

  p.end();
});

test("objects chuncked", (t) => {
  t.plan(expected.length + values.length);

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

    p.onEnd = () => t.pass();

    str.split("").forEach(c => p.write(c));

    p.end();
  });
});

test("fail on invalid values", (t) => {
  const invalidValues = [
    "{,",
    '{"test": eer[ }',
    "{ test: 1 }",
    '{ "test", }',
    '{ "test": 1 ;',
    '{ "test": 1 ]',
    '{ "test": 1, }',
  ];

  t.plan(invalidValues.length);

  invalidValues.forEach((str) => {
    const p = new JsonParser();
    try {
      p.write(str);
      t.fail(`Expected to fail on value "${str}"`);
    } catch (e) {
      t.pass();
    }
  });
});

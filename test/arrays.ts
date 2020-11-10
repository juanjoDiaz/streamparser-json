import tap from "tap";
import JsonParser from "../src/jsonparse";

const { test } = tap;

const values = [
  "[]",
  "[0,1,-1]",
  "[1.0,1.1,-1.1,-1.0]",
  "[-1]",
  "[-0.1]",
  "[6.02e23, 6.02e+23, 6.02e-23, 0e23]",
  "[7161093205057351174]",
];

const expected = [
  [[], []],
  [[0], 0],
  [[1], 1],
  [[2], -1],
  [[], [0, 1, -1]],
  [[0], 1],
  [[1], 1.1],
  [[2], -1.1],
  [[3], -1],
  [[], [1, 1.1, -1.1, -1]],
  [[0], -1],
  [[], [-1]],
  [[0], -0.1],
  [[], [-0.1]],
  [[0], 6.02e+23],
  [[1], 6.02e+23],
  [[2], 6.02e-23],
  [[3], 0e23],
  [[], [6.02e+23, 6.02e+23, 6.02e-23, 0e23]],
  [[0], "7161093205057351174"],
  [[], ["7161093205057351174"]],
];

test("arrays", (t) => {
  t.plan(expected.length + values.length);

  let i = 0;

  values.forEach((str) => {
    const p = new JsonParser();
    p.onValue = (value, key, parent, stack) => {
      const keys = stack
        .slice(1)
        .map((item) => item.key)
        .concat(key !== undefined ? key : []);

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

test("arrays unbound", (t) => {
  t.plan(expected.length);

  let i = 0;

  const p = new JsonParser();
  p.onValue = (value, key, parent, stack) => {
    const keys = stack
      .slice(1)
      .map((item) => item.key)
      .concat(key !== undefined ? key : []);

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

test("arrays chuncked", (t) => {
  t.plan(expected.length + values.length);

  let i = 0;

  values.forEach((str) => {
    const p = new JsonParser();
    p.onValue = (value, key, parent, stack) => {
      const keys = stack
        .slice(1)
        .map((item) => item.key)
        .concat(key !== undefined ? key : []);

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
    "[,",
    "[1, eer]",
    "[1,]",
    "[1;",
    "[1}",
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

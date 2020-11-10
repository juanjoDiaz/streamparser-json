import tap from "tap";
import JsonParser from "../../src/jsonparse";

const { test } = tap;

const values = [
  "null",
];
const expected = values.map((str) => JSON.parse(str));

test("null", (t) => {
  t.plan(expected.length + values.length);

  let i = 0;

  values.forEach((str) => {
    const p = new JsonParser();
    p.onValue = (value) => {
      t.equal(
        value,
        expected[i],
        `Error on expectation ${i} (${value} !== ${expected[i]})`,
      );
      i += 1;
    };
    p.onEnd = () => t.pass();

    p.write(str);

    p.end();
  });
});

test("null unbound", (t) => {
  t.plan(expected.length);

  let i = 0;

  const p = new JsonParser();
  p.onValue = (value) => {
    t.equal(
      value,
      expected[i],
      `Error on expectation ${i} (${value} !== ${expected[i]})`,
    );
    i += 1;
  };

  p.onEnd = () => t.end();

  values.forEach((str) => p.write(str));

  p.end();
});

test("null chuncked", (t) => {
  t.plan(expected.length + values.length);

  let i = 0;

  values.forEach((str) => {
    const p = new JsonParser();
    p.onValue = (value) => {
      t.equal(
        value,
        expected[i],
        `Error on expectation ${i} (${value} !== ${expected[i]})`,
      );
      i += 1;
    };
    p.onEnd = () => t.pass();

    str.split("").forEach(c => p.write(c));

    p.end();
  });
});

test("fail on invalid values", (t) => {
  const values = [
    "nUll",
    "nuLl",
    "nulL",
  ];

  t.plan(values.length);

  values.forEach((str) => {
    const p = new JsonParser();
    try {
      p.write(str);
      t.fail(`Expected to fail on value "${str}"`);
    } catch (e) {
      t.pass();
    }
  });
});

import tap from "tap";
import JsonParser from "../../src/jsonparse";

const { test } = tap;

const values = [
  "true",
  "false",
];
const expected = values.map((str) => JSON.parse(str));

test("boolean", (t) => {
  t.plan(expected.length);

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

    p.write(str);

    p.end();
  });
});

test("boolean unbound", (t) => {
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

  values.forEach((str) => p.write(str));

  p.end();
});

test("boolean chuncked", (t) => {
  t.plan(expected.length);

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

    str.split("").forEach(c => p.write(c));

    p.end();
  });
});

test("fail on invalid values", (t) => {
  const invalidValues = [
    "tRue",
    "trUe",
    "truE",
    "fAlse",
    "faLse",
    "falSe",
    "falsE",
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

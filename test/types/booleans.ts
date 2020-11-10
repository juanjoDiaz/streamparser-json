import tap from "tap";
import JsonParser from "../../src/jsonparse";

const { test } = tap;

const values = [
  "true",
  "false",
];
const expected = values.map((str) => JSON.parse(str));

test("boolean", (t) => {
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
  p.onEnd = () => t.end();

  values.forEach((str) => p.write(str));

  p.end();
});

test("boolean chuncked", (t) => {
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
    p.onError = () => t.ok(true);
    
    p.write(str);
  });
});

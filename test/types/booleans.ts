import tap from "tap";
import JSONParser from "../../src/jsonparser";

const { test } = tap;

const values = ["true", "false"];
const expected = values.map((str) => JSON.parse(str));

test("boolean", (t) => {
  t.plan(expected.length);

  let i = 0;

  values.forEach((str) => {
    const p = new JSONParser();
    p.onValue = (value) => {
      t.equal(
        value,
        expected[i],
        `Error on expectation ${i} (${value} !== ${expected[i]})`
      );
      i += 1;
    };

    p.write(str);
  });
});

test("boolean chuncked", (t) => {
  t.plan(expected.length);

  let i = 0;

  values.forEach((str) => {
    const p = new JSONParser();
    p.onValue = (value) => {
      t.equal(
        value,
        expected[i],
        `Error on expectation ${i} (${value} !== ${expected[i]})`
      );
      i += 1;
    };

    str.split("").forEach((c) => p.write(c));
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
    const p = new JSONParser();
    p.onValue = () => {
      /* Do nothing */
    };

    try {
      p.write(str);
      t.fail(`Expected to fail on value "${str}"`);
    } catch (e) {
      t.pass();
    }
  });
});

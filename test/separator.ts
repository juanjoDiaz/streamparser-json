import tap from "tap";
import JSONParser from "../src/jsonparser";

const { test } = tap;

const testData = [
  { value: "true", expected: [true] },
  { value: "false", expected: [false] },
  { value: "null", expected: [null] },
  { value: '"string"', expected: ["string"] },
  { value: "[1,2,3]", expected: [1, 2, 3, [1, 2, 3]] },
  {
    value: '{ "a": 0, "b": 1, "c": -1 }',
    expected: [0, 1, -1, { a: 0, b: 1, c: -1 }],
  },
];

const expected = testData
  .map(({ expected }) => expected)
  .reduce((acc, val) => [...acc, ...val], []);

test("separator: empty string", (t) => {
  t.plan(expected.length);

  let i = 0;

  const p = new JSONParser({ separator: "" });
  p.onValue = (value) => {
    t.same(
      value,
      expected[i],
      `Error on expectation ${i} (${value} !== ${expected[i]})`
    );
    i += 1;
  };

  testData.forEach(({ value }) => p.write(value));

  p.end();
});

test("separator: ND-JSON", (t) => {
  t.plan(expected.length);

  const separator = "\n";
  let i = 0;

  const p = new JSONParser({ separator });
  p.onValue = (value) => {
    t.same(
      value,
      expected[i],
      `Error on expectation ${i} (${value} !== ${expected[i]})`
    );
    i += 1;
  };

  testData.forEach(({ value }) => {
    p.write(value);
    p.write(separator);
  });

  p.end();
});

const separators = ["\t\n", "abc", "SEPARATOR"];
separators.forEach((separator) => {
  test("separator: multi-byte", (t) => {
    t.plan(expected.length);

    let i = 0;

    const p = new JSONParser({ separator });
    p.onValue = (value) => {
      t.same(
        value,
        expected[i],
        `Error on expectation ${i} (${value} !== ${expected[i]})`
      );
      i += 1;
    };

    testData.forEach(({ value }) => {
      p.write(value);
      p.write(separator);
    });

    p.end();
  });
});

test(`separator: fail on invalid value`, {}, (t) => {
  t.plan(1);

  const p = new JSONParser({ separator: "abc" });
  p.onValue = () => {
    /* Do nothing */
  };

  try {
    p.write("abe");
    t.fail("Error expected on invalid selector");
  } catch (err) {
    t.equal(err.message, 'Unexpected "e" at position "2" in state SEPARATOR');
  }
});

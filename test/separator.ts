import tap from "tap";
import JSONParser from "../src/jsonparser";
import TokenParser from "../src/tokenparser";
import { TokenType } from "../src/utils/constants";

const { test } = tap;

type TestData = {
  value: string;
  expected: any[];
};

const testData: TestData[] = [
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
  } catch (err: any) {
    t.equal(err.message, 'Unexpected "e" at position "2" in state SEPARATOR');
  }
});

test(`separator: fail on invalid token type`, {}, (t) => {
  t.plan(1);

  const p = new TokenParser({ separator: "\n" });
  p.onValue = () => {
    /* Do nothing */
  };

  p.write(TokenType.TRUE, true);

  try {
    p.write(TokenType.TRUE, true);
    t.fail("Error expected on invalid selector");
  } catch (err: any) {
    t.equal(err.message, "Unexpected TRUE (true) in state SEPARATOR");
  }
});

test("fail on invalid value passed to TokenParser", (t) => {
  t.plan(1);

  const p = new TokenParser({ separator: "\n" });
  p.onValue = () => {
    /* Do nothing */
  };

  p.write(TokenType.TRUE, true);

  try {
    p.write(TokenType.SEPARATOR, "\r\n");
    t.fail("Expected to fail");
  } catch (err: any) {
    t.equal(err.message, 'Unexpected SEPARATOR ("\\r\\n") in state SEPARATOR');
  }
});

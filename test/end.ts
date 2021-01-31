import tap from "tap";
import JSONParser from "../src/jsonparser";

const { test } = tap;

test("should fail if writing after ending", (t) => {
  t.plan(2);

  const p = new JSONParser({ separator: "" });
  p.onValue = () => {
    /* Do nothing */
  };

  p.write('"test"');
  p.end();

  t.ok(p.isEnded);
  try {
    p.write('"test"');
    t.fail("Expected to fail");
  } catch (e) {
    t.pass();
  }
});

test("should auto-end after emiting one object", (t) => {
  const values = ["2 2", "2.33456{}", "{}{}{}"];

  t.plan(values.length * 2);

  values.forEach((str) => {
    const p = new JSONParser();
    p.onValue = () => {
      /* Do nothing */
    };

    try {
      p.write(str);
      t.fail(`Expected to fail on value "${str}"`);
    } catch (e) {
      t.ok(p.isEnded);
      t.pass();
    }
  });
});

test("should emit numbers if ending on a valid number", (t) => {
  const values = [
    "0",
    "2",
    "2.33456",
    "2.33456e+1",
    "-2",
    "-2.33456",
    "-2.33456e+1",
  ];

  const expected = values.map((str) => JSON.parse(str));

  t.plan(expected.length * 2);

  let i = 0;

  values.forEach((str) => {
    const p = new JSONParser({ separator: "" });
    p.onValue = (value) => t.equal(value, expected[i++]);

    p.write(str);
    p.end();

    t.ok(p.isEnded);
  });
});

test("should fail if ending in the middle of parsing", (t) => {
  const values = [
    "2.",
    "2.33456e",
    "2.33456e+",
    '"asdfasd',
    "tru",
    '"fa',
    '"nul',
    "{",
    "[",
    '{ "a":',
    '{ "a": { "b": 1, ',
    '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 }',
  ];

  t.plan(values.length);

  values.forEach((str) => {
    const p = new JSONParser();
    p.onValue = () => {
      /* Do nothing */
    };

    p.write(str);

    try {
      p.end();
      t.fail(`Expected to fail on value "${str}"`);
    } catch (e) {
      t.pass();
    }
  });
});

test("should not fail if ending waiting for a separator", (t) => {
  t.plan(1);

  const separator = "\n";

  const p = new JSONParser({ separator });
  p.onValue = () => {
    /* Do nothing */
  };

  p.write("1");
  p.write(separator);
  p.write("2");

  p.end();

  t.ok(p.isEnded);
});

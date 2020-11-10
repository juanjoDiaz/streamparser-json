import tap from "tap";
import JsonParser from "../src/jsonparse";

const { test } = tap;

test("should fail if ending in the middle of parsing", (t) => {
  const values = [
    "2.",
    "2.33456",
    "2.33456e",
    '"asdfasd',
    'tru',
    '"fa',
    '"nul',
    "{",
    "[",
    '{ "a":',
    '{ "a": { "b": 1, ',
    '{ "a": { "b": 1, "c": 2, "d": 3, "e": 4 }',
  ];

  t.plan(values.length);

  values.forEach((value) => {
    const p = new JsonParser();
    p.onError = () => t.ok(true);

    p.write(value);
    p.end();
  });
});
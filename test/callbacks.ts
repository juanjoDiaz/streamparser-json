import tap from "tap";
import JsonParser from "../src/jsonparse";

const { test } = tap;

test("should handle invalid input using the onError callback if set", (t) => {
  t.plan(1);

  const p = new JsonParser();
  p.onError = (err) => t.equal(err.message, 'Unexpected type. The `write` function only accepts Arrays, TypedArrays and Strings.');

  p.write(745674 as any);
});

test("should handle errors using the onError callback if set", (t) => {
  t.plan(1);

  const p = new JsonParser();
  p.onError = (err) => t.equal(err.message, 'Unexpected "e" at position "3" in state TRUE1');

  p.write('""test""');
});

test("should handle processing end using the onEnd callback if set", (t) => {
  t.plan(1);

  const p = new JsonParser();
  p.onEnd = () => t.pass();

  p.write('"test"');
});

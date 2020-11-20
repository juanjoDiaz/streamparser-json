import tap from "tap";
import JSONParser from "../src/jsonparser";
import Tokenizer from "../src/tokenizer";
import TokenParser from "../src/tokenparser";
import { TokenType } from "../src/utils/constants";

const { test } = tap;

test("should error on missing onToken callback", (t) => {
  t.plan(1);

  const p = new Tokenizer();

  try {
    p.write('"test"');
    t.fail("Expected to fail");
  } catch (e) {
    t.pass();
  }
});

test("should throw if missing onError callback", (t) => {
  t.plan(1);

  const p = new TokenParser();
  p.end();

  try {
    p.write(TokenType.TRUE, true);
    t.fail("Expected to fail");
  } catch (e) {
    t.pass();
  }
});

test("should error on missing onValue callback", (t) => {
  t.plan(1);

  const p = new JSONParser();

  try {
    p.write('"test"');
    t.fail("Expected to fail");
  } catch (e) {
    t.pass();
  }
});

test("should handle invalid input using the onError callback if set", (t) => {
  t.plan(1);

  const p = new JSONParser();
  p.onValue = () => {
    /* Do nothing */
  };
  p.onError = (err) =>
    t.equal(
      err.message,
      "Unexpected type. The `write` function only accepts Arrays, TypedArrays and Strings."
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  p.write(745674 as any);
});

test("should handle errors using the onError callback if set", (t) => {
  t.plan(1);

  const p = new JSONParser();
  p.onValue = () => {
    /* Do nothing */
  };
  p.onError = (err) =>
    t.equal(err.message, 'Unexpected "t" at position "2" in state ENDED');

  p.write('""test""');
});

test("should handle processing end using the onEnd callback if set", (t) => {
  t.plan(1);

  const p = new JSONParser();
  p.onValue = () => {
    /* Do nothing */
  };
  p.onEnd = () => t.pass();

  p.write('"test"');
});

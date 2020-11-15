import tap from "tap";
import JsonParser from "../src/jsonparse";
import { charset } from "../src/utils/utf-8";

const { test } = tap;
const { LATIN_SMALL_LETTER_A, QUOTATION_MARK, DIGIT_ONE } = charset;

const quote = String.fromCharCode(QUOTATION_MARK);

test("can handle large strings without running out of memory", (t) => {
  t.plan(1);

  const chunkSize = 1024;
  const chunks = 1024 * 200; // 200mb

  const p = new JsonParser({ stringBufferSize: 64 * 1024 });
  p.onToken = (type, value) =>
    t.equal(
      value.length,
      chunkSize * chunks,
      "token should be size of input json",
    );

  p.write(quote);
  Array(chunks).fill(new Uint8Array(chunkSize).fill(LATIN_SMALL_LETTER_A))
    .forEach((buffer) => p.write(buffer));
  p.write(quote);
});

test("can handle large numbers without running out of memory", (t) => {
  t.plan(1);

  const chunkSize = 1024;
  const chunks = 1024 * 200; // 200mb

  const p = new JsonParser({ numberBufferSize: 64 * 1024 });
  p.onToken = (type, value) =>
    t.equal(value, 1.1111111111111112, "token should be correct");

  p.write("1.");
  Array(chunks)
    .fill(new Uint8Array(chunkSize).fill(DIGIT_ONE))
    .forEach((buffer) => p.write(buffer));
  p.write(" ");
});

test("can handle multi-byte unicode splits", (t) => {
  t.plan(1);

  const p = new JsonParser({ numberBufferSize: 1 });
  p.onToken = (type, value) => t.equal(value, "𠜎");

  p.write('"𠜎"');
});

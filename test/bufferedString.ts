import tap from "tap";
import JsonParser from "../src/jsonparse";
import { charset } from "../src/utils/utf-8";

const { test } = tap;
const { LATIN_SMALL_LETTER_A, QUOTATION_MARK, DIGIT_ONE } = charset;

const quote = String.fromCharCode(QUOTATION_MARK);

test("can handle large strings without running out of memory", (t) => {
  const parser = new JsonParser({ stringBufferSize: 64 * 1024 });
  const chunkSize = 1024;
  const chunks = 1024 * 200; // 200mb
  t.plan(1);

  parser.onToken = (type, value) =>
    t.equal(
      value.length,
      chunkSize * chunks,
      "token should be size of input json",
    );

  parser.write(quote);
  Array(chunks).fill(new Uint8Array(chunkSize).fill(LATIN_SMALL_LETTER_A))
    .forEach((buffer) => parser.write(buffer));
  parser.write(quote);
});

test("can handle large numbers without running out of memory", (t) => {
  const parser = new JsonParser({ numberBufferSize: 64 * 1024 });
  const chunkSize = 1024;
  const chunks = 1024 * 200; // 200mb
  t.plan(1);

  parser.onToken = (type, value) =>
    t.equal(value, 1.1111111111111112, "token should be correct");

  parser.write("1.");
  Array(chunks).fill(new Uint8Array(chunkSize).fill(DIGIT_ONE)).forEach(
    (buffer) => parser.write(buffer),
  );
  parser.write(" ");
});

test("can handle multi-byte unicode splits", (t) => {
  const parser = new JsonParser({ numberBufferSize: 1 });
  t.plan(1);

  parser.onToken = (type, value) => t.equal(value, "𠜎");

  parser.write('"𠜎"');
});

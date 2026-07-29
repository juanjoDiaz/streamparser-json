import TokenType from "@streamparser/json/utils/types/tokenType.js";
import JSONParser from "../src/jsonparser.js";
import Tokenizer from "../src/tokenizer.js";
import TokenParser from "../src/tokenparser.js";
import { runJSONParserTest } from "./utils/testRunner.js";

describe("end", () => {
  test("should fail if writing after ending", async () => {
    const p = new JSONParser({ separator: "" });
    const reader = p.readable.getReader();
    const writer = p.writable.getWriter();

    // Drain the output so the write/close below aren't held by backpressure.
    const drain = (async () => {
      try {
        let done = false;
        while (!done) {
          done = (await reader.read()).done;
        }
      } catch {
        /* stream closed */
      }
    })();

    await writer.write('"test"');
    await writer.close();
    await drain;

    // Writing after the stream is closed must reject. (Capture the rejection
    // rather than asserting its type: the error comes from the WHATWG stream
    // internals and isn't `instanceof` this realm's Error under jest.)
    const writeError = await writer
      .write('"test"')
      .then(() => undefined)
      .catch((err) => err);
    expect(writeError).toBeTruthy();
  });

  const autoEndValues = ["2 2", "2.33456{}", "{}{}{}"];

  autoEndValues.forEach((value) => {
    test(`should auto-end after emiting one object: ${value}`, async () => {
      const p = new JSONParser();

      expect.assertions(1);
      try {
        await runJSONParserTest(p, [value]);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });

  const numberValues = [
    "0",
    "2",
    "2.33456",
    "2.33456e+1",
    "-2",
    "-2.33456",
    "-2.33456e+1",
  ];

  numberValues.forEach((numberValue) => {
    test(`should emit numbers if ending on a valid number: ${numberValue}`, async () => {
      const p = new JSONParser({ separator: "" });

      await runJSONParserTest(p, [numberValue], ({ value }) =>
        expect(value).toEqual(JSON.parse(numberValue)),
      );
    });
  });

  const endingFailingValues = [
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

  endingFailingValues.forEach((value) => {
    test(`should fail if ending in the middle of parsing: ${value}`, async () => {
      const p = new JSONParser();

      expect.assertions(1);
      try {
        await runJSONParserTest(p, [value]);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });

  test("should not fail if ending waiting for a separator", async () => {
    const separator = "\n";
    const p = new JSONParser({ separator });

    await runJSONParserTest(p, ["1", separator, "2"]);
  });

  test("should let the writer close() normally after the root value has completed", async () => {
    const p = new JSONParser();
    const writer = p.writable.getWriter();
    const reader = p.readable.getReader();

    const values: unknown[] = [];
    const readLoop = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        values.push(value.value);
      }
    })();

    await writer.write("{}");
    await writer.close();
    await readLoop;

    expect(values).toEqual([{}]);
  });

  test("should let the writer close() normally after the root token has completed (TokenParser)", async () => {
    const p = new TokenParser({});
    const writer = p.writable.getWriter();
    const reader = p.readable.getReader();

    const values: unknown[] = [];
    const readLoop = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        values.push(value.value);
      }
    })();

    await writer.write({ token: TokenType.TRUE, value: true });
    await writer.close();
    await readLoop;

    expect(values).toEqual([true]);
  });

  test("should let the writer close() normally after a token has completed (Tokenizer)", async () => {
    const p = new Tokenizer({});
    const writer = p.writable.getWriter();
    const reader = p.readable.getReader();

    const values: unknown[] = [];
    const readLoop = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        values.push(value.value);
      }
    })();

    await writer.write("true");
    await writer.close();
    await readLoop;

    expect(values).toEqual([true]);
  });
});

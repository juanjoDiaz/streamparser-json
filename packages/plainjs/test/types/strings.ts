import { runJSONParserTest } from "../utils/testRunner.js";
import JSONParser from "../../src/jsonparser.js";
import { charset } from "../../src/utils/utf-8.js";

const quote = String.fromCharCode(charset.QUOTATION_MARK);

describe("string", () => {
  const values = [
    "Hello world!",
    '\\r\\n\\f\\t\\\\\\/\\"',
    "\\u039b\\u03ac\\u03bc\\u03b2\\u03b4\\u03b1",
    "☃",
    "├──",
    "snow: ☃!",
    "õ",
  ];

  const bufferSizes = [0, 1, 64 * 1024];

  bufferSizes.forEach((stringBufferSize) => {
    values.forEach((stringValue) => {
      test(`${stringValue} (bufferSize ${stringBufferSize})`, async () => {
        await runJSONParserTest(
          new JSONParser({ stringBufferSize }),
          [quote, stringValue, quote],
          ({ value }) => expect(value).toEqual(JSON.parse(`"${stringValue}"`)),
        );
      });

      test(`${stringValue} (chunked, bufferSize ${stringBufferSize})`, async () => {
        await runJSONParserTest(
          new JSONParser({ stringBufferSize }),
          [quote, ...(stringValue as string).split(""), quote],
          ({ value }) => expect(value).toEqual(JSON.parse(`"${stringValue}"`)),
        );
      });
    });

    describe("multibyte characters", () => {
      test("2 byte utf8 'De' character: д", async () => {
        await runJSONParserTest(
          new JSONParser({ stringBufferSize }),
          [quote, new Uint8Array([0xd0, 0xb4]), quote],
          ({ value }) => expect(value).toEqual("д"),
        );
      });

      test("3 byte utf8 'Han' character: 我", async () => {
        await runJSONParserTest(
          new JSONParser({ stringBufferSize }),
          [quote, new Uint8Array([0xe6, 0x88, 0x91]), quote],
          ({ value }) => expect(value).toEqual("我"),
        );
      });

      test("4 byte utf8 character (unicode scalar U+2070E): 𠜎", async () => {
        await runJSONParserTest(
          new JSONParser({ stringBufferSize }),
          [quote, new Uint8Array([0xf0, 0xa0, 0x9c, 0x8e]), quote],
          ({ value }) => expect(value).toEqual("𠜎"),
        );
      });

      describe("chunking", () => {
        test("2 byte utf8 'De' character chunked inbetween 1st and 3nd byte: д", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [quote, new Uint8Array([0xd0]), new Uint8Array([0xb4]), quote],
            ({ value }) => expect(value).toEqual("д"),
          );
        });

        test("3 byte utf8 'Han' character chunked inbetween 2nd and 3rd byte: 我", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [
              quote,
              new Uint8Array([0xe6, 0x88]),
              new Uint8Array([0x91]),
              quote,
            ],
            ({ value }) => expect(value).toEqual("我"),
          );
        });

        test("4 byte utf8 character (unicode scalar U+2070E) chunked inbetween 2nd and 3rd byte: 𠜎", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [
              quote,
              new Uint8Array([0xf0, 0xa0]),
              new Uint8Array([0x9c, 0x8e]),
              quote,
            ],
            ({ value }) => expect(value).toEqual("𠜎"),
          );
        });

        test("1-4 byte utf8 character string chunked inbetween random bytes: Aж文𠜱B", async () => {
          const eclectic_buffer = new Uint8Array([
            0x41, // A
            0xd0,
            0xb6, // ж
            0xe6,
            0x96,
            0x87, // 文
            0xf0,
            0xa0,
            0x9c,
            0xb1, // 𠜱
            0x42,
          ]); // B

          for (let i = 0; i < 11; i++) {
            const firstBuffer = eclectic_buffer.slice(0, i);
            const secondBuffer = eclectic_buffer.slice(i);
            await runJSONParserTest(
              new JSONParser({ stringBufferSize }),
              [quote, firstBuffer, secondBuffer, quote],
              ({ value }) => expect(value).toEqual("Aж文𠜱B"),
            );
          }
        });

        test("2 byte utf8 'De' character split one byte per write: д", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [quote, new Uint8Array([0xd0]), new Uint8Array([0xb4]), quote],
            ({ value }) => expect(value).toEqual("д"),
          );
        });

        test("3 byte utf8 'Han' character split one byte per write: 我", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [
              quote,
              new Uint8Array([0xe6]),
              new Uint8Array([0x88]),
              new Uint8Array([0x91]),
              quote,
            ],
            ({ value }) => expect(value).toEqual("我"),
          );
        });

        test("4 byte utf8 character split one byte per write (unicode scalar U+2070E): 𠜎", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [
              quote,
              new Uint8Array([0xf0]),
              new Uint8Array([0xa0]),
              new Uint8Array([0x9c]),
              new Uint8Array([0x8e]),
              quote,
            ],
            ({ value }) => expect(value).toEqual("𠜎"),
          );
        });

        test("4 byte utf8 character split across three writes (2+1+1) surrounded by other text: a😀b", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [
              quote,
              "a",
              new Uint8Array([0xf0, 0x9f]),
              new Uint8Array([0x98]),
              new Uint8Array([0x80]),
              "b",
              quote,
            ],
            ({ value }) => expect(value).toEqual("a😀b"),
          );
        });
      });

      describe("invalid utf8", () => {
        const invalidSequences = [
          {
            name: "2-byte lead followed by a non-continuation byte",
            bytes: [0xc2, 0x41],
          },
          {
            name: "3-byte lead followed by only one continuation byte",
            bytes: [0xe6, 0x88],
          },
          {
            name: "bare continuation byte with no lead byte",
            bytes: [0x80],
          },
          {
            name: "overlong-encoding lead byte (0xC0)",
            bytes: [0xc0, 0x80],
          },
          {
            name: "invalid lead byte (0xC1)",
            bytes: [0xc1, 0x80],
          },
          {
            name: "4-byte lead with a non-continuation 3rd byte",
            bytes: [0xf0, 0xa0, 0x9c, 0x41],
          },
        ];

        invalidSequences.forEach(({ name, bytes }) => {
          test(`rejects rather than silently replacing: ${name}`, async () => {
            let didThrow = false;
            try {
              await runJSONParserTest(new JSONParser({ stringBufferSize }), [
                quote,
                new Uint8Array(bytes),
                quote,
              ]);
            } catch {
              didThrow = true;
            }
            expect(didThrow).toEqual(true);
          });
        });
      });

      describe("surrogate", () => {
        test("parse surrogate pair", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [quote, "\\uD83D\\uDE0B", quote],
            ({ value }) => expect(value).toEqual("😋"),
          );
        });

        test("surrogate pair (chunked)", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [quote, "\\uD83D", "\\uDE0B", quote],
            ({ value }) => expect(value).toEqual("😋"),
          );
        });

        test("raw (non-escaped) surrogate pair split across two separate string writes", async () => {
          const emoji = "😋"; // U+1F60B, a surrogate pair in JS string form
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [`${quote}a${emoji[0]}`, `${emoji[1]}b${quote}`],
            ({ value }) => expect(value).toEqual(`a${emoji}b`),
          );
        });

        test("raw (non-escaped) surrogate pair split one character at a time", async () => {
          const emoji = "😋";
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [quote, "a", emoji[0], emoji[1], "b", quote],
            ({ value }) => expect(value).toEqual(`a${emoji}b`),
          );
        });

        test("high surrogate not followed by a low surrogate is kept as-is, matching JSON.parse", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [quote, "\\uD83D\\uEFFF", quote],
            ({ value }) =>
              expect(value).toEqual(JSON.parse('"\\uD83D\\uEFFF"')),
          );
        });

        test("lone high surrogate followed by a plain character is kept as-is, matching JSON.parse", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [quote, "\\uD800x", quote],
            ({ value }) => expect(value).toEqual(JSON.parse('"\\uD800x"')),
          );
        });

        test("lone high surrogate at the end of the string is kept as-is, matching JSON.parse", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [quote, "\\uD800", quote],
            ({ value }) => expect(value).toEqual(JSON.parse('"\\uD800"')),
          );
        });

        test("lone low surrogate is kept as-is, matching JSON.parse", async () => {
          await runJSONParserTest(
            new JSONParser({ stringBufferSize }),
            [quote, "\\uDC00", quote],
            ({ value }) => expect(value).toEqual(JSON.parse('"\\uDC00"')),
          );
        });
      });
    });
  });

  test("should flush the buffer if there is not space for incoming data", async () => {
    await runJSONParserTest(
      new JSONParser({ stringBufferSize: 1 }),
      [quote, "aaaa", "𠜎", quote],
      ({ value }) => expect(value).toEqual("aaaa𠜎"),
    );
  });

  const invalidValues = [
    '"\n"',
    '"\\j"',
    '"\\ua"',
    '"\\u1*"',
    '"\\u12*"',
    "\\u123*",
    '"\0"',
    '"\\uG"',
    '"\\u000G"',
  ];

  invalidValues.forEach((value) => {
    test(`fail on invalid values ${value}`, async () => {
      expect.assertions(1);
      try {
        await runJSONParserTest(new JSONParser(), value);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
  });

  // The tokenizer decodes a run of multi-byte characters in one appendBuf
  // rather than one character at a time. When a string is buffered
  // (stringBufferSize) that hands BufferedString a span larger than its buffer
  // -- a case that used to throw ("offset is out of bounds") because it only
  // ever received 2-4 byte spans before. Use a small buffer so the multi-byte
  // run comfortably exceeds it.
  describe("multi-byte run larger than the string buffer", () => {
    test("pure multi-byte string exceeding the buffer decodes correctly", async () => {
      const str = "文".repeat(1000); // 3000 bytes, >> 64 byte buffer
      await runJSONParserTest(
        new JSONParser({ stringBufferSize: 64 }),
        [quote, str, quote],
        ({ value }) => expect(value).toEqual(str),
      );
    });

    test("ASCII buffered then a large multi-byte span flushes in order", async () => {
      // 50 ASCII bytes fit in the 64-byte buffer, then a 3000-byte multi-byte
      // span forces a flush followed by an oversized-span decode.
      const str = "a".repeat(50) + "文".repeat(1000);
      await runJSONParserTest(
        new JSONParser({ stringBufferSize: 64 }),
        [quote, str, quote],
        ({ value }) => expect(value).toEqual(str),
      );
    });

    test("large multi-byte run split across chunks after complete chars", async () => {
      // Several complete 3-byte chars, then a char split across the boundary,
      // exercising the span path plus the STRING_INCOMPLETE_CHAR carry-over.
      const bytes = new TextEncoder().encode("文".repeat(500)); // 1500 bytes
      await runJSONParserTest(
        new JSONParser({ stringBufferSize: 64 }),
        [quote, bytes.slice(0, 700), bytes.slice(700), quote],
        ({ value }) => expect(value).toEqual("文".repeat(500)),
      );
    });
  });
});

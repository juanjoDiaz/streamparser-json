import tap from "tap";
import JSONParser from "../../src/jsonparser";
import { charset } from "../../src/utils/utf-8";

const { test } = tap;

const { QUOTATION_MARK } = charset;

const quote = String.fromCharCode(QUOTATION_MARK);

for (const stringBufferSize of [0, 64 * 1024]) {
  const values = [
    "Hello world!",
    '\\r\\n\\f\\t\\\\\\/\\"',
    "\\u039b\\u03ac\\u03bc\\u03b2\\u03b4\\u03b1",
    "☃",
    "├──",
    "snow: ☃!",
    "õ",
  ];
  const expected = values.map((str) => JSON.parse(`"${str}"`));

  test(`simple string with stringBufferSize = ${stringBufferSize}`, (t) => {
    t.plan(expected.length);

    let i = 0;

    values.forEach((str) => {
      const p = new JSONParser({ stringBufferSize });
      p.onValue = (value) => {
        t.equal(
          value,
          expected[i],
          `Error on expectation ${i} (${value} !== ${expected[i]})`
        );
        i += 1;
      };

      p.write(quote);
      str.split("").forEach((c) => p.write(c));
      p.write(quote);
    });
  });

  test("multibyte characters", (t) => {
    t.plan(5);

    t.test("2 byte utf8 'De' character: д", (t) => {
      t.plan(1);

      const p = new JSONParser({ stringBufferSize });
      p.onValue = (value) => t.equal(value, "д");

      p.write(quote);
      p.write(new Uint8Array([0xd0, 0xb4]));
      p.write(quote);
    });

    t.test("3 byte utf8 'Han' character: 我", (t) => {
      t.plan(1);

      const p = new JSONParser({ stringBufferSize });
      p.onValue = (value) => t.equal(value, "我");

      p.write(quote);
      p.write(new Uint8Array([0xe6, 0x88, 0x91]));
      p.write(quote);
    });

    t.test("4 byte utf8 character (unicode scalar U+2070E): 𠜎", (t) => {
      t.plan(1);

      const p = new JSONParser({ stringBufferSize });
      p.onValue = (value) => t.equal(value, "𠜎");

      p.write(quote);
      p.write(new Uint8Array([0xf0, 0xa0, 0x9c, 0x8e]));
      p.write(quote);
    });

    t.test("chunking", (t) => {
      t.plan(4);

      t.test(
        "2 byte utf8 'De' character chunked inbetween 1st and 3nd byte: д",
        (t) => {
          t.plan(1);

          const p = new JSONParser({ stringBufferSize });
          p.onValue = (value) => t.equal(value, "д");

          p.write(quote);
          p.write(new Uint8Array([0xd0]));
          p.write(new Uint8Array([0xb4]));
          p.write(quote);
        }
      );

      t.test(
        "3 byte utf8 'Han' character chunked inbetween 2nd and 3rd byte: 我",
        (t) => {
          t.plan(1);

          const p = new JSONParser({ stringBufferSize });
          p.onValue = (value) => t.equal(value, "我");

          p.write(quote);
          p.write(new Uint8Array([0xe6, 0x88]));
          p.write(new Uint8Array([0x91]));
          p.write(quote);
        }
      );

      t.test(
        "4 byte utf8 character (unicode scalar U+2070E) chunked inbetween 2nd and 3rd byte: 𠜎",
        (t) => {
          t.plan(1);

          const p = new JSONParser({ stringBufferSize });
          p.onValue = (value) => t.equal(value, "𠜎");

          p.write(quote);
          p.write(new Uint8Array([0xf0, 0xa0]));
          p.write(new Uint8Array([0x9c, 0x8e]));
          p.write(quote);
        }
      );

      t.test(
        "1-4 byte utf8 character string chunked inbetween random bytes: Aж文𠜱B",
        (t) => {
          t.plan(11);

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
            const p = new JSONParser({ stringBufferSize });
            p.onValue = (value) => t.equal(value, "Aж文𠜱B");

            const first_buffer = eclectic_buffer.slice(0, i);
            const second_buffer = eclectic_buffer.slice(i);
            p.write(quote);
            p.write(first_buffer);
            p.write(second_buffer);
            p.write(quote);
          }
        }
      );
    });

    t.test("surrogate", (t) => {
      t.plan(3);

      t.test("parse surrogate pair", (t) => {
        t.plan(1);

        const p = new JSONParser({ stringBufferSize });
        p.onValue = (value) => t.equal(value, "😋");

        p.write('"\\uD83D\\uDE0B"');
      });

      t.test("parse chunked surrogate pair", (t) => {
        t.plan(1);

        const p = new JSONParser({ stringBufferSize });
        p.onValue = (value) => t.equal(value, "😋");

        p.write(quote);
        p.write("\\uD83D");
        p.write("\\uDE0B");
        p.write(quote);
      });

      t.test("not error on broken surrogate pair", (t) => {
        t.plan(1);

        const p = new JSONParser({ stringBufferSize });
        p.onValue = (value) => t.equal(value, "�");

        p.write(quote);
        p.write("\\uD83D\\uEFFF");
        p.write(quote);
      });
    });
  });
}

test("should flush the buffer if there is not space for incoming data", (t) => {
  t.plan(1);

  const p = new JSONParser({ stringBufferSize: 5 });
  p.onValue = (value) => t.equal(value, "aaaa𠜎");

  p.write(quote);
  p.write("aaaa");
  p.write("𠜎");
  p.write(quote);
});

test("fail on invalid values", (t) => {
  const values = ["\n", "\\j", "\\ua", "\\u1*", "\\u12*", "\\u123*"];

  t.plan(values.length);

  values.forEach((str) => {
    const p = new JSONParser();
    p.onValue = () => {
      /* Do nothing */
    };

    try {
      p.write(quote);
      p.write(str);
      p.write(quote);
      t.fail("Expected to fail");
    } catch (e) {
      t.pass();
    }
  });
});

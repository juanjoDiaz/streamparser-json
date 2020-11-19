import tap from "tap";
import JSONParser from "../../src/jsonparser";

const { test } = tap;

const values = [
  "0",
  "0e1",
  "0e+1",
  "0e-1",
  "0.123",
  "0.123e00",
  "0.123e+1",
  "0.123e-1",
  "0.123E00",
  "0.123E+1",
  "0.123E-1",
  "-0",
  "-0e1",
  "-0e+1",
  "-0e-1",
  "-0.123",
  "-0.123e00",
  "-0.123e+1",
  "-0.123e-1",
  "-0.123E00",
  "-0.123E+1",
  "-0.123E-1",
  "-123",
  "-123e1",
  "-123e+1",
  "-123e-1",
  "-123.123",
  "-123.123e00",
  "-123.123e+1",
  "-123.123e-1",
  "-123.123E00",
  "-123.123E+1",
  "-123.123E-1",
  "123",
  "123e1",
  "123e+1",
  "123e-1",
  "123.123",
  "123.123e00",
  "123.123e+1",
  "123.123e-1",
  "123.123E00",
  "123.123E+1",
  "123.123E-1",
  "7161093205057351174",
  "21e999",
];
const expected = values.map((str) => JSON.parse(str));

for (const numberBufferSize of [0, 64 * 1024]) {
  test("number", (t) => {
    t.plan(expected.length);

    let i = 0;

    values.forEach((str) => {
      const p = new JSONParser({ numberBufferSize });
      p.onValue = (value) => {
        t.equal(
          value,
          expected[i],
          `Error on expectation ${i} (${value} !== ${expected[i]})`
        );
        i += 1;
      };

      p.write(str);
      p.end();
    });
  });

  test("number chuncked", (t) => {
    t.plan(expected.length);
    let i = 0;

    values.forEach((str) => {
      const p = new JSONParser({ numberBufferSize });
      p.onValue = (value) => {
        t.equal(
          value,
          expected[i],
          `Error on expectation ${i} (${value} !== ${expected[i]})`
        );
        i += 1;
      };

      str.split("").forEach((c) => p.write(c));
      p.end();
    });
  });
}

test("fail on invalid values", (t) => {
  const values = ["-a", "-e", "1a", "1.a", "1.e", "1.-", "1.0ea", "1.0e1.2"];

  t.plan(values.length);

  values.forEach((str) => {
    const p = new JSONParser();
    p.onValue = () => {
      /* Do nothing */
    };

    try {
      p.write(str);
      t.fail(`Expected to fail on value "${str}"`);
    } catch (e) {
      t.pass();
    }
  });
});

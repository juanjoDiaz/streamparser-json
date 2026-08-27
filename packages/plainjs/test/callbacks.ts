import JSONParser from "../src/jsonparser.js";
import Tokenizer from "../src/tokenizer.js";
import TokenParser from "../src/tokenparser.js";

describe("callback", () => {
  test("should error on missing onToken callback", () => {
    const p = new Tokenizer();

    expect.assertions(1);
    try {
      p.write('"test"');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  test("should error if missing onError callback", () => {
    const p = new TokenParser();

    expect.assertions(1);
    try {
      p.end();
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  test("should error on missing onValue callback", () => {
    const p = new JSONParser();

    expect.assertions(1);
    try {
      p.write('"test"');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  test("should emit onValue callback when the onToken callback is also set", () => {
    const p = new JSONParser();

    const onValueCb = vi.fn(() => {
      /* Do nothing */
    });
    p.onValue = onValueCb;
    p.onToken = () => {
      /* Do nothing */
    };

    p.write('"test"');
    expect(onValueCb.mock.calls).toHaveLength(1);
    expect(
      (onValueCb.mock.calls[0] as unknown as [{ value: string }])[0].value,
    ).toBe("test");
  });

  test("should handle invalid input using the onError callback if set", () => {
    const p = new JSONParser();
    p.onValue = () => {
      /* Do nothing */
    };
    p.onError = (err) =>
      expect(err.message).toEqual(
        "Unexpected type. The `write` function only accepts Iterables (e.g. Arrays, Sets, Generators), TypedArrays and Strings.",
      );

    p.write(745674 as any);
  });

  test("should handle parsing errors using the onError callback if set", () => {
    const p = new JSONParser();
    p.onValue = () => {
      /* Do nothing */
    };
    p.onError = (err) =>
      expect(err.message).toEqual(
        'Unexpected "t" at chunk position "2" (absolute position "2") in state ENDED',
      );

    p.write('""test""');
  });

  test("should report a stream-absolute error position spanning multiple writes", () => {
    const p = new JSONParser();
    p.onValue = () => {
      /* Do nothing */
    };
    let errMsg: string | undefined;
    p.onError = (err) => {
      errMsg = err.message;
    };

    p.write("          "); // 10 bytes of valid leading whitespace
    p.write("   X"); // invalid byte at local index 3, absolute index 13

    expect(errMsg).toEqual(
      'Unexpected "X" at chunk position "3" (absolute position "13") in state BOM_OR_START',
    );
  });

  test("should handle errors on callbacks using the onError callback if set", () => {
    const p = new JSONParser();
    p.onValue = () => {
      throw new Error("Unexpected error in onValue callback");
    };
    p.onError = (err) =>
      expect(err.message).toEqual("Unexpected error in onValue callback");

    p.write('"test"');
  });

  test("should handle errors on callbacks using the onError callback if set (tokenizer)", () => {
    const p = new Tokenizer();
    p.onToken = () => {
      throw new Error("Unexpected error in onValue callback");
    };
    p.onError = (err) =>
      expect(err.message).toEqual("Unexpected error in onValue callback");

    p.write('"test"');
  });

  test("should handle processing end using the onEnd callback if set", () =>
    new Promise<void>((resolve) => {
      const p = new JSONParser();
      p.onValue = () => {
        /* Do nothing */
      };
      p.onEnd = () => resolve();

      p.write('"test"');
    }));

  test("should use default onEnd callback if none set up", () => {
    const p = new Tokenizer();
    p.onToken = () => {
      /* Do nothing */
    };

    p.write("1");
    p.end();

    expect(p.isEnded).toBeTruthy();
  });

  test("should not fail if ending while the underlying tokenizer is already ended", () => {
    const separator = "\n";

    const p = new JSONParser({ separator });
    p.onValue = () => {
      /* Do nothing */
    };
    p.onEnd = () => {
      /* Do nothing */
    };

    p.write("{}");
    p.end();

    expect(p.isEnded).toBeTruthy();
  });
});

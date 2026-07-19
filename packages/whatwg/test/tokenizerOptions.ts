import Tokenizer from "../src/tokenizer.js";

describe("tokenizer options", () => {
  describe("stringBufferSize / numberBufferSize validation", () => {
    // A non-integer buffer size (e.g. 0.5) silently becomes a zero-length
    // Uint8Array (`new Uint8Array(0.5).length === 0`) instead of throwing,
    // so every appended byte would be silently dropped rather than
    // buffered -- corrupting the parsed value instead of failing loudly.
    const invalidSizes = [0.5, 4.9, -1, -0.5, NaN, Infinity];

    invalidSizes.forEach((size) => {
      test(`rejects stringBufferSize: ${size}`, () => {
        expect(() => new Tokenizer({ stringBufferSize: size })).toThrow();
      });

      test(`rejects numberBufferSize: ${size}`, () => {
        expect(() => new Tokenizer({ numberBufferSize: size })).toThrow();
      });
    });

    const validSizes = [0, 1, 3, 64, 64 * 1024];

    validSizes.forEach((size) => {
      test(`accepts stringBufferSize: ${size}`, () => {
        expect(() => new Tokenizer({ stringBufferSize: size })).not.toThrow();
      });

      test(`accepts numberBufferSize: ${size}`, () => {
        expect(() => new Tokenizer({ numberBufferSize: size })).not.toThrow();
      });
    });

    test("accepts undefined (default) buffer sizes", () => {
      expect(() => new Tokenizer({})).not.toThrow();
      expect(() => new Tokenizer()).not.toThrow();
    });
  });
});

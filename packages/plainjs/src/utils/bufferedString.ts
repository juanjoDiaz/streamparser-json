/**
 * The accumulators that the tokenizer gathers strings and numbers into while
 * their bytes arrive.
 *
 * @module
 */

/**
 * An accumulator of utf-8 bytes that can be turned into a string.
 *
 * The tokenizer uses one of these per string and number token, since a value
 * can be split across any number of `write()` calls.
 */
export interface StringBuilder {
  /** How many bytes have been appended since the last {@linkcode StringBuilder.reset}. */
  byteLength: number;
  /** Appends a single-byte (ASCII) character. */
  appendChar: (char: number) => void;
  /** Appends the utf-8 bytes in `buf` between `start` and `end`, which must not cut through a character. */
  appendBuf: (buf: Uint8Array, start?: number, end?: number) => void;
  // Appends a raw UTF-16 code unit directly to the string, bypassing
  // UTF-8 encoding entirely. Needed for unpaired surrogates: they are
  // valid to hold in a JS string (JS strings are just UTF-16 code unit
  // sequences) but have no valid UTF-8 byte representation, so
  // TextEncoder/TextDecoder round-tripping would replace them with
  // U+FFFD. Does not affect byteLength -- callers that use this must
  // account for the source bytes consumed themselves.
  appendCharCode: (code: number) => void;
  /** Discards everything appended so far, so the builder can be reused for the next token. */
  reset: () => void;
  /** The string that the appended bytes decode to. */
  toString: () => string;
}

/**
 * A {@linkcode StringBuilder} that accumulates the token as a JavaScript
 * string. This is the default: it's the fastest option for the small strings
 * and numbers that dominate real JSON.
 */
export class NonBufferedString implements StringBuilder {
  // fatal: true makes invalid byte sequences (e.g. a lead byte followed by a
  // non-continuation byte) throw instead of silently decoding to U+FFFD.
  private decoder = new TextDecoder("utf-8", { fatal: true });
  // Pieces appended since the last toString(), not yet folded into `string`.
  private pending: string[] = [];
  private string = "";
  public byteLength = 0;

  public appendChar(char: number): void {
    this.pending.push(String.fromCharCode(char));
    this.byteLength += 1;
  }

  public appendBuf(buf: Uint8Array, start = 0, end: number = buf.length): void {
    this.pending.push(this.decoder.decode(buf.subarray(start, end)));
    this.byteLength += end - start;
  }

  public appendCharCode(code: number): void {
    this.pending.push(String.fromCharCode(code));
  }

  public reset(): void {
    this.pending = [];
    this.string = "";
    this.byteLength = 0;
  }

  // Folds only the pieces appended since the last call into `string`, so
  // repeated calls (one per chunk when emitting partial tokens) stay linear
  // overall instead of re-joining the whole accumulated string every time.
  public toString(): string {
    if (this.pending.length > 0) {
      this.string += this.pending.join("");
      this.pending = [];
    }
    return this.string;
  }
}

/**
 * A {@linkcode StringBuilder} that accumulates the token's bytes into a
 * fixed-size `Uint8Array` and only decodes them once the buffer is full.
 *
 * Enabled through the tokenizer's `stringBufferSize`/`numberBufferSize`
 * options. It avoids V8's over-allocation on repeated string concatenation,
 * which is what makes very large strings and numbers exhaust memory, at the
 * cost of an encoding/decoding round trip that isn't worth it for small values.
 */
export class BufferedString implements StringBuilder {
  // fatal: true makes invalid byte sequences (e.g. a lead byte followed by a
  // non-continuation byte) throw instead of silently decoding to U+FFFD.
  private decoder = new TextDecoder("utf-8", { fatal: true });
  private buffer: Uint8Array;
  private bufferOffset = 0;
  private string = "";
  public byteLength = 0;

  /**
   * @param bufferSize The size, in bytes, of the buffer to accumulate into.
   */
  public constructor(bufferSize: number) {
    this.buffer = new Uint8Array(bufferSize);
  }

  public appendChar(char: number): void {
    if (this.bufferOffset >= this.buffer.length) this.flushStringBuffer();
    this.buffer[this.bufferOffset++] = char;
    this.byteLength += 1;
  }

  public appendBuf(buf: Uint8Array, start = 0, end: number = buf.length): void {
    const size = end - start;
    if (this.bufferOffset + size > this.buffer.length) this.flushStringBuffer();
    if (size > this.buffer.length) {
      // Span larger than the working buffer: decode it straight into the
      // string instead of copying it in (buffer.set would overflow). Safe
      // because callers only append complete-character spans -- the tokenizer
      // never splits a multi-byte char across appendBuf calls -- so decoding
      // this span on its own can't cut through the middle of a character.
      this.string += this.decoder.decode(buf.subarray(start, end));
      this.byteLength += size;
      return;
    }
    this.buffer.set(buf.subarray(start, end), this.bufferOffset);
    this.bufferOffset += size;
    this.byteLength += size;
  }

  public appendCharCode(code: number): void {
    this.flushStringBuffer();
    this.string += String.fromCharCode(code);
  }

  private flushStringBuffer(): void {
    this.string += this.decoder.decode(
      this.buffer.subarray(0, this.bufferOffset),
    );
    this.bufferOffset = 0;
  }

  public reset(): void {
    this.string = "";
    this.bufferOffset = 0;
    this.byteLength = 0;
  }
  public toString(): string {
    this.flushStringBuffer();
    return this.string;
  }
}

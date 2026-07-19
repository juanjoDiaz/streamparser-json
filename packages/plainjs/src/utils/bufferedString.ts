export interface StringBuilder {
  byteLength: number;
  appendChar: (char: number) => void;
  appendBuf: (buf: Uint8Array, start?: number, end?: number) => void;
  // Appends a raw UTF-16 code unit directly to the string, bypassing
  // UTF-8 encoding entirely. Needed for unpaired surrogates: they are
  // valid to hold in a JS string (JS strings are just UTF-16 code unit
  // sequences) but have no valid UTF-8 byte representation, so
  // TextEncoder/TextDecoder round-tripping would replace them with
  // U+FFFD. Does not affect byteLength -- callers that use this must
  // account for the source bytes consumed themselves.
  appendCharCode: (code: number) => void;
  reset: () => void;
  toString: () => string;
}

export class NonBufferedString implements StringBuilder {
  // fatal: true makes invalid byte sequences (e.g. a lead byte followed by a
  // non-continuation byte) throw instead of silently decoding to U+FFFD.
  private decoder = new TextDecoder("utf-8", { fatal: true });
  private strings: string[] = [];
  public byteLength = 0;

  public appendChar(char: number): void {
    this.strings.push(String.fromCharCode(char));
    this.byteLength += 1;
  }

  public appendBuf(buf: Uint8Array, start = 0, end: number = buf.length): void {
    this.strings.push(this.decoder.decode(buf.subarray(start, end)));
    this.byteLength += end - start;
  }

  public appendCharCode(code: number): void {
    this.strings.push(String.fromCharCode(code));
  }

  public reset(): void {
    this.strings = [];
    this.byteLength = 0;
  }

  public toString(): string {
    return this.strings.join("");
  }
}

export class BufferedString implements StringBuilder {
  // fatal: true makes invalid byte sequences (e.g. a lead byte followed by a
  // non-continuation byte) throw instead of silently decoding to U+FFFD.
  private decoder = new TextDecoder("utf-8", { fatal: true });
  private buffer: Uint8Array;
  private bufferOffset = 0;
  private string = "";
  public byteLength = 0;

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

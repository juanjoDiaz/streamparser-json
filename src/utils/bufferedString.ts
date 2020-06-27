export class NonBufferedString {
  private decoder: TextDecoder;
  private string: string;
  public byteLength: number;

  constructor() {
    this.decoder = new TextDecoder('utf-8');
    this.reset();
  }
  appendChar(char: number) {
    this.string += String.fromCharCode(char);
    this.byteLength += 1;
  }
  appendBuf(buf: Uint8Array, start: number = 0, end: number = buf.length) {
    this.string += this.decoder.decode(buf.subarray(start, end));
    this.byteLength += end - start;
  }
  reset() {
    this.string = "";
    this.byteLength = 0;
  }
  toString() {
    return this.string;
  }
}

export class BufferedString {
  private decoder: TextDecoder;
  private buffer: Uint8Array;
  private bufferOffset: number;
  private string: string;
  public byteLength: number;

  constructor(bufferSize: number) {
    this.decoder = new TextDecoder('utf-8');
    this.buffer = new Uint8Array(bufferSize);
    this.reset();
  }
  appendChar(char: number) {
    if (this.bufferOffset >= this.buffer.length) this.flushStringBuffer();
    this.buffer[this.bufferOffset++] = char;
    this.byteLength += 1;
  }
  appendBuf(buf: Uint8Array, start: number = 0, end: number = buf.length) {
    const size = end - start;
    if (this.bufferOffset + size > this.buffer.length) this.flushStringBuffer();
    this.buffer.set(buf.subarray(start, end), this.bufferOffset);
    this.bufferOffset += size;
    this.byteLength += size;
  }
  flushStringBuffer() {
    this.string += this.decoder.decode(this.buffer.subarray(0, this.bufferOffset));
    this.bufferOffset = 0;
  }
  reset() {
    this.string = "";
    this.bufferOffset = 0;
    this.byteLength = 0;
  }
  toString() {
    this.flushStringBuffer();
    return this.string;
  }
}

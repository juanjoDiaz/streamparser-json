class NonBufferedString {
  constructor() {
    this.string = undefined;
    this.decoder = new TextDecoder('utf-8');
  }
  appendChar(char) {
    this.string += String.fromCharCode(char);
  }
  appendBuf(buf, start = 0, end = buf.length) {
    this.string += this.decoder.decode(buf.subarray(start, end));
  }
  reset() {
    this.string = "";
  }
  toString() {
    return this.string;
  }
  byteLength() {
    let bytes = this.string.length;
    for (let i = this.string.length-1; i >= 0; i--) {
      const code = this.string.charCodeAt(i);
      if (code <= 0x7F) continue;
      else if (code <= 0x7FF) bytes += 1;
      else if (code <= 0xFFFF) bytes += 2;
      // else if (code <= 0xDFFF) i -= 1; //trail surrogate already removed by the tokenizer
    }
    return bytes;
  }
}

class BufferedString {
  constructor(bufferSize) {
    this.string = undefined;
    this.buffer = new Uint8Array(bufferSize);
    this.bufferOffset = 0;
    this.decoder = new TextDecoder('utf-8');
  }
  appendChar(char) {
    if (this.bufferOffset >= this.buffer.length) this.flushStringBuffer();
    this.buffer[this.bufferOffset++] = char;
  }
  appendBuf(buf, start = 0, end = buf.length) {
    const size = end - start;
    if (this.bufferOffset + size > this.buffer.length) this.flushStringBuffer();
    this.buffer.set(buf.subarray(start, end), this.bufferOffset);
    this.bufferOffset += size;
  }
  flushStringBuffer() {
    this.string += this.decoder.decode(this.buffer.subarray(0, this.bufferOffset));
    this.bufferOffset = 0;
  }
  reset() {
    this.string = "";
    this.bufferOffset = 0;
  }
  toString() {
    this.flushStringBuffer();
    return this.string;
  }
  byteLength() {
    let bytes = this.string.length;
    for (let i = this.string.length-1; i >= 0; i--) {
      const code = this.string.charCodeAt(i);
      if (code <= 0x7F) continue;
      else if (code <= 0x7FF) bytes += 1;
      else if (code <= 0xFFFF) bytes += 2;
      // else if (code <= 0xDFFF) i -= 1; //trail surrogate already removed by the tokenizer
    }
    return bytes;
  }
}

module.exports = {
  NonBufferedString,
  BufferedString,
};
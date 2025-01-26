import {
  Transform,
  type TransformOptions,
  type TransformCallback,
} from "stream";
import Tokenizer, {
  type TokenizerOptions,
} from "https://deno.land/x/streamparser_json@v0.0.22/tokenizer.ts";

export default class TokenizerTransform extends Transform {
  private tokenizer: Tokenizer;

  constructor(
    opts: TokenizerOptions = {},
    transformOpts: Omit<
      TransformOptions,
      "readableObjectMode" | "writableObjectMode"
    > = {},
  ) {
    super({
      ...transformOpts,
      writableObjectMode: true,
      readableObjectMode: true,
    });
    this.tokenizer = new Tokenizer(opts);

    this.tokenizer.onToken = (parsedTokenInfo) => this.push(parsedTokenInfo);
    this.tokenizer.onError = (err) => {
      throw err;
    };
    this.tokenizer.onEnd = () => {
      if (!this.writableEnded) this.end();
    };
  }

  /**
   * Main function that send data to the parser to be processed.
   *
   * @param {Buffer} chunk Incoming data
   * @param {String} encoding Encoding of the incoming data. Defaults to 'utf8'
   * @param {Function} done Called when the proceesing of the supplied chunk is done
   */
  override _transform(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chunk: any,
    encoding: BufferEncoding,
    done: TransformCallback,
  ): void {
    try {
      this.tokenizer.write(chunk);
      done();
    } catch (err: unknown) {
      done(err as Error);
    }
  }

  override _final(callback: (error?: Error | null) => void): void {
    try {
      if (!this.tokenizer.isEnded) this.tokenizer.end();
      callback();
    } catch (err: unknown) {
      callback(err as Error);
    }
  }
}

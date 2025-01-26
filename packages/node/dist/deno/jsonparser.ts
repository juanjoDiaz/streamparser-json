import {
  Transform,
  type TransformOptions,
  type TransformCallback,
} from "stream";
import { JSONParser, type JSONParserOptions } from "https://deno.land/x/streamparser_json@v0.0.22/index.ts";

export default class JSONParserTransform extends Transform {
  private jsonParser: JSONParser;

  constructor(
    opts: JSONParserOptions = {},
    transformOpts: Omit<
      TransformOptions,
      "readableObjectMode" | "writableObjectMode"
    > = {},
  ) {
    super({
      ...transformOpts,
      writableObjectMode: false,
      readableObjectMode: true,
    });
    this.jsonParser = new JSONParser(opts);

    this.jsonParser.onValue = (value) => this.push(value);
    this.jsonParser.onError = (err) => {
      throw err;
    };
    this.jsonParser.onEnd = () => {
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
      this.jsonParser.write(chunk);
      done();
    } catch (err: unknown) {
      done(err as Error);
    }
  }

  override _final(callback: (error?: Error | null) => void): void {
    try {
      if (!this.jsonParser.isEnded) this.jsonParser.end();
      callback();
    } catch (err: unknown) {
      callback(err as Error);
    }
  }
}

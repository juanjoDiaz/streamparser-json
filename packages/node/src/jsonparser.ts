import {
  Transform,
  type TransformOptions,
  type TransformCallback,
} from "stream";
import { JSONParser, type JSONParserOptions } from "@streamparser/json";
import { cloneParsedElementInfo } from "@streamparser/json/utils/cloneParsedElementInfo.js";

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

    // Snapshot lazily unless keepStack:false is set: with keepStack:true the
    // parser's containers are append-only, so a deferred snapshot is still
    // correct and avoids an O(n) copy on every event (see
    // cloneParsedElementInfo). keepStack:false empties them instead, so it
    // keeps the eager clone.
    const lazySnapshot = opts.keepStack !== false;
    this.jsonParser.onValue = (value) =>
      this.push(cloneParsedElementInfo(value, lazySnapshot));
    this.jsonParser.onError = (err) => {
      throw err;
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

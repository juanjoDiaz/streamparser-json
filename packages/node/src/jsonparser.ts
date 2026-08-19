/**
 * A Node.js `Transform` stream that parses a JSON stream into JSON values.
 *
 * @example
 * ```ts
 * import { createReadStream } from "node:fs";
 * import JSONParser from "@streamparser/json-node/jsonparser.js";
 *
 * const parser = new JSONParser({ paths: ["$.*"], keepStack: false });
 * parser.on("data", ({ value }) => {
 *   // process the value
 * });
 *
 * createReadStream("arrayOfObjects.json").pipe(parser);
 * ```
 *
 * @module
 */

import {
  Transform,
  type TransformCallback,
  type TransformOptions,
} from "node:stream";
import { JSONParser, type JSONParserOptions } from "@streamparser/json";
import { cloneParsedElementInfo } from "@streamparser/json/utils/cloneParsedElementInfo.js";

/**
 * A Node.js `Transform` stream that parses the JSON written to it and emits the
 * parsed values as objects, one `data` event per value.
 *
 * The emitted objects are `ParsedElementInfo`s, so the value itself is in their
 * `value` property. Unlike the underlying `@streamparser/json` parser, their
 * `parent` and `stack` are snapshots, safe to keep for as long as needed.
 *
 * @example
 * ```ts
 * import JSONParser from "@streamparser/json-node/jsonparser.js";
 *
 * const parser = new JSONParser();
 *
 * inputStream.pipe(parser).pipe(destinationStream);
 *
 * // Or using events to get the values
 * parser.on("data", ({ value }) => console.log(value));
 * parser.on("error", (err) => console.error(err));
 * parser.on("end", () => console.log("done"));
 * ```
 */
export default class JSONParserTransform extends Transform {
  private jsonParser: JSONParser;

  /**
   * @param opts How to tokenize and what to emit. See `JSONParserOptions`.
   * @param transformOpts The standard Node.js `Transform` stream options, except
   * the object modes, which this stream sets itself.
   */
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
   * @param chunk Incoming data
   * @param _encoding Encoding of the incoming data. Defaults to 'utf8'
   * @param done Called when the proceesing of the supplied chunk is done
   */
  override _transform(
    chunk: any,
    _encoding: BufferEncoding,
    done: TransformCallback,
  ): void {
    try {
      this.jsonParser.write(chunk);
      done();
    } catch (err: unknown) {
      done(err as Error);
    }
  }

  /**
   * Ends the parser once the input stream is over.
   *
   * @param callback Called when the parser is done, with the error if the JSON
   * document was left half-parsed.
   */
  override _final(callback: (error?: Error | null) => void): void {
    try {
      if (!this.jsonParser.isEnded) this.jsonParser.end();
      callback();
    } catch (err: unknown) {
      callback(err as Error);
    }
  }
}

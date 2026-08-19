/**
 * A Node.js `Transform` stream that assembles a stream of JSON tokens into JSON
 * values.
 *
 * @example
 * ```ts
 * import Tokenizer from "@streamparser/json-node/tokenizer.js";
 * import TokenParser from "@streamparser/json-node/tokenparser.js";
 *
 * const tokenParser = new TokenParser({ paths: ["$.*"] });
 * tokenParser.on("data", ({ value }) => {
 *   // process the value
 * });
 *
 * inputStream.pipe(new Tokenizer()).pipe(tokenParser);
 * ```
 *
 * @module
 */

import {
  Transform,
  type TransformCallback,
  type TransformOptions,
} from "node:stream";
import { TokenParser, type TokenParserOptions } from "@streamparser/json";
import { cloneParsedElementInfo } from "@streamparser/json/utils/cloneParsedElementInfo.js";

/**
 * A Node.js `Transform` stream that assembles the JSON tokens written to it into
 * JSON values and emits them as objects, one `data` event per value.
 *
 * It expects the tokens emitted by a `Tokenizer` stream. The emitted objects are
 * `ParsedElementInfo`s, so the value itself is in their `value` property, and
 * their `parent` and `stack` are snapshots, safe to keep for as long as needed.
 */
export default class TokenParserTransform extends Transform {
  private tokenParser: TokenParser;

  /**
   * @param opts What to emit and how. See `TokenParserOptions`.
   * @param transformOpts The standard Node.js `Transform` stream options, except
   * the object modes, which this stream sets itself.
   */
  constructor(
    opts: TokenParserOptions = {},
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
    this.tokenParser = new TokenParser(opts);

    this.tokenParser.onValue = (parsedElementInfo) =>
      this.push(cloneParsedElementInfo(parsedElementInfo));
    this.tokenParser.onError = (err) => {
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
      this.tokenParser.write(chunk);
      done();
    } catch (err: unknown) {
      done(err as Error);
    }
  }

  /**
   * Ends the token parser once the input stream is over.
   *
   * @param callback Called when the token parser is done, with the error if the
   * JSON document was left half-parsed.
   */
  override _final(callback: (error?: Error | null) => void): void {
    try {
      if (!this.tokenParser.isEnded) this.tokenParser.end();
      callback();
    } catch (err: unknown) {
      callback(err as Error);
    }
  }
}

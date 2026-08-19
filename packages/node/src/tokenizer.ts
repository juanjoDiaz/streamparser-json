/**
 * A Node.js `Transform` stream that tokenizes a JSON stream.
 *
 * @example
 * ```ts
 * import Tokenizer from "@streamparser/json-node/tokenizer.js";
 *
 * const tokenizer = new Tokenizer();
 * tokenizer.on("data", ({ token, value, offset }) => {
 *   // process the token
 * });
 *
 * inputStream.pipe(tokenizer);
 * ```
 *
 * @module
 */

import {
  Transform,
  type TransformCallback,
  type TransformOptions,
} from "node:stream";
import Tokenizer, {
  type TokenizerOptions,
} from "@streamparser/json/tokenizer.js";

/**
 * A Node.js `Transform` stream that tokenizes the JSON written to it and emits
 * the resulting JSON tokens as objects, one `data` event per token.
 *
 * Pipe it into a `TokenParser` stream to get JSON values back, or use a
 * `JSONParser` stream, which chains both.
 *
 * @example
 * ```ts
 * import Tokenizer from "@streamparser/json-node/tokenizer.js";
 * import TokenParser from "@streamparser/json-node/tokenparser.js";
 *
 * const tokenizer = new Tokenizer({ separator: "\n" });
 * const tokenParser = new TokenParser();
 *
 * inputStream.pipe(tokenizer).pipe(tokenParser);
 * ```
 */
export default class TokenizerTransform extends Transform {
  private tokenizer: Tokenizer;

  /**
   * @param opts How to tokenize. See `TokenizerOptions`.
   * @param transformOpts The standard Node.js `Transform` stream options, except
   * the object modes, which this stream sets itself.
   */
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
      this.tokenizer.write(chunk);
      done();
    } catch (err: unknown) {
      done(err as Error);
    }
  }

  /**
   * Ends the tokenizer once the input stream is over.
   *
   * @param callback Called when the tokenizer is done, with the error if the
   * stream ended in the middle of a token.
   */
  override _final(callback: (error?: Error | null) => void): void {
    try {
      if (!this.tokenizer.isEnded) this.tokenizer.end();
      callback();
    } catch (err: unknown) {
      callback(err as Error);
    }
  }
}

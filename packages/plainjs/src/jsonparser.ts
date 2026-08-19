/**
 * A streaming drop-in replacement for `JSON.parse`, chaining the tokenizer and
 * the token parser.
 *
 * @example
 * ```ts
 * import JSONParser from "@streamparser/json/jsonparser.js";
 *
 * const parser = new JSONParser();
 * parser.onValue = ({ value }) => {
 *   // process the value
 * };
 *
 * parser.write('{ "test": ["a"] }');
 * ```
 *
 * @module
 */

import Tokenizer, { type TokenizerOptions } from "./tokenizer.js";
import TokenParser, { type TokenParserOptions } from "./tokenparser.js";
import type { ParsedElementInfo } from "./utils/types/parsedElementInfo.js";
import type { ParsedTokenInfo } from "./utils/types/parsedTokenInfo.js";

/**
 * The options that a {@linkcode JSONParser} can be created with: those of the
 * tokenizer and those of the token parser it chains.
 */
export interface JSONParserOptions
  extends TokenizerOptions,
    TokenParserOptions {}

/**
 * A full JSON parser: a {@linkcode Tokenizer} and a {@linkcode TokenParser}
 * wired to each other.
 *
 * Data is pushed in with {@linkcode JSONParser.write} and the parsed values come
 * back through the {@linkcode JSONParser.onValue} callback.
 *
 * @example
 * ```ts
 * import JSONParser from "@streamparser/json/jsonparser.js";
 *
 * const parser = new JSONParser({ paths: ["$.*"], keepStack: false });
 * parser.onValue = ({ value }) => {
 *   // process the value
 * };
 * parser.onError = (err) => console.error(err);
 *
 * // The document can arrive split across any number of chunks.
 * parser.write('[{ "id": 1 },');
 * parser.write('{ "id": 2 }]');
 * ```
 */
export default class JSONParser {
  private tokenizer: Tokenizer;
  private tokenParser: TokenParser;

  /**
   * @param opts How to tokenize and what to emit. See {@linkcode JSONParserOptions}.
   */
  constructor(opts: JSONParserOptions = {}) {
    this.tokenizer = new Tokenizer(opts);
    this.tokenParser = new TokenParser(opts);

    this.tokenizer.onToken = this.tokenParser.write.bind(this.tokenParser);
    this.tokenizer.onEnd = () => {
      if (!this.tokenParser.isEnded) this.tokenParser.end();
    };

    this.tokenParser.onError = this.tokenizer.error.bind(this.tokenizer);
    this.tokenParser.onEnd = () => {
      if (!this.tokenizer.isEnded) this.tokenizer.end();
    };
  }

  /** Whether the parser is ended, and thus no longer accepting data. */
  public get isEnded(): boolean {
    return this.tokenizer.isEnded && this.tokenParser.isEnded;
  }

  /**
   * Pushes the next chunk of the JSON stream into the parser.
   *
   * Parsing happens synchronously, so every value that the chunk completes is
   * emitted through {@linkcode JSONParser.onValue} before this returns.
   *
   * @param input The chunk to parse: a string, a `TypedArray`, or any iterable
   * of utf-8 byte values.
   * @throws {Error} If the data is not valid JSON and no
   * {@linkcode JSONParser.onError} callback has been set.
   */
  public write(input: Iterable<number> | string): void {
    this.tokenizer.write(input);
  }

  /**
   * Signals that the stream is over, ending the parser, which can't be used
   * afterwards.
   *
   * @throws {Error} If the JSON document was left half-parsed and no
   * {@linkcode JSONParser.onError} callback has been set.
   */
  public end(): void {
    this.tokenizer.end();
  }

  /** Sets the callback to be called with every token found in the stream. */
  public set onToken(cb: (parsedTokenInfo: ParsedTokenInfo) => void) {
    this.tokenizer.onToken = (parsedToken) => {
      cb(parsedToken);
      this.tokenParser.write(parsedToken);
    };
  }

  /** Sets the callback to be called with every value that matches the configured `paths`. */
  public set onValue(cb: (parsedElementInfo: ParsedElementInfo) => void) {
    this.tokenParser.onValue = cb;
  }

  /**
   * Sets the callback to be called when the data can't be parsed. Without one,
   * errors are thrown out of the {@linkcode JSONParser.write} or
   * {@linkcode JSONParser.end} call that caused them.
   */
  public set onError(cb: (err: Error) => void) {
    this.tokenizer.onError = cb;
  }

  /** Sets the callback to be called once the parser has ended. */
  public set onEnd(cb: () => void) {
    this.tokenParser.onEnd = () => {
      if (!this.tokenizer.isEnded) this.tokenizer.end();
      cb.call(this.tokenParser);
    };
  }
}

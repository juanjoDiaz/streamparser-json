/**
 * A WHATWG `TransformStream` that assembles a stream of JSON tokens into JSON
 * values.
 *
 * @example
 * ```ts
 * import Tokenizer from "@streamparser/json-whatwg/tokenizer.js";
 * import TokenParser from "@streamparser/json-whatwg/tokenparser.js";
 *
 * const parsedValues = inputStream
 *   .pipeThrough(new Tokenizer())
 *   .pipeThrough(new TokenParser({ paths: ["$.*"] }));
 * ```
 *
 * @module
 */

import { TokenParser, type TokenParserOptions } from "@streamparser/json";
import { cloneParsedElementInfo } from "@streamparser/json/utils/cloneParsedElementInfo.js";
import type { ParsedElementInfo } from "@streamparser/json/utils/types/parsedElementInfo.js";
import type { ParsedTokenInfo } from "@streamparser/json/utils/types/parsedTokenInfo.js";

class TokenParserTransformer
  extends TokenParser
  implements Transformer<ParsedTokenInfo, ParsedElementInfo>
{
  // @ts-expect-error Controller always defined during start
  private controller: TransformStreamDefaultController<ParsedElementInfo>;

  constructor(opts: TokenParserOptions) {
    super(opts);
    this.onValue = (parsedElementInfo) =>
      this.controller.enqueue(cloneParsedElementInfo(parsedElementInfo));
    this.onError = (err: Error) => this.controller.error(err);
  }

  start(controller: TransformStreamDefaultController<ParsedElementInfo>) {
    this.controller = controller;
  }

  transform(parsedTokenInfo: ParsedTokenInfo) {
    this.write(parsedTokenInfo);
  }

  flush() {
    if (!this.isEnded) this.end();
  }
}

/**
 * A WHATWG `TransformStream` that assembles the JSON tokens piped through it
 * into JSON values and enqueues them, one chunk per value.
 *
 * It expects the tokens enqueued by a `Tokenizer` stream. The enqueued chunks are
 * `ParsedElementInfo`s, so the value itself is in their `value` property, and
 * their `parent` and `stack` are snapshots, safe to keep for as long as needed.
 */
export default class TokenParserTransformStream extends TransformStream<
  ParsedTokenInfo,
  ParsedElementInfo
> {
  /**
   * @param opts What to emit and how. See `TokenParserOptions`.
   * @param writableStrategy The queuing strategy for the writable side of the stream.
   * @param readableStrategy The queuing strategy for the readable side of the stream.
   */
  constructor(
    opts: TokenParserOptions,
    writableStrategy?: QueuingStrategy,
    readableStrategy?: QueuingStrategy,
  ) {
    const transformer = new TokenParserTransformer(opts);
    super(transformer, writableStrategy, readableStrategy);
  }
}

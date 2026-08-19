/**
 * A WHATWG `TransformStream` that tokenizes a JSON stream.
 *
 * @example
 * ```ts
 * import Tokenizer from "@streamparser/json-whatwg/tokenizer.js";
 *
 * const tokenizer = new Tokenizer();
 *
 * const reader = inputStream.pipeThrough(tokenizer).getReader();
 * while (true) {
 *   const { done, value: parsedTokenInfo } = await reader.read();
 *   if (done) break;
 *   // process the token
 * }
 * ```
 *
 * @module
 */

import Tokenizer, {
  type TokenizerOptions,
} from "@streamparser/json/tokenizer.js";
import type { ParsedTokenInfo } from "@streamparser/json/utils/types/parsedTokenInfo.js";

class TokenizerTransformer
  extends Tokenizer
  implements Transformer<Iterable<number> | string, ParsedTokenInfo>
{
  // @ts-expect-error Controller always defined during start
  private controller: TransformStreamDefaultController<ParsedTokenInfo>;

  constructor(opts?: TokenizerOptions) {
    super(opts);
    this.onToken = (parsedTokenInfo) =>
      this.controller.enqueue(parsedTokenInfo);
    this.onError = (err) => this.controller.error(err);
  }

  start(controller: TransformStreamDefaultController<ParsedTokenInfo>) {
    this.controller = controller;
  }

  transform(chunk: Iterable<number> | string) {
    this.write(chunk);
  }

  flush() {
    if (!this.isEnded) this.end();
  }
}

/**
 * A WHATWG `TransformStream` that tokenizes the JSON piped through it and
 * enqueues the resulting JSON tokens, one chunk per token.
 *
 * Pipe it through a `TokenParser` stream to get JSON values back, or use a
 * `JSONParser` stream, which chains both.
 *
 * @example
 * ```ts
 * import Tokenizer from "@streamparser/json-whatwg/tokenizer.js";
 * import TokenParser from "@streamparser/json-whatwg/tokenparser.js";
 *
 * const parsedValues = inputStream
 *   .pipeThrough(new Tokenizer({ separator: "\n" }))
 *   .pipeThrough(new TokenParser());
 * ```
 */
export default class TokenizerTransformStream extends TransformStream<
  Iterable<number> | string,
  ParsedTokenInfo
> {
  /**
   * @param opts How to tokenize. See `TokenizerOptions`.
   * @param writableStrategy The queuing strategy for the writable side of the stream.
   * @param readableStrategy The queuing strategy for the readable side of the stream.
   */
  constructor(
    opts?: TokenizerOptions,
    writableStrategy?: QueuingStrategy,
    readableStrategy?: QueuingStrategy,
  ) {
    const transformer = new TokenizerTransformer(opts);
    super(transformer, writableStrategy, readableStrategy);
  }
}

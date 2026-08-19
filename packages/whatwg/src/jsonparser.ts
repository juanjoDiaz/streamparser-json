/**
 * A WHATWG `TransformStream` that parses a JSON stream into JSON values.
 *
 * @example
 * ```ts
 * import JSONParser from "@streamparser/json-whatwg/jsonparser.js";
 *
 * const parser = new JSONParser({ paths: ["$.*"], keepStack: false });
 *
 * const reader = inputStream.pipeThrough(parser).getReader();
 * while (true) {
 *   const { done, value: parsedElementInfo } = await reader.read();
 *   if (done) break;
 *   const { value } = parsedElementInfo;
 *   // process the value
 * }
 * ```
 *
 * @module
 */

import { JSONParser, type JSONParserOptions } from "@streamparser/json";
import { cloneParsedElementInfo } from "@streamparser/json/utils/cloneParsedElementInfo.js";
import type { ParsedElementInfo } from "@streamparser/json/utils/types/parsedElementInfo.js";

class JSONParserTransformer
  extends JSONParser
  implements Transformer<Iterable<number> | string, ParsedElementInfo>
{
  // @ts-expect-error Controller always defined during start
  private controller: TransformStreamDefaultController<ParsedElementInfo>;

  constructor(opts?: JSONParserOptions) {
    super(opts);
    // Snapshot lazily unless keepStack:false is set: with keepStack:true the
    // parser's containers are append-only, so a deferred snapshot is still
    // correct and avoids an O(n) copy on every event (see
    // cloneParsedElementInfo). keepStack:false empties them instead, so it
    // keeps the eager clone.
    const lazySnapshot = opts?.keepStack !== false;
    this.onValue = (value) =>
      this.controller.enqueue(cloneParsedElementInfo(value, lazySnapshot));
    this.onError = (err) => this.controller.error(err);
  }

  start(controller: TransformStreamDefaultController<ParsedElementInfo>) {
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
 * A WHATWG `TransformStream` that parses the JSON piped through it and enqueues
 * the parsed values, one chunk per value.
 *
 * The enqueued chunks are `ParsedElementInfo`s, so the value itself is in their
 * `value` property. Unlike the underlying `@streamparser/json` parser, their
 * `parent` and `stack` are snapshots, safe to keep for as long as needed.
 *
 * @example
 * ```ts
 * import JSONParser from "@streamparser/json-whatwg/jsonparser.js";
 *
 * const parser = new JSONParser();
 * const response = await fetch("http://example.com/");
 *
 * const reader = response.body.pipeThrough(parser).getReader();
 * while (true) {
 *   const { done, value } = await reader.read();
 *   if (done) break;
 *   console.log(value);
 * }
 * ```
 */
export default class JSONParserTransformStream extends TransformStream<
  Iterable<number> | string,
  ParsedElementInfo
> {
  /**
   * @param opts How to tokenize and what to emit. See `JSONParserOptions`.
   * @param writableStrategy The queuing strategy for the writable side of the stream.
   * @param readableStrategy The queuing strategy for the readable side of the stream.
   */
  constructor(
    opts?: JSONParserOptions,
    writableStrategy?: QueuingStrategy,
    readableStrategy?: QueuingStrategy,
  ) {
    const transformer = new JSONParserTransformer(opts);
    super(transformer, writableStrategy, readableStrategy);
  }
}

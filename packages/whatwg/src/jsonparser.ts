import { JSONParser, type JSONParserOptions } from "@streamparser/json";
import type { ParsedElementInfo } from "@streamparser/json/utils/types/parsedElementInfo.js";
import { cloneParsedElementInfo } from "@streamparser/json/utils/cloneParsedElementInfo.js";

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

export default class JSONParserTransformStream extends TransformStream<
  Iterable<number> | string,
  ParsedElementInfo
> {
  constructor(
    opts?: JSONParserOptions,
    writableStrategy?: QueuingStrategy,
    readableStrategy?: QueuingStrategy,
  ) {
    const transformer = new JSONParserTransformer(opts);
    super(transformer, writableStrategy, readableStrategy);
  }
}

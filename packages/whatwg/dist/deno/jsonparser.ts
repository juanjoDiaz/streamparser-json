import { JSONParser, type JSONParserOptions } from "https://deno.land/x/streamparser_json@v0.0.22/index.ts";
import type { ParsedElementInfo } from "https://deno.land/x/streamparser_json@v0.0.22/utils/types/parsedElementInfo.ts";
import { cloneParsedElementInfo } from "./utils.ts";

class JSONParserTransformer
  extends JSONParser
  implements Transformer<Iterable<number> | string, ParsedElementInfo>
{
  // @ts-expect-error Controller always defined during start
  private controller: TransformStreamDefaultController<ParsedElementInfo>;

  constructor(opts?: JSONParserOptions) {
    super(opts);
    this.onValue = (value) =>
      this.controller.enqueue(cloneParsedElementInfo(value));
    this.onError = (err) => this.controller.error(err);
    this.onEnd = () => this.controller.terminate();
  }

  start(controller: TransformStreamDefaultController<ParsedElementInfo>) {
    this.controller = controller;
  }

  transform(chunk: Iterable<number> | string) {
    this.write(chunk);
  }

  flush() {
    this.end();
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

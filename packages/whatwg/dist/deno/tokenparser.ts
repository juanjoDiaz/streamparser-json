import { TokenParser, type TokenParserOptions } from "https://deno.land/x/streamparser_json@v0.0.22/index.ts";
import type { ParsedTokenInfo } from "https://deno.land/x/streamparser_json@v0.0.22/utils/types/parsedTokenInfo.ts";
import type { ParsedElementInfo } from "https://deno.land/x/streamparser_json@v0.0.22/utils/types/parsedElementInfo.ts";
import { cloneParsedElementInfo } from "./utils.ts";

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
    this.onEnd = () => this.controller.terminate();
  }

  start(controller: TransformStreamDefaultController<ParsedElementInfo>) {
    this.controller = controller;
  }

  transform(parsedTokenInfo: ParsedTokenInfo) {
    this.write(parsedTokenInfo);
  }

  flush() {
    this.end();
  }
}

export default class TokenParserTransformStream extends TransformStream<
  ParsedTokenInfo,
  ParsedElementInfo
> {
  constructor(
    opts: TokenParserOptions,
    writableStrategy?: QueuingStrategy,
    readableStrategy?: QueuingStrategy,
  ) {
    const transformer = new TokenParserTransformer(opts);
    super(transformer, writableStrategy, readableStrategy);
  }
}

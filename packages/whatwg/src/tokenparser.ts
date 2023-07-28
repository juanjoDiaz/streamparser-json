import { TokenParser, type TokenParserOptions } from "@streamparser/json";
import type { ParsedTokenInfo } from "@streamparser/json/utils/types/parsedTokenInfo.js";
import type { ParsedElementInfo } from "@streamparser/json/utils/types/parsedElementInfo.js";
import { cloneParsedElementInfo } from "./utils.js";

class TokenParserTransformer
  extends TokenParser
  implements Transformer<ParsedTokenInfo, ParsedElementInfo>
{
  // @ts-ignore Controller always defined during start
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

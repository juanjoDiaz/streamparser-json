import Tokenizer, {
  type TokenizerOptions,
} from "https://deno.land/x/streamparser_json@v0.0.22/tokenizer.ts";
import type { ParsedTokenInfo } from "https://deno.land/x/streamparser_json@v0.0.22/utils/types/parsedTokenInfo.ts";

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
    this.onEnd = () => this.controller.terminate();
  }

  start(controller: TransformStreamDefaultController<ParsedTokenInfo>) {
    this.controller = controller;
  }

  transform(chunk: Iterable<number> | string) {
    this.write(chunk);
  }

  flush() {
    this.end();
  }
}

export default class TokenizerTransformStream extends TransformStream<
  Iterable<number> | string,
  ParsedTokenInfo
> {
  constructor(
    opts?: TokenizerOptions,
    writableStrategy?: QueuingStrategy,
    readableStrategy?: QueuingStrategy,
  ) {
    const transformer = new TokenizerTransformer(opts);
    super(transformer, writableStrategy, readableStrategy);
  }
}

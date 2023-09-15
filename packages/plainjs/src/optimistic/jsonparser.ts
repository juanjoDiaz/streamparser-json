import type { TokenizerOptions } from "../tokenizer.js";
import type { TokenParserOptions } from "../tokenparser.js";
import type { JsonStruct } from "../utils/types/jsonTypes.js";
import type { ParsedTokenInfo } from "../utils/types/parsedTokenInfo.js";
import { OptimisticTokenizer } from "./tokenizer.js";
import { OptimisticTokenParser } from "./tokenparser.js";

export interface OptimisticJSONParserOptions
  extends TokenizerOptions,
    TokenParserOptions {}

export class OptimisticJSONParser {
  private tokenizer: OptimisticTokenizer;
  private tokenParser: OptimisticTokenParser;

  constructor(opts: OptimisticJSONParserOptions = {}) {
    this.tokenizer = new OptimisticTokenizer(opts);
    this.tokenParser = new OptimisticTokenParser(opts);

    this.tokenizer.onToken = this.tokenParser.write.bind(this.tokenParser);
    this.tokenizer.onEnd = () => {
      if (!this.tokenParser.isEnded) this.tokenParser.end();
    };

    this.tokenParser.onError = this.tokenizer.error.bind(this.tokenizer);
    this.tokenParser.onEnd = () => {
      if (!this.tokenizer.isEnded) this.tokenizer.end();
    };
  }

  public get isEnded(): boolean {
    return this.tokenizer.isEnded && this.tokenParser.isEnded;
  }

  public write(input: Iterable<number> | string): void {
    this.tokenizer.write(input);
  }

  public end(): void {
    this.tokenizer.end();
  }

  public set onToken(cb: (parsedTokenInfo: ParsedTokenInfo) => void) {
    this.tokenizer.onToken = (parsedToken) => {
      cb(parsedToken);
      this.tokenParser.write(parsedToken);
    };
  }

  public get value(): JsonStruct | undefined {
    return this.tokenParser.value;
  }

  public set onError(cb: (err: Error) => void) {
    this.tokenizer.onError = cb;
  }

  public set onEnd(cb: () => void) {
    this.tokenParser.onEnd = () => {
      if (!this.tokenizer.isEnded) this.tokenizer.end();
      cb.call(this.tokenParser);
    };
  }
}

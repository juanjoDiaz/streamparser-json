import Tokenizer, { TokenizerOptions } from "./tokenizer";
import TokenParser, {
  StackElement,
  TokenParserOptions,
  TokenParserError,
} from "./tokenparser";
import { JsonPrimitive, JsonKey, JsonStruct } from "./utils/types";

interface JSONParserOpts extends TokenizerOptions, TokenParserOptions {}

export default class JSONParser {
  private tokenizer: Tokenizer;
  private tokenParser: TokenParser;

  constructor(opts: JSONParserOpts = {}) {
    this.tokenizer = new Tokenizer(opts);
    this.tokenParser = new TokenParser(opts);
    this.tokenizer.onToken = this.tokenParser.write.bind(this.tokenParser);
  }

  public get isEnded(): boolean {
    return this.tokenizer.isEnded && this.tokenParser.isEnded;
  }

  public write(input: Iterable<number> | string): void {
    try {
      this.tokenizer.write(input);
      if (this.tokenParser.isEnded) {
        this.tokenizer.end();
      }
    } catch (err) {
      if (err instanceof TokenParserError) {
        if (this.tokenParser.isEnded) {
          try {
            // The tokenizer ended before processing the all the passed tokens
            this.tokenizer.error(err);
          } catch (err) {
            this.end();
          }
        }
      }

      this.tokenizer.error(err);
    }
  }

  public end(): void {
    this.tokenizer.end();
    if (!this.tokenParser.isEnded) {
      this.tokenParser.end();
    }
  }

  public set onToken(
    cb: (token: number, value: JsonPrimitive, offset: number) => void
  ) {
    this.tokenizer.onToken = cb;
  }

  public set onValue(
    cb: (
      value: JsonPrimitive | JsonStruct,
      key: JsonKey | undefined,
      parent: JsonStruct | undefined,
      stack: StackElement[]
    ) => void
  ) {
    this.tokenParser.onValue = cb;
  }

  public set onError(cb: (err: Error) => void) {
    this.tokenizer.onError = cb;
  }

  public set onEnd(cb: () => void) {
    this.tokenParser.onEnd = cb;
  }
}

import Tokenizer, { TokenizerOptions } from "./tokenizer";
import TokenParser, { StackElement, TokenParserOptions } from "./tokenparser";
import { JsonPrimitive, JsonKey, JsonStruct } from "./utils/types";

interface JSONParserOpts extends TokenizerOptions, TokenParserOptions {}

export default class JSONParser {
  private tokenizer: Tokenizer;
  private tokenParser: TokenParser;

  constructor(opts: JSONParserOpts = {}) {
    this.tokenizer = new Tokenizer(opts);
    this.tokenParser = new TokenParser(opts);

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
    this.tokenParser.onEnd = () => {
      if (!this.tokenizer.isEnded) this.tokenizer.end();
      cb.call(this.tokenParser);
    };
  }
}

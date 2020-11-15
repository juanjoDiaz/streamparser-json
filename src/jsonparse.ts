import Tokenizer, { TokenizerOptions } from "./tokenizer";
import Parser, { StackElement, ParserOptions, TokenParserError } from "./parser";

interface JSONParserOpts extends TokenizerOptions, ParserOptions {}

export default class JSONParser {
  private tokenizer: Tokenizer;
  private parser: Parser;

  constructor(opts: JSONParserOpts = {}) {
    this.tokenizer = new Tokenizer(opts);
    this.parser = new Parser(opts);
    this.tokenizer.onToken = this.parser.write.bind(this.parser);
  }

  public get isEnded(): boolean {
    return this.tokenizer.isEnded && this.parser.isEnded;
  }

  public write(input: Iterable<number> | string): void {
    try {
      this.tokenizer.write(input);
      if (this.parser.isEnded) {
        this.tokenizer.end();
      }
    } catch(err) {
      if (err instanceof TokenParserError) {
        if (this.parser.isEnded) {
          try {
            // The tokenizer ended before processing the all the passed tokens
            this.tokenizer.error(err);
          } catch(err) {
            this.end();
          }
        } else {
          // Bubbles up the Parser errrors
          this.tokenizer.error(err);
        }
      }

      throw err;
    }
  }

  public set onToken(cb: (token: number, value: any, offset: number) => void) {
    this.tokenizer.onToken = cb;
  }

  public set onValue(
    cb: (
      value: any,
      key: string | number | undefined,
      parent: any,
      stack: StackElement[],
    ) => void,
  ) {
    this.parser.onValue = cb;
  }

  public end(): void {
    this.tokenizer.end();
    if (!this.parser.isEnded) {
      this.parser.end();
    }
  }
}

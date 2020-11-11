import Tokenizer, { TokenizerOptions } from './tokenizer.ts';
import Parser, { StackElement, ParserOptions, TokenParserError } from './parser.ts';

interface JSONParserOpts extends TokenizerOptions, ParserOptions {}

export default class JSONParser {
  private tokenizer: Tokenizer;
  private parser: Parser;

  constructor(opts: JSONParserOpts = {}) {
    this.tokenizer = new Tokenizer(opts);
    this.parser = new Parser(opts);
    this.tokenizer.onToken = this.parser.write.bind(this.parser);
  }

  public write(input: Iterable<number> | string): void {
    try {
      this.tokenizer.write(input);
    } catch(err) {
      if (err instanceof TokenParserError) {
        // Bubbles up the Parser errrors
        this.tokenizer.error(err);
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
    this.parser.end();
    this.tokenizer.end();
  }
}

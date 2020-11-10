import Tokenizer, { TokenizerOptions } from "./tokenizer";
import Parser, { StackElement, ParserOptions } from "./parser";

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
    this.tokenizer.write(input);
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

  public set onEnd(cb: () => {}) {
    this.parser.onEnd = cb;
  }

  public end() {
    this.tokenizer.end();
    this.parser.end();
  }
}

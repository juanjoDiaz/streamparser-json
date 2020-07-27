import Tokenizer, { TokenizerOptions } from "./tokenizer";
import Parser, { StackElement } from "./parser";

export default class JSONParser {
  private tokenizer: Tokenizer;
  private parser: Parser;

  constructor(opts: TokenizerOptions = {}) {
    this.tokenizer = new Tokenizer(opts);
    this.parser = new Parser();
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
}

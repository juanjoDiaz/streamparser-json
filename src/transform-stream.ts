import JSONParser, { JSONParserOpts } from "./jsonparse";
import { StackElement } from "./parser";

export interface JSONParserOutput {
  value: any;
  key: string | number | undefined;
  parent: any;
  stack: StackElement[];
}

export default class JSONparseStream extends TransformStream {
  constructor(opts?: JSONParserOpts, writableStrategy?: QueuingStrategy<string>, readableStrategy?: QueuingStrategy<JSONParserOutput>) {
    const parser = new JSONParser(opts);
    const readyItems: JSONParserOutput[] = [];
    parser.onValue = (
      value: any,
      key: string | number | undefined,
      parent: any,
      stack: StackElement[],
    ): void => {
      readyItems.push({ value, key, parent, stack });
    }
    super({
      transform(chunk, controller) {
        try {
          parser.write(chunk);
          readyItems.forEach(item => controller.enqueue(item));
          readyItems.length = 0;
        } catch (err) {
          controller.error(err);
        }
      }
    }, writableStrategy, readableStrategy);
  }
}
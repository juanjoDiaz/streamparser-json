import { Transform, TransformCallback } from 'stream';
import JSONParser, { JSONParserOpts } from "./jsonparse";
import Tokenizer, { TokenizerOptions } from "./tokenizer";
import Parser, { StackElement, ParserOptions } from "./parser";
import { TokenType } from './utils/constants';

interface TokenizerResult {
  token: TokenType;
  value: any;
  offset: number;
}

export class TokenizerStream extends Transform {
  private tokenizer: Tokenizer;

  constructor(opts: TokenizerOptions = {}) {
    super({ readableObjectMode: true });
    this.tokenizer = new Tokenizer(opts);
    this.tokenizer.onToken = (token: TokenType, value: any, offset: number): void => {
      this.push({ token, value, offset });
    }
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      this.tokenizer.write(chunk);
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

export class ParserStream extends Transform {
  private parser: Parser;

  constructor(opts: ParserOptions = {}) {
    super({ readableObjectMode: true, writableObjectMode: true });
    this.parser = new Parser(opts);
    this.parser.onValue = (
      value: any,
      key: string | number | undefined,
      parent: any,
      stack: StackElement[],
    ): void => {
      this.push({ value, key, parent, stack });
    }
  }

  _transform(tokenizerResult: TokenizerResult, encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      const { token, value } = tokenizerResult;
      this.parser.write(token, value);
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

export class JSONparseStream extends Transform {
  private parser: JSONParser;

  constructor(opts: JSONParserOpts = {}) {
    super({ readableObjectMode: true, writableObjectMode: true });
    this.parser = new JSONParser(opts);
    this.parser.onValue = (
      value: any,
      key: string | number | undefined,
      parent: any,
      stack: StackElement[],
    ): void => {
      this.push({ value, key, parent, stack });
    }
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      this.parser.write(chunk);
      callback();
    } catch (err) {
      callback(err);
    }
  }
}
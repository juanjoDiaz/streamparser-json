import { TokenType } from "./utils/constants";

const {
  LEFT_BRACE,
  RIGHT_BRACE,
  LEFT_BRACKET,
  RIGHT_BRACKET,
  COLON,
  COMMA,
  TRUE,
  FALSE,
  NULL,
  STRING,
  NUMBER,
  SEPARATOR,
} = TokenType;

// Parser States
enum ParserState {
  VALUE,
  KEY,
  COLON,
  COMMA,
  ENDED,
  ERROR,
  SEPARATOR,
}
// Parser Modes
export enum ParserMode {
  OBJECT,
  ARRAY,
}

export interface StackElement {
  key: string | number | undefined;
  value: any;
  mode: ParserMode | undefined;
  emit: boolean;
}

export interface ParserOptions {
  paths?: string[];
  keepStack?: boolean;
  separator?: string;
}

const defaultOpts: ParserOptions = {
  paths: undefined,
  keepStack: true,
  separator: undefined,
};

export class TokenParserError extends Error {
  constructor(message: string) {
    super(message);
    // Typescript is broken. This is a workaround
    Object.setPrototypeOf(this, TokenParserError.prototype);
  }
}

export default class Parser {
  private readonly paths?: (string[] | undefined)[];
  private readonly keepStack: boolean;
  private readonly separator?: string;
  private state: ParserState = ParserState.VALUE;
  private mode: ParserMode | undefined = undefined;
  private key: string | number | undefined = undefined;
  private value: any = undefined;
  private stack: StackElement[] = [];

  constructor(opts?: ParserOptions) {
    opts = { ...defaultOpts, ...opts };

    if (opts.paths) {
      this.paths = opts.paths.map((path) => {
        if (path === undefined || path === '$*') return undefined;

        if (!path.startsWith('$')) throw new TokenParserError(`Invalid selector "${path}". Should start with "$".`);
        const pathParts = path.split('.').slice(1);
        if (pathParts.includes('')) throw new TokenParserError(`Invalid selector "${path}". ".." syntax not supported.`);
        return pathParts;
      });
    }

    this.keepStack = opts.keepStack as boolean;
    this.separator = opts.separator;
  }

  private shouldEmit(): boolean {
    if (!this.paths) return true;

    return this.paths.some((path) => {
      if (path === undefined) return true;
      if (path.length !== this.stack.length) return false;

      for (let i = 0; i < path.length - 1; i++) {
        const selector = path[i];
        const key = this.stack[i + 1].key;
        if (selector === '*') continue;
        if (selector !== key) return false;
      }

      const selector = path[path.length - 1];
      if (selector === '*') return true;
      return selector === this.key?.toString();
    }) ;
  }

  private push(): void {
    this.stack.push({ key: this.key, value: this.value, mode: this.mode, emit: this.shouldEmit() });
  }

  private pop(): void {
    const value = this.value;

    let emit;
    ({ key: this.key, value: this.value, mode: this.mode, emit } = this.stack
      .pop() as StackElement);

    this.state = this.mode !== undefined
      ? ParserState.COMMA
      : ParserState.VALUE;

    this.emit(value, emit);
  }

  private emit(value: any, emit: boolean) {
    if (this.value && !this.keepStack && this.stack.every(item => !item.emit)) {
      delete this.value[this.key as string | number];
    }

    if (emit) {
      this.onValue(value, this.key, this.value, this.stack);
    }

    if (this.stack.length === 0) {
      if (this.separator) {
        this.state = ParserState.SEPARATOR;
      } else if (this.separator === undefined) {
        this.end();
      }
      // else if separator === '', expect next JSON object.
    }
  }

  public get isEnded(): boolean {
    return this.state === ParserState.ENDED;
  }

  public write(token: TokenType, value: any): void {
    if (this.state === ParserState.VALUE) {
      if (
        token === STRING || token === NUMBER || token === TRUE ||
        token === FALSE || token === NULL
      ) {
        if (this.mode === ParserMode.OBJECT) {
          this.value[this.key as string] = value;
          this.state = ParserState.COMMA;
        } else if (this.mode === ParserMode.ARRAY) {
          this.value.push(value);
          this.state = ParserState.COMMA;
        }

        this.emit(value, this.shouldEmit());
        return;
      }

      if (token === LEFT_BRACE) {
        this.push();
        if (this.mode === ParserMode.OBJECT) {
          this.value = this.value[this.key as string] = {};
        } else if (this.mode === ParserMode.ARRAY) {
          const val = {};
          this.value.push(val);
          this.value = val;
        } else {
          this.value = {};
        }
        this.mode = ParserMode.OBJECT;
        this.state = ParserState.KEY;
        this.key = undefined;
        return;
      }

      if (token === LEFT_BRACKET) {
        this.push();
        if (this.mode === ParserMode.OBJECT) {
          this.value = this.value[this.key as string] = [];
        } else if (this.mode === ParserMode.ARRAY) {
          const val: any[] = [];
          this.value.push(val);
          this.value = val;
        } else {
          this.value = [];
        }
        this.mode = ParserMode.ARRAY;
        this.state = ParserState.VALUE;
        this.key = 0;
        return;
      }

      if (
        this.mode === ParserMode.ARRAY && token === RIGHT_BRACKET &&
        this.value.length === 0
      ) {
        this.pop();
        return;
      }
    }

    if (this.state === ParserState.KEY) {
      if (token === STRING) {
        this.key = value;
        this.state = ParserState.COLON;
        return;
      }

      if (token === RIGHT_BRACE && Object.keys(this.value).length === 0) {
        this.pop();
        return;
      }
    }

    if (this.state === ParserState.COLON) {
      if (token === COLON) {
        this.state = ParserState.VALUE;
        return;
      }
    }

    if (this.state === ParserState.COMMA) {
      if (token === COMMA) {
        if (this.mode === ParserMode.ARRAY) {
          this.state = ParserState.VALUE;
          (this.key as number) += 1;
          return;
        }

        /* istanbul ignore else */
        if (this.mode === ParserMode.OBJECT) {
          this.state = ParserState.KEY;
          return;
        }
      }

      if (
        token === RIGHT_BRACE && this.mode === ParserMode.OBJECT ||
        token === RIGHT_BRACKET && this.mode === ParserMode.ARRAY
      ) {
        this.pop();
        return;
      }
    }

    if (this.state === ParserState.SEPARATOR) {
      if (token === SEPARATOR && value === this.separator) {
        this.state = ParserState.VALUE;
        return;
      }
    }

    this.error(new TokenParserError(`Unexpected ${TokenType[token]} (${JSON.stringify(value)}) in state ${ParserState[this.state]}`));
  }

  public error(err: Error): never {
    if (this.state !== ParserState.ENDED) {
      this.state = ParserState.ERROR;
    }
    throw err;
  }

  public end(): void {
    if (this.state !== ParserState.VALUE || this.stack.length > 0) {
      this.error(new TokenParserError(`Parser ended in mid-parsing (state: ${ParserState[this.state]}). Either not all the data was received or the data was invalid.`));
    }

    this.state = ParserState.ENDED;
  }

  public onValue(
    value: any,
    key: string | number | undefined,
    parent: any,
    stack: StackElement[],
  ): void {
    // Override me
  }
}

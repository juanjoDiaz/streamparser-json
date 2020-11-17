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
enum TokenParserState {
  VALUE,
  KEY,
  COLON,
  COMMA,
  ENDED,
  ERROR,
  SEPARATOR,
}
// Parser Modes
export enum TokenParserMode {
  OBJECT,
  ARRAY,
}

export interface StackElement {
  key: string | number | undefined;
  value: any;
  mode: TokenParserMode | undefined;
  emit: boolean;
}

export interface TokenParserOptions {
  paths?: string[];
  keepStack?: boolean;
  separator?: string;
}

const defaultOpts: TokenParserOptions = {
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

export default class TokenParser {
  private readonly paths?: (string[] | undefined)[];
  private readonly keepStack: boolean;
  private readonly separator?: string;
  private state: TokenParserState = TokenParserState.VALUE;
  private mode: TokenParserMode | undefined = undefined;
  private key: string | number | undefined = undefined;
  private value: any = undefined;
  private stack: StackElement[] = [];

  constructor(opts?: TokenParserOptions) {
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
      ? TokenParserState.COMMA
      : TokenParserState.VALUE;

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
        this.state = TokenParserState.SEPARATOR;
      } else if (this.separator === undefined) {
        this.end();
      }
      // else if separator === '', expect next JSON object.
    }
  }

  public get isEnded(): boolean {
    return this.state === TokenParserState.ENDED;
  }

  public write(token: TokenType, value: any): void {
    if (this.state === TokenParserState.VALUE) {
      if (
        token === STRING || token === NUMBER || token === TRUE ||
        token === FALSE || token === NULL
      ) {
        if (this.mode === TokenParserMode.OBJECT) {
          this.value[this.key as string] = value;
          this.state = TokenParserState.COMMA;
        } else if (this.mode === TokenParserMode.ARRAY) {
          this.value.push(value);
          this.state = TokenParserState.COMMA;
        }

        this.emit(value, this.shouldEmit());
        return;
      }

      if (token === LEFT_BRACE) {
        this.push();
        if (this.mode === TokenParserMode.OBJECT) {
          this.value = this.value[this.key as string] = {};
        } else if (this.mode === TokenParserMode.ARRAY) {
          const val = {};
          this.value.push(val);
          this.value = val;
        } else {
          this.value = {};
        }
        this.mode = TokenParserMode.OBJECT;
        this.state = TokenParserState.KEY;
        this.key = undefined;
        return;
      }

      if (token === LEFT_BRACKET) {
        this.push();
        if (this.mode === TokenParserMode.OBJECT) {
          this.value = this.value[this.key as string] = [];
        } else if (this.mode === TokenParserMode.ARRAY) {
          const val: any[] = [];
          this.value.push(val);
          this.value = val;
        } else {
          this.value = [];
        }
        this.mode = TokenParserMode.ARRAY;
        this.state = TokenParserState.VALUE;
        this.key = 0;
        return;
      }

      if (
        this.mode === TokenParserMode.ARRAY && token === RIGHT_BRACKET &&
        this.value.length === 0
      ) {
        this.pop();
        return;
      }
    }

    if (this.state === TokenParserState.KEY) {
      if (token === STRING) {
        this.key = value;
        this.state = TokenParserState.COLON;
        return;
      }

      if (token === RIGHT_BRACE && Object.keys(this.value).length === 0) {
        this.pop();
        return;
      }
    }

    if (this.state === TokenParserState.COLON) {
      if (token === COLON) {
        this.state = TokenParserState.VALUE;
        return;
      }
    }

    if (this.state === TokenParserState.COMMA) {
      if (token === COMMA) {
        if (this.mode === TokenParserMode.ARRAY) {
          this.state = TokenParserState.VALUE;
          (this.key as number) += 1;
          return;
        }

        /* istanbul ignore else */
        if (this.mode === TokenParserMode.OBJECT) {
          this.state = TokenParserState.KEY;
          return;
        }
      }

      if (
        token === RIGHT_BRACE && this.mode === TokenParserMode.OBJECT ||
        token === RIGHT_BRACKET && this.mode === TokenParserMode.ARRAY
      ) {
        this.pop();
        return;
      }
    }

    if (this.state === TokenParserState.SEPARATOR) {
      if (token === SEPARATOR && value === this.separator) {
        this.state = TokenParserState.VALUE;
        return;
      }
    }

    this.error(new TokenParserError(`Unexpected ${TokenType[token]} (${JSON.stringify(value)}) in state ${TokenParserState[this.state]}`));
  }

  public error(err: Error): void {
    if (this.state !== TokenParserState.ENDED) {
      this.state = TokenParserState.ERROR;
    }

    this.onError(err);
  }

  public end(): void {
    if (this.state !== TokenParserState.VALUE || this.stack.length > 0) {
      this.error(new Error(`Parser ended in mid-parsing (state: ${TokenParserState[this.state]}). Either not all the data was received or the data was invalid.`));
    }

    this.state = TokenParserState.ENDED;
    this.onEnd();
  }

  public onValue(
    value: any,
    key: string | number | undefined,
    parent: any,
    stack: StackElement[],
  ): void {
    // Override me
    throw new TokenParserError('Can\'t emit data before the "onValue" callback has been set up.');
  }

  public onError(err: Error): void {
    // Override me
    throw err;
  }

  public onEnd(): void {
    // Override me
  }
}

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
} = TokenType;

// Parser States
enum ParserState {
  VALUE,
  KEY,
  COLON,
  COMMA,
  STOP,
  ERROR,
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
  path?: string;
  keepStack?: boolean,
}

const defaultOpts: ParserOptions = {
  path: undefined,
  keepStack: true,
};

export default class Parser {
  private readonly path?: string[];
  private readonly keepStack: boolean;
  private state: ParserState = ParserState.VALUE;
  private mode: ParserMode | undefined = undefined;
  private key: string | number | undefined = undefined;
  private value: any = undefined;
  private stack: StackElement[] = [];

  constructor(opts?: ParserOptions) {
    opts = { ...defaultOpts, ...opts };

    if (opts.path === undefined || opts.path === '$*') {
      this.path = undefined;
    } else {
      if (!opts.path.startsWith('$')) throw new Error(`Invalid selector "${opts.path}". Should start with "$".`);
      this.path = opts.path.split('.').slice(1);
      if (this.path.includes('')) throw new Error(`Invalid selector "${opts.path}". ".." syntax not supported.`);
    }

    this.keepStack = opts.keepStack as boolean;
  }

  private shouldEmit(): boolean {
    if (this.path === undefined) return true;
    if (this.path.length !== this.stack.length) return false;

    for (let i = 0; i < this.path.length - 1; i++) {
      const selector = this.path[i];
      const key = this.stack[i + 1].key;
      if (selector === '*') continue;
      if (selector !== key) return false;
    }

    const selector = this.path[this.path.length - 1];
    if (selector === '*') return true;
    return selector === this.key?.toString();
  }

  private push(): void {
    this.stack.push({ key: this.key, value: this.value, mode: this.mode, emit: this.shouldEmit() });
  }

  private pop(): void {
    const value = this.value;

    let emit;
    ({ key: this.key, value: this.value, mode: this.mode, emit } = this.stack
      .pop() as StackElement);

    this.emit(value, emit)

    this.state = this.mode !== undefined
      ? ParserState.COMMA
      : ParserState.VALUE;
  }

  private emit(value: any, emit: boolean) {
    if (!this.keepStack && this.stack.every(item => !item.emit)) delete this.value[this.key as string | number];
    if (emit) {
      this.onValue(value, this.key, this.value, this.stack);
    }
  }

  public write(token: TokenType, value: any): void{
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

    throw new Error(
      "Unexpected " + TokenType[token] + (("(" + JSON.stringify(value) + ")")) +
        " in state " + ParserState[this.state],
    );
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

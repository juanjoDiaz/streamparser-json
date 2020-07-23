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
}

export default class Parser {
  private state: ParserState = ParserState.VALUE;
  private mode: ParserMode | undefined = undefined;
  private key: string | number | undefined = undefined;
  private value: any = undefined;
  private stack: StackElement[] = [];

  private push(): void {
    this.stack.push({ key: this.key, value: this.value, mode: this.mode });
  }

  private pop(): void {
    const value = this.value;
    ({ key: this.key, value: this.value, mode: this.mode } = this.stack
      .pop() as StackElement);
    this.onValue(value, this.key, this.value, this.stack);
    this.state = this.mode !== undefined
      ? ParserState.COMMA
      : ParserState.VALUE;
  }

  public write(token: TokenType, value: any) {
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
        this.onValue(value, this.key, this.value, this.stack);
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

import type {
  JsonArray,
  JsonKey,
  JsonObject,
  JsonStruct,
} from "../utils/types/jsonTypes.js";
import { TokenParserMode } from "../utils/types/stackElement.js";
import TokenType from "../utils/types/tokenType.js";
import type { OptimisticParsedTokenInfo } from "./types.js";

// Parser States
const enum OptimisticTokenParserState {
  VALUE,
  KEY,
  COLON,
  COMMA,
  ENDED,
  ERROR,
  SEPARATOR,
}

function TokenParserStateToString(state: OptimisticTokenParserState): string {
  return ["VALUE", "KEY", "COLON", "COMMA", "ENDED", "ERROR", "SEPARATOR"][
    state
  ];
}

export interface OptimisticTokenParserOptions {
  separator?: string;
}

export interface OptimisticStackElement {
  key: JsonKey;
  value: JsonStruct;
  mode?: TokenParserMode;
}

const defaultOpts: OptimisticTokenParserOptions = {
  separator: undefined,
};

export class OptimisticTokenParserError extends Error {
  constructor(message: string) {
    super(message);
    // Typescript is broken. This is a workaround
    Object.setPrototypeOf(this, OptimisticTokenParserError.prototype);
  }
}

export class OptimisticTokenParser {
  private readonly separator?: string;
  private state: OptimisticTokenParserState = OptimisticTokenParserState.VALUE;
  private mode: TokenParserMode | undefined = undefined;
  private key: JsonKey = undefined;
  private currentValue: JsonStruct | undefined = undefined;
  public value: JsonStruct | undefined = undefined;
  private stack: OptimisticStackElement[] = [];

  constructor(opts?: OptimisticTokenParserOptions) {
    opts = { ...defaultOpts, ...opts };

    this.separator = opts.separator;
  }

  private push(): void {
    this.stack.push({
      key: this.key,
      value: this.currentValue as JsonStruct,
      mode: this.mode,
    });
  }

  private pop(): void {
    ({
      key: this.key,
      value: this.currentValue,
      mode: this.mode,
    } = this.stack.pop() as OptimisticStackElement);

    this.state =
      this.mode !== undefined
        ? OptimisticTokenParserState.COMMA
        : OptimisticTokenParserState.VALUE;

    this.checkIfEnded();
  }

  private checkIfEnded(): void {
    if (this.stack.length === 0) {
      if (this.separator) {
        this.state = OptimisticTokenParserState.SEPARATOR;
      } else if (this.separator === undefined) {
        this.end();
      }
      // else if separator === '', expect next JSON object.
    }
  }

  public get isEnded(): boolean {
    return this.state === OptimisticTokenParserState.ENDED;
  }

  private setStateIfComplete(
    state: OptimisticTokenParserState,
    type: "complete" | "incomplete",
  ): void {
    if (type === "complete") {
      this.state = state;
    }
  }

  private setCurrentValue(value: JsonStruct): void {
    if (this.value === undefined) {
      this.value = value;
    }

    this.currentValue = value;
  }

  public write({
    token,
    value,
    type,
  }: Omit<OptimisticParsedTokenInfo, "offset">): void {
    try {
      if (this.state === OptimisticTokenParserState.VALUE) {
        if (
          token === TokenType.STRING ||
          token === TokenType.NUMBER ||
          token === TokenType.TRUE ||
          token === TokenType.FALSE ||
          token === TokenType.NULL
        ) {
          if (this.mode === TokenParserMode.OBJECT) {
            (this.currentValue as JsonObject)[this.key as string] = value;
            this.setStateIfComplete(OptimisticTokenParserState.COMMA, type);
          } else if (this.mode === TokenParserMode.ARRAY) {
            (this.currentValue as JsonArray)[this.key as number] = value;
            this.setStateIfComplete(OptimisticTokenParserState.COMMA, type);
          }

          this.checkIfEnded();
          return;
        }

        if (token === TokenType.LEFT_BRACE) {
          this.push();
          if (this.mode === TokenParserMode.OBJECT) {
            this.setCurrentValue(
              ((this.currentValue as JsonObject)[this.key as string] = {}),
            );
          } else if (this.mode === TokenParserMode.ARRAY) {
            const val = {};
            (this.currentValue as JsonArray)[this.key as number] = val;
            this.setCurrentValue(val);
          } else {
            this.setCurrentValue({});
          }
          this.mode = TokenParserMode.OBJECT;
          this.setStateIfComplete(OptimisticTokenParserState.KEY, type);
          this.key = undefined;
          return;
        }

        if (token === TokenType.LEFT_BRACKET) {
          this.push();
          if (this.mode === TokenParserMode.OBJECT) {
            this.setCurrentValue(
              ((this.currentValue as JsonObject)[this.key as string] = []),
            );
          } else if (this.mode === TokenParserMode.ARRAY) {
            const val: JsonArray = [];
            (this.currentValue as JsonArray)[this.key as number] = val;
            this.setCurrentValue(val);
          } else {
            this.setCurrentValue([]);
          }
          this.mode = TokenParserMode.ARRAY;
          this.setStateIfComplete(OptimisticTokenParserState.VALUE, type);
          this.key = 0;
          return;
        }

        if (
          this.mode === TokenParserMode.ARRAY &&
          token === TokenType.RIGHT_BRACKET &&
          (this.currentValue as JsonArray).length === 0
        ) {
          this.pop();
          return;
        }
      }

      if (this.state === OptimisticTokenParserState.KEY) {
        if (token === TokenType.STRING) {
          this.key = value as string;
          (this.currentValue as JsonObject)[this.key] = undefined;
          this.setStateIfComplete(OptimisticTokenParserState.COLON, type);
          return;
        }

        if (
          token === TokenType.RIGHT_BRACE &&
          Object.keys(this.currentValue as JsonObject).length === 0
        ) {
          this.pop();
          return;
        }
      }

      if (this.state === OptimisticTokenParserState.COLON) {
        if (token === TokenType.COLON) {
          this.setStateIfComplete(OptimisticTokenParserState.VALUE, type);
          return;
        }
      }

      if (this.state === OptimisticTokenParserState.COMMA) {
        if (token === TokenType.COMMA) {
          if (this.mode === TokenParserMode.ARRAY) {
            this.setStateIfComplete(OptimisticTokenParserState.VALUE, type);
            (this.key as number) += 1;
            return;
          }

          /* istanbul ignore else */
          if (this.mode === TokenParserMode.OBJECT) {
            this.setStateIfComplete(OptimisticTokenParserState.KEY, type);
            return;
          }
        }

        if (
          (token === TokenType.RIGHT_BRACE &&
            this.mode === TokenParserMode.OBJECT) ||
          (token === TokenType.RIGHT_BRACKET &&
            this.mode === TokenParserMode.ARRAY)
        ) {
          this.pop();
          return;
        }
      }

      if (this.state === OptimisticTokenParserState.SEPARATOR) {
        if (token === TokenType.SEPARATOR && value === this.separator) {
          this.setStateIfComplete(OptimisticTokenParserState.VALUE, type);
          return;
        }
      }

      throw new OptimisticTokenParserError(
        `Unexpected ${TokenType[token]} (${JSON.stringify(
          value,
        )}) in state ${TokenParserStateToString(this.state)}`,
      );
    } catch (err: any) {
      this.error(err);
    }
  }

  public error(err: Error): void {
    if (this.state !== OptimisticTokenParserState.ENDED) {
      this.state = OptimisticTokenParserState.ERROR;
    }

    this.onError(err);
  }

  public end(): void {
    if (
      (this.state !== OptimisticTokenParserState.VALUE &&
        this.state !== OptimisticTokenParserState.SEPARATOR) ||
      this.stack.length > 0
    ) {
      this.error(
        new Error(
          `Parser ended in mid-parsing (state: ${TokenParserStateToString(
            this.state,
          )}). Either not all the data was received or the data was invalid.`,
        ),
      );
    } else {
      this.state = OptimisticTokenParserState.ENDED;
      this.onEnd();
    }
  }

  public onError(err: Error): void {
    // Override me
    throw err;
  }

  public onEnd(): void {
    // Override me
  }
}

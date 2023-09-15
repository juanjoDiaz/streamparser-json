import {
  BufferedString,
  NonBufferedString,
  type StringBuilder,
} from "../utils/bufferedString.ts";
import TokenType from "../utils/types/tokenType.ts";
import { charset, escapedSequences } from "../utils/utf-8.ts";
import type { OptimisticParsedTokenInfo } from "./types.ts";

// Tokenizer States
const enum OptimisticTokenizerStates {
  START,
  ENDED,
  ERROR,
  TRUE1,
  TRUE2,
  TRUE3,
  FALSE1,
  FALSE2,
  FALSE3,
  FALSE4,
  NULL1,
  NULL2,
  NULL3,
  STRING_DEFAULT,
  STRING_AFTER_BACKSLASH,
  STRING_UNICODE_DIGIT_1,
  STRING_UNICODE_DIGIT_2,
  STRING_UNICODE_DIGIT_3,
  STRING_UNICODE_DIGIT_4,
  STRING_INCOMPLETE_CHAR,
  NUMBER_AFTER_INITIAL_MINUS,
  NUMBER_AFTER_INITIAL_ZERO,
  NUMBER_AFTER_INITIAL_NON_ZERO,
  NUMBER_AFTER_FULL_STOP,
  NUMBER_AFTER_DECIMAL,
  NUMBER_AFTER_E,
  NUMBER_AFTER_E_AND_SIGN,
  NUMBER_AFTER_E_AND_DIGIT,
  SEPARATOR,
}

function OptimisticTokenizerStateToString(
  tokenizerState: OptimisticTokenizerStates
): string {
  return [
    "START",
    "ENDED",
    "ERROR",
    "TRUE1",
    "TRUE2",
    "TRUE3",
    "FALSE1",
    "FALSE2",
    "FALSE3",
    "FALSE4",
    "NULL1",
    "NULL2",
    "NULL3",
    "STRING_DEFAULT",
    "STRING_AFTER_BACKSLASH",
    "STRING_UNICODE_DIGIT_1",
    "STRING_UNICODE_DIGIT_2",
    "STRING_UNICODE_DIGIT_3",
    "STRING_UNICODE_DIGIT_4",
    "STRING_INCOMPLETE_CHAR",
    "NUMBER_AFTER_INITIAL_MINUS",
    "NUMBER_AFTER_INITIAL_ZERO",
    "NUMBER_AFTER_INITIAL_NON_ZERO",
    "NUMBER_AFTER_FULL_STOP",
    "NUMBER_AFTER_DECIMAL",
    "NUMBER_AFTER_E",
    "NUMBER_AFTER_E_AND_SIGN",
    "NUMBER_AFTER_E_AND_DIGIT",
    "SEPARATOR",
  ][tokenizerState];
}

export interface OptimisticTokenizerOptions {
  stringBufferSize?: number;
  numberBufferSize?: number;
  separator?: string;
}

const defaultOpts: OptimisticTokenizerOptions = {
  stringBufferSize: 0,
  numberBufferSize: 0,
  separator: undefined,
};

export class OptimisticTokenizerError extends Error {
  constructor(message: string) {
    super(message);
    // Typescript is broken. This is a workaround
    Object.setPrototypeOf(this, OptimisticTokenizerError.prototype);
  }
}

export class OptimisticTokenizer {
  private state = OptimisticTokenizerStates.START;

  private separator?: string;
  private separatorBytes?: Uint8Array;
  private separatorIndex = 0;
  private bufferedString: StringBuilder;
  private bufferedNumber: StringBuilder;

  private unicode?: string; // unicode escapes
  private highSurrogate?: number;
  private bytes_remaining = 0; // number of bytes remaining in multi byte utf8 char to read after split boundary
  private bytes_in_sequence = 0; // bytes in multi byte utf8 char to read
  private char_split_buffer = new Uint8Array(4); // for rebuilding chars split before boundary is reached
  private encoder = new TextEncoder();
  private offset = -1;

  constructor(opts?: OptimisticTokenizerOptions) {
    opts = { ...defaultOpts, ...opts };

    this.bufferedString =
      opts.stringBufferSize && opts.stringBufferSize > 4
        ? new BufferedString(opts.stringBufferSize)
        : new NonBufferedString();
    this.bufferedNumber =
      opts.numberBufferSize && opts.numberBufferSize > 0
        ? new BufferedString(opts.numberBufferSize)
        : new NonBufferedString();

    this.separator = opts.separator;
    this.separatorBytes = opts.separator
      ? this.encoder.encode(opts.separator)
      : undefined;
  }

  public get isEnded(): boolean {
    return this.state === OptimisticTokenizerStates.ENDED;
  }

  public write(input: Iterable<number> | string): void {
    try {
      let buffer: Uint8Array;
      if (input instanceof Uint8Array) {
        buffer = input;
      } else if (typeof input === "string") {
        buffer = this.encoder.encode(input);
      } else if (
        (typeof input === "object" && "buffer" in input) ||
        Array.isArray(input)
      ) {
        buffer = Uint8Array.from(input);
      } else {
        throw new TypeError(
          "Unexpected type. The `write` function only accepts Arrays, TypedArrays and Strings."
        );
      }

      for (let i = 0; i < buffer.length; i += 1) {
        const n = buffer[i];

        switch (this.state) {
          case OptimisticTokenizerStates.START:
            this.offset += 1;

            if (this.separatorBytes && n === this.separatorBytes[0]) {
              if (this.separatorBytes.length === 1) {
                this.state = OptimisticTokenizerStates.START;
                this.onToken({
                  token: TokenType.SEPARATOR,
                  value: this.separator as string,
                  offset: this.offset + this.separatorBytes.length - 1,
                  type: "complete",
                });
                continue;
              }
              this.state = OptimisticTokenizerStates.SEPARATOR;
              continue;
            }

            if (
              n === charset.SPACE ||
              n === charset.NEWLINE ||
              n === charset.CARRIAGE_RETURN ||
              n === charset.TAB
            ) {
              // whitespace
              continue;
            }

            if (n === charset.LEFT_CURLY_BRACKET) {
              this.onToken({
                token: TokenType.LEFT_BRACE,
                value: "{",
                offset: this.offset,
                type: "complete",
              });
              continue;
            }
            if (n === charset.RIGHT_CURLY_BRACKET) {
              this.onToken({
                token: TokenType.RIGHT_BRACE,
                value: "}",
                offset: this.offset,
                type: "complete",
              });
              continue;
            }
            if (n === charset.LEFT_SQUARE_BRACKET) {
              this.onToken({
                token: TokenType.LEFT_BRACKET,
                value: "[",
                offset: this.offset,
                type: "complete",
              });
              continue;
            }
            if (n === charset.RIGHT_SQUARE_BRACKET) {
              this.onToken({
                token: TokenType.RIGHT_BRACKET,
                value: "]",
                offset: this.offset,
                type: "complete",
              });
              continue;
            }
            if (n === charset.COLON) {
              this.onToken({
                token: TokenType.COLON,
                value: ":",
                offset: this.offset,
                type: "complete",
              });
              continue;
            }
            if (n === charset.COMMA) {
              this.onToken({
                token: TokenType.COMMA,
                value: ",",
                offset: this.offset,
                type: "complete",
              });
              continue;
            }

            if (n === charset.LATIN_SMALL_LETTER_T) {
              this.state = OptimisticTokenizerStates.TRUE1;
              continue;
            }

            if (n === charset.LATIN_SMALL_LETTER_F) {
              this.state = OptimisticTokenizerStates.FALSE1;
              continue;
            }

            if (n === charset.LATIN_SMALL_LETTER_N) {
              this.state = OptimisticTokenizerStates.NULL1;
              continue;
            }

            if (n === charset.QUOTATION_MARK) {
              this.bufferedString.reset();
              this.state = OptimisticTokenizerStates.STRING_DEFAULT;
              continue;
            }

            if (n >= charset.DIGIT_ONE && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.reset();
              this.bufferedNumber.appendChar(n);
              this.state =
                OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO;
              continue;
            }

            if (n === charset.DIGIT_ZERO) {
              this.bufferedNumber.reset();
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_ZERO;
              continue;
            }

            if (n === charset.HYPHEN_MINUS) {
              this.bufferedNumber.reset();
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_MINUS;
              continue;
            }

            break;
          // STRING
          case OptimisticTokenizerStates.STRING_DEFAULT:
            if (n === charset.QUOTATION_MARK) {
              const string = this.bufferedString.toString();
              this.state = OptimisticTokenizerStates.START;
              this.onToken({
                token: TokenType.STRING,
                value: string,
                offset: this.offset,
                type: "complete",
              });
              this.offset += this.bufferedString.byteLength + 1;
              continue;
            }

            if (n === charset.REVERSE_SOLIDUS) {
              this.state = OptimisticTokenizerStates.STRING_AFTER_BACKSLASH;
              continue;
            }

            if (n >= 128) {
              // Parse multi byte (>=128) chars one at a time
              if (n >= 194 && n <= 223) {
                this.bytes_in_sequence = 2;
              } else if (n <= 239) {
                this.bytes_in_sequence = 3;
              } else {
                this.bytes_in_sequence = 4;
              }

              if (this.bytes_in_sequence <= buffer.length - i) {
                // if bytes needed to complete char fall outside buffer length, we have a boundary split
                this.bufferedString.appendBuf(
                  buffer,
                  i,
                  i + this.bytes_in_sequence
                );
                i += this.bytes_in_sequence - 1;
                continue;
              }

              this.bytes_remaining = i + this.bytes_in_sequence - buffer.length;
              this.char_split_buffer.set(buffer.subarray(i));
              i = buffer.length - 1;
              this.state = OptimisticTokenizerStates.STRING_INCOMPLETE_CHAR;
              continue;
            }

            if (n >= charset.SPACE) {
              this.bufferedString.appendChar(n);
              continue;
            }

            break;
          case OptimisticTokenizerStates.STRING_INCOMPLETE_CHAR:
            // check for carry over of a multi byte char split between data chunks
            // & fill temp buffer it with start of this data chunk up to the boundary limit set in the last iteration
            this.char_split_buffer.set(
              buffer.subarray(i, i + this.bytes_remaining),
              this.bytes_in_sequence - this.bytes_remaining
            );
            this.bufferedString.appendBuf(
              this.char_split_buffer,
              0,
              this.bytes_in_sequence
            );
            i = this.bytes_remaining - 1;
            this.state = OptimisticTokenizerStates.STRING_DEFAULT;
            continue;
          case OptimisticTokenizerStates.STRING_AFTER_BACKSLASH: {
            const controlChar = escapedSequences[n];
            if (controlChar) {
              this.bufferedString.appendChar(controlChar);
              this.state = OptimisticTokenizerStates.STRING_DEFAULT;
              continue;
            }

            if (n === charset.LATIN_SMALL_LETTER_U) {
              this.unicode = "";
              this.state = OptimisticTokenizerStates.STRING_UNICODE_DIGIT_1;
              continue;
            }

            break;
          }
          case OptimisticTokenizerStates.STRING_UNICODE_DIGIT_1:
          case OptimisticTokenizerStates.STRING_UNICODE_DIGIT_2:
          case OptimisticTokenizerStates.STRING_UNICODE_DIGIT_3:
            if (
              (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) ||
              (n >= charset.LATIN_CAPITAL_LETTER_A &&
                n <= charset.LATIN_CAPITAL_LETTER_F) ||
              (n >= charset.LATIN_SMALL_LETTER_A &&
                n <= charset.LATIN_SMALL_LETTER_F)
            ) {
              this.unicode += String.fromCharCode(n);
              this.state += 1;
              continue;
            }
            break;
          case OptimisticTokenizerStates.STRING_UNICODE_DIGIT_4:
            if (
              (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) ||
              (n >= charset.LATIN_CAPITAL_LETTER_A &&
                n <= charset.LATIN_CAPITAL_LETTER_F) ||
              (n >= charset.LATIN_SMALL_LETTER_A &&
                n <= charset.LATIN_SMALL_LETTER_F)
            ) {
              const intVal = parseInt(
                this.unicode + String.fromCharCode(n),
                16
              );
              if (this.highSurrogate === undefined) {
                if (intVal >= 0xd800 && intVal <= 0xdbff) {
                  // <55296,56319> - highSurrogate
                  this.highSurrogate = intVal;
                } else {
                  this.bufferedString.appendBuf(
                    this.encoder.encode(String.fromCharCode(intVal))
                  );
                }
              } else {
                if (intVal >= 0xdc00 && intVal <= 0xdfff) {
                  // <56320,57343> - lowSurrogate
                  this.bufferedString.appendBuf(
                    this.encoder.encode(
                      String.fromCharCode(this.highSurrogate, intVal)
                    )
                  );
                } else {
                  this.bufferedString.appendBuf(
                    this.encoder.encode(String.fromCharCode(this.highSurrogate))
                  );
                }
                this.highSurrogate = undefined;
              }
              this.state = OptimisticTokenizerStates.STRING_DEFAULT;
              continue;
            }
            break;
          // Number
          case OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_MINUS:
            if (n === charset.DIGIT_ZERO) {
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_ZERO;
              continue;
            }

            if (n >= charset.DIGIT_ONE && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              this.state =
                OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO;
              continue;
            }

            break;
          case OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_ZERO:
            if (n === charset.FULL_STOP) {
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_FULL_STOP;
              continue;
            }

            if (
              n === charset.LATIN_SMALL_LETTER_E ||
              n === charset.LATIN_CAPITAL_LETTER_E
            ) {
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_E;
              continue;
            }

            i -= 1;
            this.state = OptimisticTokenizerStates.START;
            this.emitNumber();
            continue;
          case OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              continue;
            }

            if (n === charset.FULL_STOP) {
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_FULL_STOP;
              continue;
            }

            if (
              n === charset.LATIN_SMALL_LETTER_E ||
              n === charset.LATIN_CAPITAL_LETTER_E
            ) {
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_E;
              continue;
            }

            i -= 1;
            this.state = OptimisticTokenizerStates.START;
            this.emitNumber();
            continue;
          case OptimisticTokenizerStates.NUMBER_AFTER_FULL_STOP:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_DECIMAL;
              continue;
            }

            break;
          case OptimisticTokenizerStates.NUMBER_AFTER_DECIMAL:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              continue;
            }

            if (
              n === charset.LATIN_SMALL_LETTER_E ||
              n === charset.LATIN_CAPITAL_LETTER_E
            ) {
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_E;
              continue;
            }

            i -= 1;
            this.state = OptimisticTokenizerStates.START;
            this.emitNumber();
            continue;

          // @ts-ignore fallthrough
          case OptimisticTokenizerStates.NUMBER_AFTER_E:
            if (n === charset.PLUS_SIGN || n === charset.HYPHEN_MINUS) {
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_E_AND_SIGN;
              continue;
            }
          case OptimisticTokenizerStates.NUMBER_AFTER_E_AND_SIGN:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              this.state = OptimisticTokenizerStates.NUMBER_AFTER_E_AND_DIGIT;
              continue;
            }

            break;
          case OptimisticTokenizerStates.NUMBER_AFTER_E_AND_DIGIT:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              continue;
            }

            i -= 1;
            this.state = OptimisticTokenizerStates.START;
            this.emitNumber();
            continue;
          // TRUE
          case OptimisticTokenizerStates.TRUE1:
            if (n === charset.LATIN_SMALL_LETTER_R) {
              this.state = OptimisticTokenizerStates.TRUE2;
              continue;
            }
            break;
          case OptimisticTokenizerStates.TRUE2:
            if (n === charset.LATIN_SMALL_LETTER_U) {
              this.state = OptimisticTokenizerStates.TRUE3;
              continue;
            }
            break;
          case OptimisticTokenizerStates.TRUE3:
            if (n === charset.LATIN_SMALL_LETTER_E) {
              this.state = OptimisticTokenizerStates.START;
              this.onToken({
                token: TokenType.TRUE,
                value: true,
                offset: this.offset,
                type: "complete",
              });
              this.offset += 3;
              continue;
            }
            break;
          // FALSE
          case OptimisticTokenizerStates.FALSE1:
            if (n === charset.LATIN_SMALL_LETTER_A) {
              this.state = OptimisticTokenizerStates.FALSE2;
              continue;
            }
            break;
          case OptimisticTokenizerStates.FALSE2:
            if (n === charset.LATIN_SMALL_LETTER_L) {
              this.state = OptimisticTokenizerStates.FALSE3;
              continue;
            }
            break;
          case OptimisticTokenizerStates.FALSE3:
            if (n === charset.LATIN_SMALL_LETTER_S) {
              this.state = OptimisticTokenizerStates.FALSE4;
              continue;
            }
            break;
          case OptimisticTokenizerStates.FALSE4:
            if (n === charset.LATIN_SMALL_LETTER_E) {
              this.state = OptimisticTokenizerStates.START;
              this.onToken({
                token: TokenType.FALSE,
                value: false,
                offset: this.offset,
                type: "complete",
              });
              this.offset += 4;
              continue;
            }
            break;
          // NULL
          case OptimisticTokenizerStates.NULL1:
            if (n === charset.LATIN_SMALL_LETTER_U) {
              this.state = OptimisticTokenizerStates.NULL2;
              continue;
            }
            break;
          case OptimisticTokenizerStates.NULL2:
            if (n === charset.LATIN_SMALL_LETTER_L) {
              this.state = OptimisticTokenizerStates.NULL3;
              continue;
            }
            break;
          case OptimisticTokenizerStates.NULL3:
            if (n === charset.LATIN_SMALL_LETTER_L) {
              this.state = OptimisticTokenizerStates.START;
              this.onToken({
                token: TokenType.NULL,
                value: null,
                offset: this.offset,
                type: "complete",
              });
              this.offset += 3;
              continue;
            }
            break;
          case OptimisticTokenizerStates.SEPARATOR:
            this.separatorIndex += 1;
            if (
              !this.separatorBytes ||
              n !== this.separatorBytes[this.separatorIndex]
            ) {
              break;
            }
            if (this.separatorIndex === this.separatorBytes.length - 1) {
              this.state = OptimisticTokenizerStates.START;
              this.onToken({
                token: TokenType.SEPARATOR,
                value: this.separator as string,
                offset: this.offset + this.separatorIndex,
                type: "complete",
              });
              this.separatorIndex = 0;
            }
            continue;
          case OptimisticTokenizerStates.ENDED:
            if (
              n === charset.SPACE ||
              n === charset.NEWLINE ||
              n === charset.CARRIAGE_RETURN ||
              n === charset.TAB
            ) {
              // whitespace
              continue;
            }
        }

        throw new OptimisticTokenizerError(
          `Unexpected "${String.fromCharCode(
            n
          )}" at position "${i}" in state ${OptimisticTokenizerStateToString(
            this.state
          )}`
        );
      }

      switch (this.state) {
        case OptimisticTokenizerStates.TRUE1:
        case OptimisticTokenizerStates.TRUE2:
        case OptimisticTokenizerStates.TRUE3:
          this.onToken({
            token: TokenType.TRUE,
            value: true,
            offset: this.offset,
            type: "incomplete",
          });
          break;
        case OptimisticTokenizerStates.FALSE1:
        case OptimisticTokenizerStates.FALSE2:
        case OptimisticTokenizerStates.FALSE3:
        case OptimisticTokenizerStates.FALSE4:
          this.onToken({
            token: TokenType.FALSE,
            value: false,
            offset: this.offset,
            type: "incomplete",
          });
          break;
        case OptimisticTokenizerStates.NULL1:
        case OptimisticTokenizerStates.NULL2:
        case OptimisticTokenizerStates.NULL3:
          this.onToken({
            token: TokenType.NULL,
            value: null,
            offset: this.offset,
            type: "incomplete",
          });
          break;
        case OptimisticTokenizerStates.STRING_DEFAULT: {
          const string = this.bufferedString.toString();
          this.onToken({
            token: TokenType.STRING,
            value: string,
            offset: this.offset,
            type: "incomplete",
          });
          break;
        }
        case OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_ZERO:
        case OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO:
        case OptimisticTokenizerStates.NUMBER_AFTER_DECIMAL:
        case OptimisticTokenizerStates.NUMBER_AFTER_E_AND_DIGIT:
          this.onToken({
            token: TokenType.NUMBER,
            value: this.parseNumber(this.bufferedNumber.toString()),
            offset: this.offset,
            type: "incomplete",
          });
      }
    } catch (err: any) {
      this.error(err);
    }
  }

  private emitNumber(): void {
    this.onToken({
      token: TokenType.NUMBER,
      value: this.parseNumber(this.bufferedNumber.toString()),
      offset: this.offset,
      type: "complete",
    });
    this.offset += this.bufferedNumber.byteLength - 1;
  }

  protected parseNumber(numberStr: string): number {
    return Number(numberStr);
  }

  public error(err: Error): void {
    if (this.state !== OptimisticTokenizerStates.ENDED) {
      this.state = OptimisticTokenizerStates.ERROR;
    }

    this.onError(err);
  }

  public end(): void {
    switch (this.state) {
      case OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_ZERO:
      case OptimisticTokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO:
      case OptimisticTokenizerStates.NUMBER_AFTER_DECIMAL:
      case OptimisticTokenizerStates.NUMBER_AFTER_E_AND_DIGIT:
        this.state = OptimisticTokenizerStates.ENDED;
        this.emitNumber();
        this.onEnd();
        break;
      case OptimisticTokenizerStates.START:
      case OptimisticTokenizerStates.ERROR:
      case OptimisticTokenizerStates.SEPARATOR:
        this.state = OptimisticTokenizerStates.ENDED;
        this.onEnd();
        break;
      default:
        this.error(
          new OptimisticTokenizerError(
            `Tokenizer ended in the middle of a token (state: ${OptimisticTokenizerStateToString(
              this.state
            )}). Either not all the data was received or the data was invalid.`
          )
        );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onToken(parsedToken: OptimisticParsedTokenInfo): void {
    // Override me
    throw new OptimisticTokenizerError(
      'Can\'t emit tokens before the "onToken" callback has been set up.'
    );
  }

  public onError(err: Error): void {
    // Override me
    throw err;
  }

  public onEnd(): void {
    // Override me
  }
}

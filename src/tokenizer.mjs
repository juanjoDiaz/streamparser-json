import { charset, escapedSequences } from './utils/utf-8.mjs';
import { NonBufferedString, BufferedString } from './utils/bufferedString.mjs';
import { TokenType } from './utils/constants.mjs';
import { getKeyFromValue } from './utils/utils.mjs';

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

// Tokenizer States
const TokenizerStates = {
  START: 0x11,
  STOP: 0x12,
  ERROR: 0x13,
  TRUE1: 0x21,
  TRUE2: 0x22,
  TRUE3: 0x23,
  FALSE1: 0x31,
  FALSE2: 0x32,
  FALSE3: 0x33,
  FALSE4: 0x34,
  NULL1: 0x41,
  NULL2: 0x42,
  NULL3: 0x43,
  STRING_DEFAULT: 0x51,
  STRING_AFTER_BACKSLASH: 0x52,
  STRING_UNICODE_DIGIT_1: 0x53,
  STRING_UNICODE_DIGIT_2: 0x54,
  STRING_UNICODE_DIGIT_3: 0x55,
  STRING_UNICODE_DIGIT_4: 0x56,
  STRING_INCOMPLETE_CHAR: 0x57,
  NUMBER_AFTER_INITIAL_MINUS: 0x61,
  NUMBER_AFTER_INITIAL_ZERO: 0x62,
  NUMBER_AFTER_INITIAL_NON_ZERO: 0x63,
  NUMBER_AFTER_FULL_STOP: 0x64,
  NUMBER_AFTER_DECIMAL: 0x65,
  NUMBER_AFTER_E: 0x66,
  NUMBER_AFTER_E_AND_SIGN: 0x67,
  NUMBER_AFTER_E_AND_DIGIT: 0x68,
};

const defaultOpts = {
  stringBufferSize: 0,
  numberBufferSize: 0,
};

export default class Parser {
  constructor (opts) {
    opts = { ...defaultOpts, ...opts };

    this.state =  TokenizerStates.START;

    this.bufferedString = opts.stringBufferSize > 4 ? new BufferedString(opts.stringBufferSize) : new NonBufferedString();
    this.bufferedNumber = opts.numberBufferSize > 0 ? new BufferedString(opts.numberBufferSize) : new NonBufferedString();

    this.unicode = undefined; // unicode escapes
    this.highSurrogate = undefined;
    this.bytes_remaining = 0; // number of bytes remaining in multi byte utf8 char to read after split boundary
    this.bytes_in_sequence = 0; // bytes in multi byte utf8 char to read
    this.char_split_buffer = new Uint8Array(4); // for rebuilding chars split before boundary is reached
    this.encoder = new TextEncoder('utf-8');

    this.offset = -1;
  }
  write(buffer) {
    if (typeof buffer === 'string') {
      buffer = this.encoder.encode(buffer);
    } else if (buffer.buffer || Array.isArray(buffer)){
      buffer = Uint8Array.from(buffer)
    } else {
      throw new TypeError('Unexpected type. The `write` function only accepts TypeArrays and Strings.')
    }

    for (var i = 0; i < buffer.length; i++) {
      const n = buffer[i]; // get current byte from buffer
      switch(this.state) {
        case TokenizerStates.START:
          this.offset += 1;

          if (n === charset.SPACE
            || n === charset.NEWLINE
            || n === charset.CARRIAGE_RETURN
            || n === charset.TAB) {
            // whitespace
            continue;
          }

          if (n === charset.LEFT_CURLY_BRACKET) {
            this.onToken(LEFT_BRACE, '{', this.offset);
            continue;
          }
          if (n === charset.RIGHT_CURLY_BRACKET) {
            this.onToken(RIGHT_BRACE, '}', this.offset);
            continue;
          }
          if (n === charset.LEFT_SQUARE_BRACKET) {
            this.onToken(LEFT_BRACKET, '[', this.offset);
            continue;
          }
          if (n === charset.RIGHT_SQUARE_BRACKET) {
            this.onToken(RIGHT_BRACKET, ']', this.offset);
            continue;
          }
          if (n === charset.COLON) {
            this.onToken(COLON, ':', this.offset);
            continue;
          }
          if (n === charset.COMMA){
            this.onToken(COMMA, ',', this.offset);
            continue;
          }

          if(n === charset.LATIN_SMALL_LETTER_T){
            this.state =  TokenizerStates.TRUE1; 
            continue;
          }

          if(n === charset.LATIN_SMALL_LETTER_F){
            this.state =  TokenizerStates.FALSE1; 
            continue;
          }
          
          if(n === charset.LATIN_SMALL_LETTER_N){
            this.state =  TokenizerStates.NULL1;
            continue;
          }
          
          if(n === charset.QUOTATION_MARK){
            this.bufferedString.reset();
            this.state =  TokenizerStates.STRING_DEFAULT;
            continue;
          }

          if (n >= charset.DIGIT_ONE && n <= charset.DIGIT_NINE){
            this.bufferedNumber.reset();
            this.bufferedNumber.appendChar(n);
            this.state =  TokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO;
            continue;
          }

          if (n === charset.DIGIT_ZERO) {
            this.bufferedNumber.reset();
            this.bufferedNumber.appendChar(n);
            this.state =  TokenizerStates.NUMBER_AFTER_INITIAL_ZERO;
            continue;
          }

          if(n === charset.HYPHEN_MINUS) {
            this.bufferedNumber.reset();
            this.bufferedNumber.appendChar(n);
            this.state =  TokenizerStates.NUMBER_AFTER_INITIAL_MINUS;
            continue;
          }

          break;
        // STRING
        case TokenizerStates.STRING_DEFAULT:
          if (n === charset.QUOTATION_MARK) {
            const string = this.bufferedString.toString();
            this.onToken(STRING, string, this.offset);
            this.offset += this.bufferedString.byteLength + 1;
            this.state =  TokenizerStates.START;
            continue;
          }
          
          if (n === charset.REVERSE_SOLIDUS) {
            this.state =  TokenizerStates.STRING_AFTER_BACKSLASH;
            continue;
          }

          if (n >= 128) { // Parse multi byte (>=128) chars one at a time
            if (n >= 194 && n <= 223) {
              this.bytes_in_sequence = 2;
            } else if (n <= 239) {
              this.bytes_in_sequence = 3;
            } else {
              this.bytes_in_sequence = 4;
            }

            if (this.bytes_in_sequence <= buffer.length - i) { // if bytes needed to complete char fall outside buffer length, we have a boundary split
              this.bufferedString.appendBuf(buffer, i, i + this.bytes_in_sequence);
              i += this.bytes_in_sequence - 1;
              continue;
            }

            this.bytes_remaining = i + this.bytes_in_sequence - buffer.length;
            this.char_split_buffer.set(buffer.subarray(i));
            i = buffer.length - 1;
            this.state =  TokenizerStates.STRING_INCOMPLETE_CHAR;
            continue;
          }

          if (n >= charset.SPACE) {
            this.bufferedString.appendChar(n);
            continue;
          }
          
          break;
        case TokenizerStates.STRING_INCOMPLETE_CHAR:
          // check for carry over of a multi byte char split between data chunks
          // & fill temp buffer it with start of this data chunk up to the boundary limit set in the last iteration
          this.char_split_buffer.set(buffer.subarray(i, i + this.bytes_remaining), this.bytes_in_sequence - this.bytes_remaining);
          this.bufferedString.appendBuf(this.char_split_buffer, 0, this.bytes_in_sequence);
          i = this.bytes_remaining - 1;
          this.state =  TokenizerStates.STRING_DEFAULT;
          continue;
        case TokenizerStates.STRING_AFTER_BACKSLASH:
          const controlChar = escapedSequences[n];
          if (controlChar) {
            this.bufferedString.appendChar(controlChar);
            this.state =  TokenizerStates.STRING_DEFAULT;
            continue;
          }
            
          if (n === charset.LATIN_SMALL_LETTER_U) {
            this.unicode = "";
            this.state =  TokenizerStates.STRING_UNICODE_DIGIT_1;
            continue;
          }

          break;
        case TokenizerStates.STRING_UNICODE_DIGIT_1:
        case TokenizerStates.STRING_UNICODE_DIGIT_2:
        case TokenizerStates.STRING_UNICODE_DIGIT_3:
          if ((n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE)
            || (n >= charset.LATIN_CAPITAL_LETTER_A && n <= charset.LATIN_CAPITAL_LETTER_F)
            || (n >= charset.LATIN_SMALL_LETTER_A && n <= charset.LATIN_SMALL_LETTER_F)) {
            this.unicode += String.fromCharCode(n);
            this.state += 1;
            continue;
          }
          break;
        case TokenizerStates.STRING_UNICODE_DIGIT_4:
          if ((n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE)
            || (n >= charset.LATIN_CAPITAL_LETTER_A && n <= charset.LATIN_CAPITAL_LETTER_F)
            || (n >= charset.LATIN_SMALL_LETTER_A && n <= charset.LATIN_SMALL_LETTER_F)) {
            const intVal = parseInt(this.unicode + String.fromCharCode(n), 16);
            if (this.highSurrogate === undefined) {
              if (intVal >= 0xD800 && intVal <= 0xDBFF) { //<55296,56319> - highSurrogate
                this.highSurrogate = intVal;
              } else {
                this.bufferedString.appendBuf(this.encoder.encode(String.fromCharCode(intVal)));
              }
            } else {
              if (intVal >= 0xDC00 && intVal <= 0xDFFF) { //<56320,57343> - lowSurrogate
                this.bufferedString.appendBuf(this.encoder.encode(String.fromCharCode(this.highSurrogate, intVal)));
              } else {
                this.bufferedString.appendBuf(this.encoder.encode(String.fromCharCode(this.highSurrogate)));
              }
              this.highSurrogate = undefined;
            }
            this.state =  TokenizerStates.STRING_DEFAULT;
            continue;
          }
          // Number
          case TokenizerStates.NUMBER_AFTER_INITIAL_MINUS:
            if (n === charset.DIGIT_ZERO) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_INITIAL_ZERO
              continue;
            }

            if (n >= charset.DIGIT_ONE && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO
              continue;
            }
            
            break;
          case TokenizerStates.NUMBER_AFTER_INITIAL_ZERO:
            if (n === charset.FULL_STOP) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_FULL_STOP;
              continue;
            }

            if(n === charset.LATIN_SMALL_LETTER_E
              || n === charset.LATIN_CAPITAL_LETTER_E) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_E;
              continue;
            }

            i -= 1;
            this.emitNumber();
            this.state =  TokenizerStates.START;
            continue;
          case TokenizerStates.NUMBER_AFTER_INITIAL_NON_ZERO:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              continue;
            }

            if (n === charset.FULL_STOP) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_FULL_STOP;
              continue;
            }

            if(n === charset.LATIN_SMALL_LETTER_E
              || n === charset.LATIN_CAPITAL_LETTER_E) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_E;
              continue;
            }

            i -= 1;
            this.emitNumber();
            this.state =  TokenizerStates.START;
            continue;
          case TokenizerStates.NUMBER_AFTER_FULL_STOP:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_DECIMAL;
              continue;
            }

            break;
          case TokenizerStates.NUMBER_AFTER_DECIMAL:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              continue;
            }

            if(n === charset.LATIN_SMALL_LETTER_E || n === charset.LATIN_CAPITAL_LETTER_E) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_E;
              continue;
            }

            i -= 1;
            this.emitNumber();
            this.state =  TokenizerStates.START;
            continue;
          case TokenizerStates.NUMBER_AFTER_E:
            if (n === charset.PLUS_SIGN || n === charset.HYPHEN_MINUS) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_E_AND_SIGN;
              continue;
            }
            // Allow cascading
          case TokenizerStates.NUMBER_AFTER_E_AND_SIGN:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              this.state =  TokenizerStates.NUMBER_AFTER_E_AND_DIGIT;
              continue;
            }

            break;
          case TokenizerStates.NUMBER_AFTER_E_AND_DIGIT:
            if (n >= charset.DIGIT_ZERO && n <= charset.DIGIT_NINE) {
              this.bufferedNumber.appendChar(n);
              continue;
            }

            i -= 1;
            this.emitNumber();
            this.state =  TokenizerStates.START;
            continue;
        // TRUE
        case TokenizerStates.TRUE1:
          if (n === charset.LATIN_SMALL_LETTER_R) { this.state =  TokenizerStates.TRUE2; continue; }
          break;
        case TokenizerStates.TRUE2:
          if (n === charset.LATIN_SMALL_LETTER_U) { this.state =  TokenizerStates.TRUE3; continue; }
          break;
        case TokenizerStates.TRUE3:
          if (n === charset.LATIN_SMALL_LETTER_E) { this.state =  TokenizerStates.START; this.onToken(TRUE, true, this.offset); this.offset += 3; continue; }
          break;
        // FALSE
        case TokenizerStates.FALSE1:
          if (n === charset.LATIN_SMALL_LETTER_A) { this.state =  TokenizerStates.FALSE2; continue; }
          break;
        case TokenizerStates.FALSE2:
          if (n === charset.LATIN_SMALL_LETTER_L) { this.state =  TokenizerStates.FALSE3; continue; }
          break;
        case TokenizerStates.FALSE3:
          if (n === charset.LATIN_SMALL_LETTER_S) { this.state =  TokenizerStates.FALSE4; continue; }
          break;
        case TokenizerStates.FALSE4:
          if (n === charset.LATIN_SMALL_LETTER_E) { this.state =  TokenizerStates.START; this.onToken(FALSE, false, this.offset); this.offset += 4; continue; }
          break;
        // NULL
        case TokenizerStates.NULL1:
          if (n === charset.LATIN_SMALL_LETTER_U) { this.state =  TokenizerStates.NULL2; continue; }
        case TokenizerStates.NULL2:
          if (n === charset.LATIN_SMALL_LETTER_L) { this.state =  TokenizerStates.NULL3; continue; }
        case TokenizerStates.NULL3:
          if (n === charset.LATIN_SMALL_LETTER_L) { this.state =  TokenizerStates.START; this.onToken(NULL, null, this.offset); this.offset += 3; continue; }
      }

      const errorState = this.state;
      if (this.state !== TokenizerStates.STOP || this.state !== TokenizerStates.ERROR) {
        this.state =  TokenizerStates.ERROR;
      }
      throw new Error(`Unexpected "${String.fromCharCode(n)}" at position "${i}" in state ${getKeyFromValue(TokenizerStates, errorState)}`);
    }
  }
  emitNumber() {
    const numberStr = this.bufferedNumber.toString();
    this.onToken(NUMBER, this.parseNumber(numberStr), this.offset);
    this.offset += numberStr.length - 1;
  }
  parseNumber(numberStr) {
    return Number(numberStr);
  }
  onToken(token, value, offset) {
    // Override
  }
}

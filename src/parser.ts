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

// Parser States
const ParserStates = {
  VALUE: 0x1,
  KEY: 0x2,
  COLON: 0x3,
  COMMA: 0x4,
  STOP: 0x10,
  ERROR: 0x11,
}
// Parser Modes
const ParserModes = {
  OBJECT: 0x1,
  ARRAY: 0x2,
}

export default class Parser {
  constructor () {
    this.state = ParserStates.VALUE;
    this.mode = undefined;
    this.key = undefined;
    this.value = undefined;
    this.stack = [];
  }
  push() {
    this.stack.push({ key: this.key, value: this.value, mode: this.mode });
  }
  pop() {
    const value = this.value;
    ({ key: this.key, value: this.value, mode: this.mode } = this.stack.pop());
    this.onValue(value, this.key, this.value, this.stack);
    this.state = this.mode ? ParserStates.COMMA : ParserStates.VALUE;
  }
  write(token, value) {
    if(this.state === ParserStates.VALUE){
      if(token === STRING || token === NUMBER || token === TRUE || token === FALSE || token === NULL) {
        if (this.mode) {
          this.value[this.key] = value;
          this.state = ParserStates.COMMA;
        }
        this.onValue(value, this.key, this.value, this.stack);
        return;
      }

      if(token === LEFT_BRACE){
        this.push();
        this.value = this.value ? this.value[this.key] = {} : {};
        this.mode = ParserModes.OBJECT;
        this.state = ParserStates.KEY;
        this.key = undefined;
        return;
      }

      if(token === LEFT_BRACKET){
        this.push();
        this.value = this.value ? this.value[this.key] = [] : [];
        this.mode = ParserModes.ARRAY;
        this.state = ParserStates.VALUE;
        this.key = 0;
        return;
      }

      if (this.mode === ParserModes.ARRAY && token === RIGHT_BRACKET && this.value.length === 0) {
        this.pop();
        return;
      }
    }

    if(this.state === ParserStates.KEY){
      if (token === STRING) {
        this.key = value;
        this.state = ParserStates.COLON;
        return;
      }

      if (token === RIGHT_BRACE && Object.keys(this.value).length === 0) {
        this.pop();
        return;
      }
    }

    if (this.state === ParserStates.COLON) {
      if (token === COLON) {
        this.state = ParserStates.VALUE;
        return;
      }
    }

    if (this.state === ParserStates.COMMA) {
      if (token === COMMA) {
        if (this.mode === ParserModes.ARRAY) {
          this.state = ParserStates.VALUE;
          this.key += 1;
          return;
        }

        if (this.mode === ParserModes.OBJECT) {
          this.state = ParserStates.KEY;
          return;
        }
      }

      if (token === RIGHT_BRACE && this.mode === ParserModes.OBJECT || token === RIGHT_BRACKET && this.mode === ParserModes.ARRAY) {
        this.pop();
        return;
      }
    }

    const errorState = this.state;
    if (this.state !== ParserStates.STOP || this.state !== ParserStates.ERROR) {
      this.state =  ParserStates.ERROR;
    }
    throw new Error("Unexpected " + getKeyFromValue(TokenType, token) + (("(" + JSON.stringify(value) + ")")) + " in state " + getKeyFromValue(ParserStates, errorState));
  }
  onValue(value, key, parent, stack) {
    // Override me
  }
}

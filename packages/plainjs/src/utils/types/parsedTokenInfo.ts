/**
 * The shape of the tokens emitted by the tokenizer.
 *
 * @module
 */

import type { JsonPrimitive } from "./jsonTypes.js";
import type TokenType from "./tokenType.js";

/**
 * A JSON token, along with where it was found in the JSON stream.
 *
 * This is what the tokenizer passes to its `onToken` callback.
 */
export interface ParsedTokenInfo {
  /** The type of the token. */
  token: TokenType;
  /** The value of the token. */
  value: JsonPrimitive;
  /** The offset, in bytes, at which the token was found in the stream. */
  offset: number;
  /**
   * Whether the token is still being tokenized and might grow, which only
   * happens when the `emitPartialTokens` option is enabled.
   */
  partial?: boolean;
}

/** A {@link ParsedTokenInfo} for a `{` token. */
export interface ParsedLeftBraceTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.LEFT_BRACE}. */
  token: TokenType.LEFT_BRACE;
  /** Always `"{"`. */
  value: "{";
}
/** A {@link ParsedTokenInfo} for a `}` token. */
export interface ParsedRightBraceTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.RIGHT_BRACE}. */
  token: TokenType.RIGHT_BRACE;
  /** Always `"}"`. */
  value: "}";
}
/** A {@link ParsedTokenInfo} for a `[` token. */
export interface ParsedLeftBracketTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.LEFT_BRACKET}. */
  token: TokenType.LEFT_BRACKET;
  /** Always `"["`. */
  value: "[";
}
/** A {@link ParsedTokenInfo} for a `]` token. */
export interface ParsedRightBracketTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.RIGHT_BRACKET}. */
  token: TokenType.RIGHT_BRACKET;
  /** Always `"]"`. */
  value: "]";
}
/** A {@link ParsedTokenInfo} for a `:` token. */
export interface ParsedColonTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.COLON}. */
  token: TokenType.COLON;
  /** Always `":"`. */
  value: ":";
}
/** A {@link ParsedTokenInfo} for a `,` token. */
export interface ParsedCommaTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.COMMA}. */
  token: TokenType.COMMA;
  /** Always `","`. */
  value: ",";
}
/** A {@link ParsedTokenInfo} for a `true` token. */
export interface ParsedTrueTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.TRUE}. */
  token: TokenType.TRUE;
  /** Always `true`. */
  value: true;
}
/** A {@link ParsedTokenInfo} for a `false` token. */
export interface ParsedFalseTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.FALSE}. */
  token: TokenType.FALSE;
  /** Always `false`. */
  value: false;
}
/** A {@link ParsedTokenInfo} for a `null` token. */
export interface ParsedNullTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.NULL}. */
  token: TokenType.NULL;
  /** Always `null`. */
  value: null;
}
/** A {@link ParsedTokenInfo} for a string token. */
export interface ParsedStringTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.STRING}. */
  token: TokenType.STRING;
  /** The string, with all its escape sequences already resolved. */
  value: string;
}
/** A {@link ParsedTokenInfo} for a number token. */
export interface ParsedNumberTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.NUMBER}. */
  token: TokenType.NUMBER;
  /** The number, as parsed by the tokenizer's `parseNumber` method. */
  value: number;
}
/** A {@link ParsedTokenInfo} for a separator between two JSON documents. */
export interface ParsedSeparatorTokenInfo extends ParsedTokenInfo {
  /** Always {@linkcode TokenType.SEPARATOR}. */
  token: TokenType.SEPARATOR;
  /** The configured separator. */
  value: string;
}

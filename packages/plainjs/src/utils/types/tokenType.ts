/**
 * The JSON token types emitted by the tokenizer.
 *
 * @module
 */

/** The type of a JSON token, as reported by the tokenizer's `onToken` callback. */
enum TokenType {
  /** `{` */
  LEFT_BRACE,
  /** `}` */
  RIGHT_BRACE,
  /** `[` */
  LEFT_BRACKET,
  /** `]` */
  RIGHT_BRACKET,
  /** `:` */
  COLON,
  /** `,` */
  COMMA,
  /** `true` */
  TRUE,
  /** `false` */
  FALSE,
  /** `null` */
  NULL,
  /** A string, with all its escape sequences already resolved. */
  STRING,
  /** A number, already parsed into a JavaScript number. */
  NUMBER,
  /** The configured separator between consecutive JSON documents. */
  SEPARATOR,
}

export default TokenType;

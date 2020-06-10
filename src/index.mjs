import { TokenType } from './utils/constants.mjs';
import { charset, escapedSequences } from './utils/utf-8.mjs';

import Tokenizer from './tokenizer';
import Parser from './parser.mjs';
import JsonParser from './jsonparse.js';

export const TokenType;
export const utf8 = { charset, escapedSequences };
export const Tokenizer;
export const Parser;
export const JsonParser;

module.exports = {
  TokenType,
  utf8,
  Tokenizer,
  Parser,
  JsonParser,
};

import type {
  JsonArray,
  JsonKey,
  JsonObject,
  JsonPrimitive,
  JsonStruct,
} from "./utils/types/jsonTypes.ts";
import type { ParsedElementInfo } from "./utils/types/parsedElementInfo.ts";
import type { ParsedTokenInfo } from "./utils/types/parsedTokenInfo.ts";
import {
  type StackElement,
  TokenParserMode,
} from "./utils/types/stackElement.ts";
import TokenType from "./utils/types/tokenType.ts";
import { charset } from "./utils/utf-8.ts";

// Parser States
const enum TokenParserState {
  VALUE,
  KEY,
  COLON,
  COMMA,
  ENDED,
  ERROR,
  SEPARATOR,
}

function TokenParserStateToString(state: TokenParserState): string {
  return ["VALUE", "KEY", "COLON", "COMMA", "ENDED", "ERROR", "SEPARATOR"][
    state
  ];
}

// Plain bracket assignment invokes the inherited `Object.prototype.__proto__`
// setter for that one key name, letting a "__proto__" key in the input alter
// obj's actual prototype instead of becoming a property of obj. Only that key
// needs the safe (but slower) Object.defineProperty path -- every other key,
// i.e. the overwhelming majority, keeps the fast, JIT-friendly assignment.
function setProperty(
  obj: JsonObject,
  key: string,
  value: JsonPrimitive | JsonStruct,
): void {
  if (key === "__proto__") {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return;
  }

  obj[key] = value;
}

export interface TokenParserOptions {
  paths?: string[];
  keepStack?: boolean;
  separator?: string;
  emitPartialValues?: boolean;
}

// Configured selectors are compiled into this trie, keyed by path segment, so
// matching a value is an O(depth) walk down the trie rather than a rescan of
// every selector (O(number of selectors)) on every value. "*" is stored as an
// ordinary key -- it's always the wildcard, since the selector syntax has no
// way to match a data key literally named "*". `terminal` ends a selector.
interface SelectorTrieNode {
  children: Map<string, SelectorTrieNode>;
  terminal: boolean;
}

const defaultOpts: TokenParserOptions = {
  paths: undefined,
  keepStack: true,
  separator: undefined,
  emitPartialValues: false,
};

export class TokenParserError extends Error {
  constructor(message: string) {
    super(message);
    // Typescript is broken. This is a workaround
    Object.setPrototypeOf(this, TokenParserError.prototype);
  }
}

export default class TokenParser {
  // Compiled selectors, or undefined to emit everything -- when no paths are
  // configured or any path is the match-everything selector (undefined / "$*").
  private readonly selectorTrie?: SelectorTrieNode;
  private readonly keepStack: boolean;
  private readonly separator?: string;
  private state: TokenParserState = TokenParserState.VALUE;
  private mode: TokenParserMode | undefined = undefined;
  private key: JsonKey = undefined;
  private value: JsonStruct | undefined = undefined;
  private stack: StackElement[] = [];
  // Tracked explicitly rather than inferred from `value` because keepStack:false
  // deletes emitted properties from `value`, so Object.keys(value).length can no
  // longer be trusted to tell an empty object from one whose members were purged.
  private memberCount = 0;

  constructor(opts?: TokenParserOptions) {
    opts = { ...defaultOpts, ...opts };

    if (opts.paths) {
      const root: SelectorTrieNode = { children: new Map(), terminal: false };
      // A match-everything selector makes the whole set match everything, which
      // we represent by leaving the trie undefined (as with no paths at all).
      let matchEverything = false;
      for (const path of opts.paths) {
        if (path === undefined || path === "$*") {
          matchEverything = true;
          continue;
        }

        if (!path.startsWith("$"))
          throw new TokenParserError(
            `Invalid selector "${path}". Should start with "$".`,
          );
        const segments = path.split(".").slice(1);
        if (segments.includes(""))
          throw new TokenParserError(
            `Invalid selector "${path}". ".." syntax not supported.`,
          );

        let node = root;
        for (const segment of segments) {
          let child = node.children.get(segment);
          if (!child) {
            child = { children: new Map(), terminal: false };
            node.children.set(segment, child);
          }
          node = child;
        }
        node.terminal = true;
      }
      if (!matchEverything) this.selectorTrie = root;
    }

    this.keepStack = opts.keepStack || false;
    this.separator = opts.separator;
    if (!opts.emitPartialValues) {
      this.emitPartial = () => {};
    }
  }

  private shouldEmit(): boolean {
    if (!this.selectorTrie) return true;
    return this.matchesSelector(this.selectorTrie, 0);
  }

  // Depth-first walk of the selector trie down the current value's key path:
  //   [stack[1].key, ..., stack[n-1].key, this.key]   (n = stack.length)
  // A value matches iff some branch reaches a terminal node at the exact depth.
  // Recursion (rather than an explicit frontier) keeps the common single-path
  // walk allocation-free and short-circuits on the first match, like the old
  // rescan did, while collapsing its O(number of selectors) cost to O(depth).
  private matchesSelector(node: SelectorTrieNode, level: number): boolean {
    const keyCount = this.stack.length;
    if (level === keyCount) return node.terminal;

    const key = level < keyCount - 1 ? this.stack[level + 1].key : this.key;

    // "*" matches any key; try it first since it needs no key lookup.
    const wildcard = node.children.get("*");
    if (wildcard && this.matchesSelector(wildcard, level + 1)) return true;

    // Then a literal match. Resolving the key to a string allocates for numeric
    // array indices, so skip it unless there's a literal child to match.
    const hasLiteralChild = node.children.size > (wildcard ? 1 : 0);
    if (hasLiteralChild) {
      const segment = key?.toString();
      if (segment !== undefined) {
        const child = node.children.get(segment);
        if (child && this.matchesSelector(child, level + 1)) return true;
      }
    }

    return false;
  }

  private push(): void {
    this.stack.push({
      key: this.key,
      value: this.value as JsonStruct,
      mode: this.mode,
      emit: this.shouldEmit(),
      memberCount: this.memberCount,
    });
  }

  private pop(): void {
    const value = this.value;

    // biome-ignore lint/suspicious/noImplicitAnyLet: assigned via the destructuring assignment below
    let emit;
    ({
      key: this.key,
      value: this.value,
      mode: this.mode,
      emit,
      memberCount: this.memberCount,
    } = this.stack.pop() as StackElement);

    this.state =
      this.mode !== undefined ? TokenParserState.COMMA : TokenParserState.VALUE;

    this.emit(value as JsonPrimitive | JsonStruct, emit);
  }

  private emit(value: JsonPrimitive | JsonStruct, emit: boolean): void {
    if (
      !this.keepStack &&
      this.value &&
      this.stack.every((item) => !item.emit)
    ) {
      if (Array.isArray(this.value)) {
        // Shrinking `.length` drops the slot, unlike `delete`, which only leaves a hole
        this.value.length -= 1;
      } else {
        delete (this.value as JsonStruct as any)[this.key as string | number];
      }
    }

    if (emit) {
      this.onValue({
        value: value,
        key: this.key,
        parent: this.value,
        stack: this.stack,
      });
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

  private emitPartial(value?: JsonPrimitive): void {
    if (!this.shouldEmit()) return;

    if (this.state === TokenParserState.KEY) {
      this.onValue({
        value: undefined,
        key: value as JsonKey,
        parent: this.value,
        stack: this.stack,
        partial: true,
      });
      return;
    }

    this.onValue({
      value: value,
      key: this.key,
      parent: this.value,
      stack: this.stack,
      partial: true,
    });
  }

  public get isEnded(): boolean {
    return this.state === TokenParserState.ENDED;
  }

  public write({
    token,
    value,
    partial,
  }: Omit<ParsedTokenInfo, "offset">): void {
    try {
      if (partial) {
        if (
          this.state !== TokenParserState.VALUE &&
          this.state !== TokenParserState.KEY
        ) {
          throw new TokenParserError(
            `Unexpected partial ${TokenType[token]} (${JSON.stringify(
              value,
            )}) in state ${TokenParserStateToString(this.state)}`,
          );
        }
        this.emitPartial(value);
        return;
      }

      if (this.state === TokenParserState.VALUE) {
        if (
          token === TokenType.STRING ||
          token === TokenType.NUMBER ||
          token === TokenType.TRUE ||
          token === TokenType.FALSE ||
          token === TokenType.NULL
        ) {
          if (this.mode === TokenParserMode.OBJECT) {
            setProperty(this.value as JsonObject, this.key as string, value);
            this.state = TokenParserState.COMMA;
            this.memberCount++;
          } else if (this.mode === TokenParserMode.ARRAY) {
            (this.value as JsonArray).push(value);
            this.state = TokenParserState.COMMA;
            this.memberCount++;
          }

          this.emit(value, this.shouldEmit());
          return;
        }

        if (token === TokenType.LEFT_BRACE) {
          this.memberCount++;
          this.push();
          if (this.mode === TokenParserMode.OBJECT) {
            const val = {};
            setProperty(this.value as JsonObject, this.key as string, val);
            this.value = val;
          } else if (this.mode === TokenParserMode.ARRAY) {
            const val = {};
            (this.value as JsonArray).push(val);
            this.value = val;
          } else {
            this.value = {};
          }
          this.mode = TokenParserMode.OBJECT;
          this.state = TokenParserState.KEY;
          this.key = undefined;
          this.memberCount = 0;
          this.emitPartial();
          return;
        }

        if (token === TokenType.LEFT_BRACKET) {
          this.memberCount++;
          this.push();
          if (this.mode === TokenParserMode.OBJECT) {
            const val: JsonArray = [];
            setProperty(this.value as JsonObject, this.key as string, val);
            this.value = val;
          } else if (this.mode === TokenParserMode.ARRAY) {
            const val: JsonArray = [];
            (this.value as JsonArray).push(val);
            this.value = val;
          } else {
            this.value = [];
          }
          this.mode = TokenParserMode.ARRAY;
          this.state = TokenParserState.VALUE;
          this.key = 0;
          this.memberCount = 0;
          this.emitPartial();
          return;
        }

        if (
          this.mode === TokenParserMode.ARRAY &&
          token === TokenType.RIGHT_BRACKET &&
          this.memberCount === 0
        ) {
          this.pop();
          return;
        }
      }

      if (this.state === TokenParserState.KEY) {
        if (token === TokenType.STRING) {
          this.key = value as string;
          this.state = TokenParserState.COLON;
          this.emitPartial();
          return;
        }

        if (token === TokenType.RIGHT_BRACE && this.memberCount === 0) {
          this.pop();
          return;
        }
      }

      if (this.state === TokenParserState.COLON) {
        if (token === TokenType.COLON) {
          this.state = TokenParserState.VALUE;
          return;
        }
      }

      if (this.state === TokenParserState.COMMA) {
        if (token === TokenType.COMMA) {
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
          (token === TokenType.RIGHT_BRACE &&
            this.mode === TokenParserMode.OBJECT) ||
          (token === TokenType.RIGHT_BRACKET &&
            this.mode === TokenParserMode.ARRAY)
        ) {
          this.pop();
          return;
        }
      }

      if (this.state === TokenParserState.SEPARATOR) {
        if (token === TokenType.SEPARATOR && value === this.separator) {
          this.state = TokenParserState.VALUE;
          return;
        }
      }

      // Edge case in which the separator is just whitespace and it's found in the middle of the JSON
      if (
        token === TokenType.SEPARATOR &&
        this.state !== TokenParserState.SEPARATOR &&
        Array.from(value as string)
          .map((n) => n.charCodeAt(0))
          .every(
            (n) =>
              n === charset.SPACE ||
              n === charset.NEWLINE ||
              n === charset.CARRIAGE_RETURN ||
              n === charset.TAB,
          )
      ) {
        // whitespace
        return;
      }

      throw new TokenParserError(
        `Unexpected ${TokenType[token]} (${JSON.stringify(
          value,
        )}) in state ${TokenParserStateToString(this.state)}`,
      );
    } catch (err: unknown) {
      this.error(err as Error);
    }
  }

  public error(err: Error): void {
    if (this.state !== TokenParserState.ENDED) {
      this.state = TokenParserState.ERROR;
    }

    this.onError(err);
  }

  public end(): void {
    if (
      (this.state !== TokenParserState.VALUE &&
        this.state !== TokenParserState.SEPARATOR) ||
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
      this.state = TokenParserState.ENDED;
      this.onEnd();
    }
  }

  // biome-ignore lint/correctness/noUnusedFunctionParameters: override point; the parameter is part of the public signature
  public onValue(parsedElementInfo: ParsedElementInfo): void {
    // Override me
    throw new TokenParserError(
      'Can\'t emit data before the "onValue" callback has been set up.',
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

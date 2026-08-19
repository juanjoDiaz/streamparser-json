/**
 * The shape of the token parser's stack, i.e. the chain of containers that a
 * parsed value is nested in.
 *
 * @module
 */

import type { JsonKey, JsonStruct } from "./jsonTypes.js";

/** Whether the container being parsed is a JSON object or a JSON array. */
export const enum TokenParserMode {
  /** The container is a JSON object, so its members are keyed by property name. */
  OBJECT,
  /** The container is a JSON array, so its members are keyed by index. */
  ARRAY,
}

/**
 * One of the containers that the value currently being parsed is nested in.
 *
 * The token parser keeps one of these per open container, from the top-level
 * value down to the immediate parent of the value being parsed, and passes them
 * to the `onValue` callback as its `stack`.
 */
export interface StackElement {
  /** The key under which this container was found in its own parent. */
  key: JsonKey;
  /** The container itself, as parsed so far. */
  value: JsonStruct;
  /** Whether this container is an object or an array. */
  mode?: TokenParserMode;
  /** Whether this container matches the configured `paths` and will thus be emitted. */
  emit: boolean;
  /** How many members of this container have been parsed so far. */
  memberCount: number;
}

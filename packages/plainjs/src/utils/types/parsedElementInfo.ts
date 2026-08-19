/**
 * The shape of the values emitted by the token parser.
 *
 * @module
 */

import type {
  JsonArray,
  JsonKey,
  JsonObject,
  JsonPrimitive,
  JsonStruct,
} from "./jsonTypes.js";
import type { StackElement } from "./stackElement.js";

/**
 * A parsed JSON value, along with where it was found in the JSON document.
 *
 * This is what the token parser passes to its `onValue` callback.
 */
export interface ParsedElementInfo {
  /** The parsed value. */
  value?: JsonPrimitive | JsonStruct;
  /**
   * The container that the value belongs to, or `undefined` if the value is
   * the top-level value of the JSON document.
   *
   * Unless the value was cloned (as the Node.js and WHATWG wrappers do), this
   * is a live reference to the parser's in-progress structure, so it keeps
   * growing as more siblings are parsed.
   */
  parent?: JsonStruct;
  /** The key or index under which the value was found in its parent. */
  key?: JsonKey;
  /** The chain of containers that the value is nested in, outermost first. */
  stack: StackElement[];
  /**
   * Whether the value is still being parsed and might grow, which only happens
   * when the `emitPartialValues` option is enabled.
   */
  partial?: boolean;
}

/** A {@link ParsedElementInfo} for a value that was found inside a JSON array. */
export interface ParsedArrayElement extends ParsedElementInfo {
  /** The parsed value. */
  value: JsonPrimitive | JsonStruct;
  /** The array that the value belongs to. */
  parent: JsonArray;
  /** The index at which the value was found in its parent array. */
  key: number;
  /** The chain of containers that the value is nested in, outermost first. */
  stack: StackElement[];
}

/** A {@link ParsedElementInfo} for a value that was found inside a JSON object. */
export interface ParsedObjectProperty extends ParsedElementInfo {
  /** The parsed value. */
  value: JsonPrimitive | JsonStruct;
  /** The object that the value belongs to. */
  parent: JsonObject;
  /** The name of the property under which the value was found in its parent object. */
  key: string;
  /** The chain of containers that the value is nested in, outermost first. */
  stack: StackElement[];
}

/** A {@link ParsedElementInfo} for the top-level value of a JSON document. */
export interface ParsedTopLevelElement extends ParsedElementInfo {
  /** The parsed value. */
  value: JsonPrimitive | JsonStruct;
  /** Always `undefined`: the top-level value has no parent. */
  parent: undefined;
  /** Always `undefined`: the top-level value has no key. */
  key: undefined;
  /** Always empty: the top-level value is not nested in any container. */
  stack: [];
}

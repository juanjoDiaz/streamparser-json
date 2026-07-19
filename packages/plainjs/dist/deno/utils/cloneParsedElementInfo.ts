import type { ParsedElementInfo } from "./types/parsedElementInfo.ts";
import type { JsonObject, JsonStruct } from "./types/jsonTypes.ts";

// Mirrors the __proto__ guard in tokenparser.ts's setProperty: plain bracket
// assignment (and this project's ES2015 build target, which downlevels
// object-spread/Object.assign to a [[Set]]-based copy) invokes the inherited
// Object.prototype.__proto__ setter for that one key, silently replacing the
// clone's actual prototype instead of copying "__proto__" as a plain data
// property. A "__proto__" key can appear here too since this clones
// already-parsed JSON objects.
function setProperty(obj: JsonObject, key: string, value: unknown): void {
  if (key === "__proto__") {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (obj as any)[key] = value;
}

// `parent` and each stack frame's `value` are live references into the
// parser's in-progress object graph. From here on, the *only* mutations that
// can still happen to them are at their own top level: more keys/elements
// being added to that same container, or (with keepStack:false) the just
// emitted key being deleted from it. Any nested value they already hold
// belongs to a sibling branch that has *fully finished* parsing -- the
// tokenizer only ever has one branch open at a time, so a value reachable
// from an already-closed sibling can never be mutated again. A shallow clone
// is therefore enough to snapshot the part that's still moving, and it
// avoids deep-cloning the whole accumulated result on every single emit
// (quadratic for e.g. a big top-level array with paths:["$.*"]).
//
// Copying values/references as-is (no serialization step) means -0/Infinity/
// NaN survive untouched, and `Array#slice()` preserves holes left by
// keepStack:false's `delete arr[i]` as holes rather than turning them into
// visible `null`s.
function shallowClone<T extends JsonStruct | undefined>(value: T): T {
  // The root sentinel stack frame (pushed before the top-level value
  // exists) has no value yet.
  if (value === undefined) return value;
  if (Array.isArray(value)) return value.slice() as T;

  const copy: JsonObject = {};
  for (const key of Object.keys(value)) {
    setProperty(copy, key, (value as JsonObject)[key]);
  }
  return copy as T;
}

export function cloneParsedElementInfo(
  parsedElementInfo: ParsedElementInfo,
): ParsedElementInfo {
  const { value, key, parent, stack, partial } = parsedElementInfo;
  return {
    value,
    key,
    parent: shallowClone(parent),
    stack: stack.map((stackElement) => ({
      ...stackElement,
      value: shallowClone(stackElement.value) as JsonStruct,
    })),
    partial,
  };
}

import type { JsonObject, JsonStruct } from "./types/jsonTypes.ts";
import type { ParsedElementInfo } from "./types/parsedElementInfo.ts";

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
  return snapshotPrefix(value, prefixLength(value)) as T;
}

// Number of entries currently in a container: element count for arrays (holes
// included, so lengths stay comparable), own-key count for objects.
function prefixLength(container: JsonStruct): number {
  return Array.isArray(container)
    ? container.length
    : Object.keys(container).length;
}

// An independent snapshot of a container's first `length` entries. For an
// array that's `slice(0, length)` (holes and -0/Infinity/NaN preserved); for
// an object it's the first `length` own keys in insertion order, copied with
// the __proto__ guard.
function snapshotPrefix(container: JsonStruct, length: number): JsonStruct {
  if (Array.isArray(container)) return container.slice(0, length);

  const copy: JsonObject = {};
  const keys = Object.keys(container);
  for (let i = 0; i < length; i++) {
    setProperty(copy, keys[i], (container as JsonObject)[keys[i]]);
  }
  return copy;
}

// A memoizing thunk that materializes `container`'s first
// `prefixLength(container)` entries only on first call.
//
// Only correct when `container` is append-only from here on -- i.e.
// keepStack:true, where the emit-time delete never runs, finished children are
// frozen, and the container only ever grows by having new siblings appended.
// Under that guarantee, recording the length now and slicing on first *access*
// still reproduces exactly the state at emit time, however much later the read
// happens.
function lazySnapshot(
  container: JsonStruct | undefined,
): () => JsonStruct | undefined {
  if (container === undefined) return () => undefined;

  const length = prefixLength(container);
  let snapshot: JsonStruct;
  let materialized = false;
  return () => {
    if (!materialized) {
      snapshot = snapshotPrefix(container, length);
      materialized = true;
    }
    return snapshot;
  };
}

export function cloneParsedElementInfo(
  parsedElementInfo: ParsedElementInfo,
  // When true (keepStack:true, where every container is append-only from here
  // on), snapshot `parent`/each stack frame's `value` lazily instead of eagerly
  // -- see lazySnapshot. The point is that a consumer which never touches these
  // fields (the common `paths:["$.*"]`-over-a-large-array case) pays nothing,
  // instead of an O(current length) copy on each of the N events -- which sums
  // to O(N^2) time and holds N separate growing snapshots live at once (O(N^2)
  // memory) while they sit in the stream's buffer. Left false by default so any
  // other caller keeps the straightforward eager clone, and so keepStack:false
  // (where containers are actively emptied, not append-only, but also already
  // tiny) stays exact.
  lazy = false,
): ParsedElementInfo {
  const { value, key, parent, stack, partial } = parsedElementInfo;

  if (!lazy) {
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

  // Object-literal getters (not Object.defineProperty) so every clone shares
  // one hidden class and stays fast to read and to JSON.stringify -- the
  // getters are still own, enumerable accessor properties. They close over a
  // per-event memoizing thunk.
  const parentThunk = lazySnapshot(parent);
  return {
    value,
    key,
    get parent() {
      return parentThunk();
    },
    stack: stack.map((stackElement) => {
      const valueThunk = lazySnapshot(stackElement.value);
      return {
        key: stackElement.key,
        get value() {
          return valueThunk() as JsonStruct;
        },
        mode: stackElement.mode,
        emit: stackElement.emit,
        memberCount: stackElement.memberCount,
      };
    }),
    partial,
  };
}

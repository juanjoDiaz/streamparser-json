import { cloneParsedElementInfo } from "../src/utils/cloneParsedElementInfo.js";
import type { ParsedElementInfo } from "../src/utils/types/parsedElementInfo.js";
import { TokenParserMode } from "../src/utils/types/stackElement.js";

function elementInfo(overrides: Partial<ParsedElementInfo>): ParsedElementInfo {
  return { value: undefined, key: undefined, stack: [], ...overrides };
}

describe("cloneParsedElementInfo", () => {
  test("shallow clones parent so adding/removing its own keys doesn't affect the original", () => {
    const parent: Record<string, unknown> = { a: 1 };
    const cloned = cloneParsedElementInfo(elementInfo({ parent }));

    (cloned.parent as Record<string, unknown>).b = 2;
    delete (cloned.parent as Record<string, unknown>).a;

    expect(parent).toEqual({ a: 1 });
  });

  test("shares already-closed nested values by reference (only the container's own keys are protected)", () => {
    // The tokenizer only ever has one branch open at a time, so a nested
    // value already sitting inside `parent` belongs to a sibling that has
    // fully finished parsing and will never be mutated by the parser again
    // -- only `parent`'s own key set can still change (see module comment).
    const nested = { b: 2 };
    const parent = { a: nested };
    const cloned = cloneParsedElementInfo(elementInfo({ parent }));

    expect(cloned.parent).not.toBe(parent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((cloned.parent as any).a).toBe(nested);
  });

  test("preserves -0, Infinity, -Infinity and NaN", () => {
    const cloned = cloneParsedElementInfo(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      elementInfo({ parent: [-0, Infinity, -Infinity, NaN] as any }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [negZero, inf, negInf, nan] = cloned.parent as any;
    expect(Object.is(negZero, -0)).toBe(true);
    expect(inf).toBe(Infinity);
    expect(negInf).toBe(-Infinity);
    expect(Number.isNaN(nan)).toBe(true);
  });

  test("preserves holes left by keepStack:false's delete instead of turning them into null", () => {
    const parent: number[] = [1, 2, 3];
    delete parent[1];
    const cloned = cloneParsedElementInfo(elementInfo({ parent }));

    expect(1 in (cloned.parent as number[])).toBe(false);
    expect(Object.keys(cloned.parent as object)).toEqual(["0", "2"]);
  });

  test("clones a __proto__ own key without polluting Object.prototype", () => {
    const parent = JSON.parse('{"__proto__":{"polluted":true},"z":9}');
    const cloned = cloneParsedElementInfo(elementInfo({ parent }));

    expect(
      Object.prototype.hasOwnProperty.call(cloned.parent, "__proto__"),
    ).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((cloned.parent as any).__proto__.polluted).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).polluted).toBeUndefined();
  });

  test("leaves value, key and partial untouched (only parent/stack are cloned)", () => {
    const value = { x: 1 };
    const cloned = cloneParsedElementInfo(
      elementInfo({ value, key: "x", partial: true }),
    );

    expect(cloned.value).toBe(value);
    expect(cloned.key).toBe("x");
    expect(cloned.partial).toBe(true);
  });

  test("shallow clones each stack frame's value independently", () => {
    const frameValue = { a: 1 };
    const cloned = cloneParsedElementInfo(
      elementInfo({
        stack: [
          {
            key: "a",
            value: frameValue,
            mode: TokenParserMode.OBJECT,
            emit: false,
            memberCount: 1,
          },
        ],
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cloned.stack[0].value as any).a = 999;
    expect(frameValue).toEqual({ a: 1 });
  });

  test("returns undefined parent as-is", () => {
    const cloned = cloneParsedElementInfo(elementInfo({ parent: undefined }));
    expect(cloned.parent).toBeUndefined();
  });

  // With keepStack:true the adapters snapshot lazily (cloneParsedElementInfo's
  // second argument): every container is append-only from that point on, so
  // recording the length now and slicing on first access still reproduces the
  // exact state at emit time -- but a consumer that never reads parent/stack
  // pays nothing instead of an O(n) copy per event.
  describe("lazy snapshots (keepStack:true)", () => {
    test("captures the array prefix at clone time even if the container grows afterwards", () => {
      const parent = [1, 2];
      const cloned = cloneParsedElementInfo(elementInfo({ parent }), true);

      // The parser keeps appending later siblings to the same array after the
      // event has fired; the snapshot must still be [1, 2].
      parent.push(3, 4);

      expect(cloned.parent).toEqual([1, 2]);
    });

    test("captures the object keys present at clone time even if more are added afterwards", () => {
      const parent: Record<string, unknown> = { a: 1, b: 2 };
      const cloned = cloneParsedElementInfo(elementInfo({ parent }), true);

      (parent as Record<string, unknown>).c = 3;

      expect(cloned.parent).toEqual({ a: 1, b: 2 });
    });

    test("snapshots each stack frame's value at clone time", () => {
      const frameValue: Record<string, unknown> = { a: 1 };
      const cloned = cloneParsedElementInfo(
        elementInfo({
          stack: [
            {
              key: "a",
              value: frameValue as never,
              mode: TokenParserMode.OBJECT,
              emit: false,
              memberCount: 1,
            },
          ],
        }),
        true,
      );

      frameValue.b = 2;

      expect(cloned.stack[0].value).toEqual({ a: 1 });
    });

    test("is memoized: reading parent twice yields the same array", () => {
      const cloned = cloneParsedElementInfo(
        elementInfo({ parent: [1, 2, 3] }),
        true,
      );
      expect(cloned.parent).toBe(cloned.parent);
    });

    test("mutating the snapshot doesn't affect the source container", () => {
      const parent = [1, 2, 3];
      const cloned = cloneParsedElementInfo(elementInfo({ parent }), true);

      (cloned.parent as number[]).push(999);

      expect(parent).toEqual([1, 2, 3]);
    });

    test("preserves -0, Infinity, -Infinity and NaN", () => {
      const cloned = cloneParsedElementInfo(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elementInfo({ parent: [-0, Infinity, -Infinity, NaN] as any }),
        true,
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [negZero, inf, negInf, nan] = cloned.parent as any;
      expect(Object.is(negZero, -0)).toBe(true);
      expect(inf).toBe(Infinity);
      expect(negInf).toBe(-Infinity);
      expect(Number.isNaN(nan)).toBe(true);
    });

    test("clones a __proto__ own key without polluting Object.prototype", () => {
      const parent = JSON.parse('{"__proto__":{"polluted":true},"z":9}');
      const cloned = cloneParsedElementInfo(elementInfo({ parent }), true);

      expect(
        Object.prototype.hasOwnProperty.call(cloned.parent, "__proto__"),
      ).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((cloned.parent as any).__proto__.polluted).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(({} as any).polluted).toBeUndefined();
    });

    test("returns undefined parent as-is", () => {
      const cloned = cloneParsedElementInfo(
        elementInfo({ parent: undefined }),
        true,
      );
      expect(cloned.parent).toBeUndefined();
    });

    test("leaves value, key and partial untouched", () => {
      const value = { x: 1 };
      const cloned = cloneParsedElementInfo(
        elementInfo({ value, key: "x", partial: true }),
        true,
      );

      expect(cloned.value).toBe(value);
      expect(cloned.key).toBe("x");
      expect(cloned.partial).toBe(true);
    });

    test("is JSON.stringify-able (getters are own enumerable properties)", () => {
      const cloned = cloneParsedElementInfo(
        elementInfo({ value: 3, key: 0, parent: [3] }),
        true,
      );
      expect(JSON.parse(JSON.stringify(cloned))).toEqual({
        value: 3,
        key: 0,
        parent: [3],
        stack: [],
      });
    });
  });
});

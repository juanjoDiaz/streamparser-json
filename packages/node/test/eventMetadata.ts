import JSONParser from "../src/jsonparser.js";
import { runJSONParserTest } from "./utils/testRunner.js";

// `parent`/`stack` in each onValue event used to be live references into the
// parser's in-progress object graph. Since Transform streams buffer emitted
// values for the consumer to read later, those fields kept changing (or,
// with keepStack:false, had properties deleted from them) after the event
// had already fired. Each assertion here only reads its collected `parent`
// references *after* the whole parse has finished (not inside the onValue
// callback, which -- because Node synchronously flushes 'data' on push when
// there's no backpressure -- would happen to look correct by accident even
// without a fix) so a stale/live reference is actually caught.
describe("event metadata", () => {
  test("parent is a stable per-event snapshot of an array as it grows", async () => {
    const parents: unknown[] = [];
    await runJSONParserTest(
      new JSONParser({ paths: ["$.*"] }),
      ["[1,2,3]"],
      ({ parent }) => parents.push(parent),
    );
    expect(parents.map((p) => JSON.parse(JSON.stringify(p)))).toEqual([
      [1],
      [1, 2],
      [1, 2, 3],
    ]);
  });

  test("parent is a stable per-event snapshot even when every element is falsy", async () => {
    const parents: unknown[] = [];
    await runJSONParserTest(
      new JSONParser({ paths: ["$.*"] }),
      ["[0,false,null,0]"],
      ({ parent }) => parents.push(parent),
    );
    expect(parents.map((p) => JSON.parse(JSON.stringify(p)))).toEqual([
      [0],
      [0, false],
      [0, false, null],
      [0, false, null, 0],
    ]);
  });

  test("parent preserves -0 and Infinity, unlike a JSON round-trip clone", async () => {
    const parents: number[][] = [];
    await runJSONParserTest(
      new JSONParser({ paths: ["$.a.*"] }),
      ['{"a":[-0,1e400,-1e400,2]}'],
      ({ parent }) => parents.push(parent as number[]),
    );
    const last = parents[parents.length - 1];
    expect(Object.is(last[0], -0)).toBe(true);
    expect(last[1]).toBe(Infinity);
    expect(last[2]).toBe(-Infinity);
  });

  test("mutating one event's parent snapshot does not affect another's", async () => {
    const parents: number[][] = [];
    await runJSONParserTest(
      new JSONParser({ paths: ["$.*"] }),
      ["[1,2,3]"],
      ({ parent }) => parents.push(parent as number[]),
    );

    parents[0].push(999);

    expect(parents[2]).toEqual([1, 2, 3]);
  });

  test("parent stays a correct per-event snapshot even when read only after the parse ends", async () => {
    // The whole event object is collected without touching `parent` during
    // the callback; `parent` is read only after the stream has fully ended.
    // With keepStack:true the adapter snapshots lazily, so this exercises the
    // deferred path -- the snapshot must still reflect the array as it was at
    // each event, not the final mutated array.
    const events: { parent?: unknown }[] = [];
    await runJSONParserTest(
      new JSONParser({ paths: ["$.*"] }),
      ["[1,2,3]"],
      (event) => events.push(event),
    );
    expect(events.map((e) => e.parent)).toEqual([[1], [1, 2], [1, 2, 3]]);
  });
});

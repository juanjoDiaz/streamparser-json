import JSONParser from "../src/jsonparser.js";

// A slow (or absent) reader must not cause the whole document to be buffered:
// when data arrives in chunks, the adapter has to participate in the WHATWG
// stream backpressure so the writer is throttled once the readable side fills.
// Deterministic (no timers on the assertion path): we write chunks, yield so
// the transform can run, and check the writer's desiredSize -- a working
// pipeline drives it non-positive after only a few chunks.
describe("backpressure", () => {
  function bigArrayChunks(elementCount: number, chunkSize: number): string[] {
    const items: string[] = [];
    for (let i = 0; i < elementCount; i++) items.push(`{"id":${i}}`);
    const json = `[${items.join(",")}]`;
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += chunkSize) {
      chunks.push(json.slice(i, i + chunkSize));
    }
    return chunks;
  }

  test("applies backpressure to the writer when the readable side is not read", async () => {
    const chunks = bigArrayChunks(20_000, 256);

    const parser = new JSONParser(
      { paths: ["$.*"] },
      undefined,
      new CountQueuingStrategy({ highWaterMark: 16 }),
    );
    const writer = parser.writable.getWriter();

    let issued = 0;
    let backpressured = false;
    // Cap the loop so a regression (no backpressure) still terminates quickly
    // and fails the assertion, instead of writing every chunk.
    const cap = Math.min(chunks.length, 200);
    for (let i = 0; i < cap; i++) {
      // Fire-and-forget: awaiting writer.write() (or writer.ready) would
      // deadlock once backpressured, since nothing reads the readable side.
      // The catch swallows the rejection these get when the stream is dropped.
      writer.write(chunks[i]).catch(() => {
        /* never drained */
      });
      issued++;
      // Let the transform run and enqueue into the readable side.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (writer.desiredSize !== null && writer.desiredSize <= 0) {
        backpressured = true;
        break;
      }
    }

    expect(backpressured).toBe(true);
    expect(issued).toBeLessThan(chunks.length);

    // No explicit teardown: the readable side is never read and the document is
    // incomplete, so aborting/closing would hang or throw. The stream is dropped
    // and garbage-collected; pending writes are already .catch()-guarded above.
  });
});

import JSONParser from "../src/jsonparser.js";

// A slow (or absent) consumer must not cause the whole document to be buffered:
// when data arrives in chunks, the adapter has to participate in Node's stream
// backpressure so only a bounded number of parsed values sit in the readable
// buffer at once. This is deterministic (no timers): we feed chunks and never
// read, so a working pipeline stops producing once the readable buffer is full.
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

  test("does not buffer the whole document in the readable side when it is not read", () => {
    const elementCount = 20_000;
    const chunks = bigArrayChunks(elementCount, 256);

    const parser = new JSONParser(
      { paths: ["$.*"] },
      { readableHighWaterMark: 16 },
    );

    let writeReturnedFalse = false;
    // Never read the readable side.
    for (const chunk of chunks) {
      if (!parser.write(chunk)) writeReturnedFalse = true;
    }

    // With backpressure the transform stops emitting once the readable buffer
    // fills, so only ~highWaterMark values are queued -- not all 20k. Without
    // it, readableLength would be ~elementCount.
    expect(parser.readableLength).toBeLessThan(1000);
    // Backpressure also propagates back to the writable side.
    expect(writeReturnedFalse).toBe(true);

    parser.destroy();
  });
});

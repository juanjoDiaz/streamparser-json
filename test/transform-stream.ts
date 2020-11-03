import JSONparseStream from "../dist/deno/transform-stream.ts";

async function test() {
  const input = new TransformStream();
  const parser = new JSONparseStream();
  const resultStream = input.readable.pipeThrough(parser);

  const inputWriter = input.writable.getWriter();
  await inputWriter.write(`{ "a": 1,  "b": { "c": 2 } }`);
  await inputWriter.close();

  const resultReader = resultStream.getReader();
  while (true) {
    const result = await resultReader.read();
    console.log(result);
    if (result.done) break;
  }
}

test();
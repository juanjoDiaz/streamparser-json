import { createReadStream, readFileSync } from "fs";
import { Writable, pipeline } from 'stream';
import { promisify } from 'util';
import tap from "tap";
import { TokenizerStream, ParserStream, JSONparseStream } from "../src/node-stream-transform";

const pipelineAsync = promisify(pipeline);

const { test } = tap;

// TODO fix CWD
const stringifiedJson = readFileSync(`${process.cwd()}/samplejson/basic.json`)
  .toString();

const streamJson = createReadStream(`${process.cwd()}/samplejson/basic.json`);

test("complex objects using node-streams", {}, async (t) => {
  const output = new Writable({
    objectMode: true,
    write({ value, key, parent, stack }, encoding, callback) {
      if (stack.length === 0) {
        t.deepEqual(JSON.parse(stringifiedJson), value);
      }
      callback();
    },
  });

  await pipelineAsync(streamJson, new JSONparseStream(), output);
});

test("complex objects using node-streams piping tokenizer and parser", {}, async (t) => {
  const output = new Writable({
    objectMode: true,
    write({ value, key, parent, stack }, encoding, callback) {
      if (stack.length === 0) {
        t.deepEqual(JSON.parse(stringifiedJson), value);
      }
      callback();
    },
  });

  await pipelineAsync(streamJson, new TokenizerStream(), new ParserStream(), output);
});
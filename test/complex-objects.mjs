import { readFileSync } from 'fs';
import tap from 'tap';
import JsonParser from '../src/jsonparse';

const { test } = tap;

// TODO fix CWD
const stringifiedJson = readFileSync(`${process.cwd()}/samplejson/basic.json`);

test('complex objects', (t) => {
  t.plan(1);

  const p = new JsonParser();
  p.onValue = (value, key, parent, stack) => {
    if (stack.length === 0) {
      t.deepEqual(JSON.parse(stringifiedJson), value);
    }
  };

  p.write(stringifiedJson);
});
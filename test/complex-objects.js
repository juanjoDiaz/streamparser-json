const { readFileSync } = require('fs');
const { test } = require('tap');
const JsonParser = require('../src/jsonparse');
const stringifiedJson = readFileSync(`${__dirname}/../samplejson/basic.json`);

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
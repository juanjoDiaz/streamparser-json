const { test } = require('tap');
const JsonParser = require('../src/jsonparse');

const values = [
  'true',
  'false',
];
const expected = values.map(str => JSON.parse(str));

test('boolean', (t) => {
  t.plan(expected.length);
  let i = 0;

  const p = new JsonParser();
  p.onValue = (value) => {
    t.equal(value, expected[i], `Error on expectation ${i} (${value} !== ${expected[i]})`);
    i += 1;
  };

  values.forEach(str => p.write(str));
});

test('boolean chuncked', (t) => {
  t.plan(expected.length);
  let i = 0;

  const p = new JsonParser();
  p.onValue = (value) => {
    t.equal(value, expected[i], `Error on expectation ${i} (${value} !== ${expected[i]})`);
    i += 1;
  };

  values.forEach(str => str.split('').forEach(c => p.write(c)));
});

test('fail on invalid values', (t) => {
  const values = [
    'tRue',
    'trUe',
    'truE',
    'fAlse',
    'faLse',
    'falSe',
    'falsE',
  ];
  t.plan(values.length);

  values.forEach(str => {
    const p = new JsonParser();
    try {
      p.write(str);
      t.fail(`Expected to fail on value "${str}"`);
    } catch(e) {
      t.pass();
    }
  })
});


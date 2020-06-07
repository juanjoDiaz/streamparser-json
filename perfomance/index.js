const fs = require('fs');
const Benchmark = require('benchmark');
const JSONParse = require('jsonparse');
const JSONParse2 = require('../src/jsonparse');

console.log('==============');
console.log('Complex object');
console.log('==============');
benchmark(fs.readFileSync('../samplejson/basic.json'));

console.log('==============================');
console.log('Complex object with no numbers');
console.log('==============================');
benchmark(fs.readFileSync('../samplejson/basic-no-numbers.json'));

console.log('=======================');
console.log('Object with many spaces');
console.log('=======================');
const spaces = Array(1000).fill(' ').join('');
benchmark(`${spaces}{${spaces}"test"${spaces}:${spaces}"asdfasdf"${spaces}}`);
 
console.log('===========');
console.log('Long string');
console.log('===========');
benchmark(`"${Array(1000).fill('a').join('')}"`);


console.log('===========');
console.log('Long number');
console.log('===========');
benchmark(`${Array(1000).fill('9').join('')}`);

function benchmark(jsonStr) {
  const jsonparse = new JSONParse();
  const jsonparse2 = new JSONParse2();
  const jsonparse2WithSmallBuffer = new JSONParse2({ stringBufferSize: 1024, numberBufferSize: 1024 });
  const jsonparse2WithBuffer = new JSONParse2({ stringBufferSize: 64 * 1024, numberBufferSize: 64 * 1024 });
  const jsonparse2WithBigBuffer = new JSONParse2({ stringBufferSize: 64 * 1024 * 1024, numberBufferSize: 64 * 1024 * 1024 });

  new Benchmark.Suite()
    .add('JSON.parse', () => JSON.parse(jsonStr))
    .add('JSONparse', () => jsonparse.write(jsonStr))
    .add('JSONparse2', () => jsonparse2.write(jsonStr))
    .add('JSONparse2 With Smallbuffer', () => jsonparse2WithSmallBuffer.write(jsonStr))
    .add('JSONparse2 With buffer', () => jsonparse2WithBuffer.write(jsonStr))
    .add('JSONparse2 With Bigbuffer', () => jsonparse2WithBigBuffer.write(jsonStr))
    // add listeners
    .on('cycle', (event) => console.log(String(event.target)))
    // .on('complete', ()  => console.log('Fastest is ' + this.filter('fastest').map('name')))
    // run
    .run();
}
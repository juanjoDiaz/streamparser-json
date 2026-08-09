# @streamparser/json-node

[![npm version][npm-version-badge]][npm-badge-url]
[![npm monthly downloads][npm-downloads-badge]][npm-badge-url]
[![Build Status][build-status-badge]][build-status-url]
[![Coverage Status][coverage-status-badge]][coverage-status-url]

Fast dependency-free library to parse a JSON stream using utf-8 encoding in Node.js, Deno or any modern browser. Fully compliant with the JSON spec and `JSON.parse(...)`.

*tldr;*

```javascript
import { JSONParser } from '@streamparser/json-node';

const parser = new JSONParser();

inputStream.pipe(parser).pipe(destinationStream);

// Or using events to get the values

parser.on("data", (value) => { /* ... */ });
parser.on("error", err => { /* ... */ });
parser.on("end", () => { /* ... */ });
```

## @streamparser/json ecosystem

There are multiple flavours of @streamparser:

* The **[@streamparser/json](https://www.npmjs.com/package/@streamparser/json)** package allows to parse any JSON string or stream using pure JavaScript.
* The **[@streamparser/json-whatwg](https://www.npmjs.com/package/@streamparser/json-whatwg)** wraps `@streamparser/json` into a WHATWG TransformStream.
* The **[@streamparser/json-node](https://www.npmjs.com/package/@streamparser/json-node)** wraps `@streamparser/json` into a node Transform stream.

## Components

### Tokenizer

A JSON compliant tokenizer that parses a utf-8 stream into JSON tokens that are emitted as objects.

```javascript
import { Tokenizer } from '@streamparser/json-node';

const tokenizer = new Tokenizer(opts, transformOpts);
```

Transform options take the standard node Transform stream settings (see [Node docs](https://nodejs.org/api/stream.html#class-streamtransform)).

The available options are:

```javascript
{
  stringBufferSize: <number>, // set to 0 to don't buffer. Min valid value is 4.
  numberBufferSize: <number>, // set to 0 to don't buffer.
  separator: <string>, // separator between object. For example `\n` for nd-js.
  emitPartialTokens: <boolean> // whether to emit tokens mid-parsing.
}
```

If buffer sizes are set to anything else than zero, instead of using a string to append the data as it comes in, the data is buffered using a TypedArray. A reasonable size could be `64 * 1024` (64 KB).

#### Buffering

When parsing strings or numbers, the parser needs to gather the data in-memory until the whole value is ready.

Strings are immutable in JavaScript so every string operation creates a new string. The V8 engine, behind Node, Deno and most modern browsers, performs many different types of optimization. One of these optimizations is to over-allocate memory when it detects many string concatenations. This increases significantly the memory consumption and can easily exhaust your memory when parsing JSON containing very large strings or numbers. For those cases, the parser can buffer the characters using a TypedArray. This requires encoding/decoding from/to the buffer into an actual string once the value is ready. This is done using the `TextEncoder` and `TextDecoder` APIs. Unfortunately, these APIs create a significant overhead when the strings are small so should be used only when strictly necessary.

### TokenParser

A token parser that processes JSON tokens as emitted by the `Tokenizer` and emits JSON values/objects.

```javascript
import { TokenParser} from '@streamparser/json-node';

const tokenParser = new TokenParser(opts, writableStrategy, readableStrategy);
```

Transform options take the standard node Transform stream settings (see [Node docs](https://nodejs.org/api/stream.html#class-streamtransform)).

The available options are:

```javascript
{
  paths: <string[]>,
  keepStack: <boolean>, // whether to keep all the properties in the stack
  separator: <string>, // separator between object. For example `\n` for nd-js. If undefined, the token parser will end after parsing the first object. Whitespace between objects is always ignored. To parse multiple object without any delimiter just set it to the empty string `''`.
  emitPartialValues: <boolean>, // whether to emit values mid-parsing.
}
```

* paths: Array of paths to emit. Defaults to `undefined` which emits everything. The paths are intended to support jsonpath although at the time being it only supports the root object selector (`$`) and subproperties selectors including wildcards (`$.a`, `$.*`, `$.a.b`, , `$.*.b`, etc). 
* keepStack: Whether to keep full objects on the stack even if they won't be emitted. Defaults to `true`. When set to `false` the it does preserve properties in the parent object some ancestor will be emitted. This means that the parent object passed to the `onValue` function will be empty, which doesn't reflect the truth, but it's more memory-efficient.
  * When streaming elements out of a large top-level array or object with `paths` (e.g. `paths: ['$.*']`), each event's `parent`/`stack` are snapshotted lazily, so a consumer that only reads `value` (the common case) stays linear regardless of size. Reading `parent`/`stack` on *every* one of many events is different: each read materializes a snapshot of everything parsed so far, which is quadratic overall -- set `keepStack: false` for that case, so already-emitted siblings are dropped instead of accumulating.

### JSONParser

The full blown JSON parser. It basically chains a `Tokenizer` and a `TokenParser`.

```javascript
import { JSONParser } from '@streamparser/json-node';

const parser = new JSONParser();
```

## Usage

You can use both components independently as

```javascript
const tokenizer = new Tokenizer(opts);
const tokenParser = new TokenParser(opts);
const jsonParser = tokenizer.pipe(tokenParser);
```

You can subscribe to the resulting data using the 

```javascript
import { JSONParser } from '@streamparser/json-node';

const parser = new JSONParser({ stringBufferSize: undefined, paths: ['$'] });

inputStream.pipe(parser).pipe(destinationStream);

// Or using events to get the values

parser.on("data", (value) => { /* ... */ });
parser.on("error", err => { /* ... */ });
parser.on("end", () => { /* ... */ });
```

## Examples

### Parsing a JSON array from a file

Imagine a large file containing a JSON array of objects (`[{"id":1},{"id":2},{"id":3},...]`) that you want to process one element at a time without loading the whole file into memory.

```js
  import { createReadStream } from 'node:fs';
  import { JSONParser } from '@streamparser/json-node';

  const parser = new JSONParser({ paths: ['$.*'], keepStack: false });
  parser.on('data', ({ value }) => { /* process element */ });

  createReadStream('arrayOfObjects.json').pipe(parser);
```

### Stream-parsing a fetch request returning a JSONstream

Imagine an endpoint that send a large amount of JSON objects one after the other (`{"id":1}{"id":2}{"id":3}...`).

```js
  import { Readable } from 'node:stream';
  import { JSONParser } from '@streamparser/json-node';

  const parser = new JSONParser();

  const response = await fetch('http://example.com/');
  const reader = Readable.fromWeb(response.body).pipe(parser);
  reader.on('data', (value) => { /* process element */ });
```

### Stream-parsing a fetch request returning a JSON array

Imagine an endpoint that send a large amount of JSON objects one after the other (`[{"id":1},{"id":2},{"id":3},...]`).

```js
  import { Readable } from 'node:stream';
  import { JSONParser } from '@streamparser/json-node';

  const parser = new JSONParser({ stringBufferSize: undefined, paths: ['$.*'], keepStack: false });

  const response = await fetch('http://example.com/');

  const reader = Readable.fromWeb(response.body).pipe(parser);

  reader.on('data', ({ value, key, parent, stack }) => { /* process element */ });
```

### Stream-parsing a fetch request returning a very long string getting previews of the string

Imagine an endpoint that send a large amount of JSON objects one after the other (`"Once upon a midnight <...>"`).

```js
  import { Readable } from 'node:stream';
  import { JSONParser } from '@streamparser/json-node';

  const parser = new JSONParser({ emitPartialTokens: true, emitPartialValues: true });

  const response = await fetch('http://example.com/');

  const reader = Readable.fromWeb(response.body).pipe(parser);

  reader.on('data', ({ value, key, parent, stack, partial }) => {
    if (partial) {
      console.log(`Parsing value: ${value}... (still parsing)`);
    } else {
      console.log(`Value parsed: ${value}`);
    }
  });
```

## Backpressure

When the input arrives in chunks (the normal case for a stream), the parser
takes part in Node's standard stream backpressure: if a downstream consumer is
slow, the source is throttled and only a bounded number of parsed values are
held in the readable buffer at a time. Just pipe as usual and it works.

One caveat: a single `write()` is processed in one synchronous pass, so **all
the values contained in that one chunk are emitted (and buffered, if unread) at
once** — backpressure applies *between* chunks, not *within* one. In practice
this only matters if you hand the parser an entire large document as a single
`write()`/`end()` call; if you already have the whole document in memory as one
string that's usually fine, but to get backpressure over a large input, feed it
in chunks (which is what piping from a file/socket does automatically).

## License

See [LICENSE.md](../../LICENSE).

[npm-version-badge]: https://badge.fury.io/js/@streamparser%2Fjson-node.svg
[npm-badge-url]: https://www.npmjs.com/package/@streamparser/json-node
[npm-downloads-badge]: https://img.shields.io/npm/dm/@streamparser%2Fjson-node.svg
[build-status-badge]: https://github.com/juanjoDiaz/streamparser-json/actions/workflows/on-push.yaml/badge.svg
[build-status-url]: https://github.com/juanjoDiaz/streamparser-json/actions/workflows/on-push.yaml
[coverage-status-badge]: https://coveralls.io/repos/github/juanjoDiaz/streamparser-json/badge.svg?branch=main
[coverage-status-url]: https://coveralls.io/github/juanjoDiaz/streamparser-json?branch=main

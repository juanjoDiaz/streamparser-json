# JSONparse2

Fast library to parse a JSON stream using utf-8 encoding from the server or the browser. Fully compliant with the JSON spec and `JSON.parse(...)`.

*tldr;*

```javascript
const { JSONparser } = require('jsonparse2');

const parser = new JSONparser();
parser.onValue = (value) => { /* process data */}

// Or passing the stream in several chunks 
try {
  p.write('{ "test": ["a"] }');
  // onValue will be called 3 times:
  // "a"
  // ["a"]
  // { test: ["a"] }
} catch (err) {
  console.log(err); // handler errors 
}
```

## Dependencies / Polyfilling

JSONparse2 requires a few ES6 classes:

* [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)
* [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder)
* [TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder)

If you are targeting browsers or system in which these might be missing, you need to polyfil them.

## Components

### Tokenizer

A JSON compliant tokenizer that parses a utf-8 stream into JSON tokens

```javascript
const { Tokenizer } =  require('JSONparse2');

const tokenizer = new Tokenizer(opts);
```

The available options are:

```javascript
{
  stringBufferSize: <bufferSize>, // set to 0 to don't buffer. Min valid value is 4.
  numberBufferSize: <bufferSize>, // set to 0 to don't buffer
}
```

If set to anything else than zero, instead of apppending the data as a string as it comes it,  the data is buffered using a TypedArray. Buffering is slower than appending strings in modern javascript engines. However, because of the way that V8 optimizes string concatenation parsing JSON objects containing very large strings or numbers might lead to memory exhaustion. For those cases, it's recomended to use a buffer. A reasonable size could be `64 * 1024` (64 KB).

#### Methods

* **write(data: string|typedArray|buffer)** push data into the tokenizer
* **onToken(token: TokenType, value: any, offset: number)** no-op method that the user should override to follow the tokenization process.
* **parseNumber(numberStr)** method used internally to parse numbers. By default, it is equivalent to `Number(numberStr)` but the user can override it if he wants some other behaviour.
 
```javascript
// You can override "parseNumber" and "onToken" by creating your own class extending Tokenizer
class MyTokenizer extends Tokenizer {
  parseNumber(numberStr) {
    const number = super.parseNumber(numberStr);
    // if number is too large. Just keep the string.
    return Number.isFinite(numberStr)) ? number : numberStr;
  }
  onToken(token: TokenType, value: any) {
    if (token = TokenTypes.NUMBER && typeof value === 'string') {
      super(TokenTypes.STRING, value);
    } else {
      super(token, value);
    }
  }
}

const myTokenizer = new MyTokenizer();

// or just overriding it
const tokenizer = new Tokenizer();
tokenizer.parseNumber = (numberStr) => { ... };
tokenizer.onToken = (token, value, offset) => { ... };
```

### Parser

A parser that processes JSON tokens as emitted by the `Tokenizer` and emits JSON values/objects.

```javascript
const { Parser } =  require('JSONparse2');

const parser = new Parser();
```

It takes no options.

#### Methods

* **write(token: TokenType, value: any)** push data into the tokenizer
* **onValue(value: any)** no-op method that the user should override to get the parsed value.
 
```javascript
// You can override "onToken" by creating your own class extending Tokenizer
class MyParser extends Parser {
  onValue(value: any) {
    // ...
  }
}

const myParser = new MyParser();

// or just overriding it
const parser = new Parser();
parser.onValue = (value) => { ... };
```

### JSONparse

A drop-in replacement of `JSONparse` (with few ~~breaking changes~~ improvements. See below.).


```javascript
const { JsonParser } = require('JSONparse2');

const parser = new JsonParser();
```

It takes the same options as the tokenizer.

This class is just for convenience. In reality, it simply connects the tokenizer and the parser:

```javascript
const tokenizer = new Tokenizer(opts);
const parser = new Parser();
tokenizer.onToken = this.parser.write.bind(this.parser);
parser.onValue = (value) => { /* Process values */ }
```

#### Methods

* *write(token: TokenType, value: any)* alias to the Tokenizer write method
* *onToken(token: TokenType, value: any, offset: number)* alias to the Tokenizer onToken method (write only)
* *onValue(value: any)* alias to the Parser onValue method (write only)
 
```javascript
// You can override "onToken" by creating your own class extending Tokenizer
class MyJsonParser extends JsonParser {
  onToken(value: any) {
    // ...
  }
  onValue(value: any) {
    // ...
  }
}

const myJsonParser = new MyJsonParser();

// or just overriding it
const jsonParser = new JsonParser();
jsonParser.onToken = (token, value, offset) => { ... };
jsonParser.onValue = (value) => { ... };
```

## Using JSONparse2

You can use both components independently as

```javascript
const tokenizer = new Tokenizer(opts);
const parser = new Parser();
this.tokenizer.onToken = this.parser.write.bind(this.parser);
```

You push data using the `write` method which takes a string or an array-like object.

You can subscribe to the resulting data using the 

```javascript
const { JsonParser } = require('jsonparse2');

const parser = new JsonParser({ stringBufferSize: undefined });
parser.onValue = console.log;

parser.write('"Hello world!"'); // logs "Hello world!"

// Or passing the stream in several chunks 
parser.write('"');
parser.write('Hello');
parser.write(' ');
parser.write('world!');
parser.write('"');// logs "Hello world!"
```

Write is always a synchronous operation so any error during the parsing of the stream will be thrown during the write operation. After an error, the parser can't continue parsing.

```javascript
const { JsonParser } = require('jsonparse2');

const parser = new JsonParser({ stringBufferSize: undefined });
parser.onValue = console.log;

// Or passing the stream in several chunks 
try {
  parser.write('"""');
} catch (err) {
  console.log(err); // logs 
}
```

## Examples

### Stream-parsing a fetch request returning a JSONstream

Imagine an endpoint that send a large amount of JSON objects one after the other (`{"id":1}{"id":2}{"id":3}...`).

```js
  const { JSONparser } = require('jsonparse2');

  const jsonparser = new JsonParser({ stringBufferSize: undefined });
  parser.onValue = (value, key, parent, stack) => {
	if (stack > 0) return; // ignore inner values
    // TODO process element
  }

  const response = await fetch('http://example.com/');
  const reader = response.body.getReader();
  while(true) {
    const { done, value } = await reader.read();
    if (done) break;
    jsonparse.write(value);
  }
```


### Stream-parsing a fetch request returning a JSON array

Imagine an endpoint that send a large amount of JSON objects one after the other (`[{"id":1},{"id":2},{"id":3},...]`).

```js
  const { JsonParser } = require('jsonparse2');

  const jsonparser = new JsonParser({ stringBufferSize: undefined });
  parser.onValue = (value, key, parent, stack) => {
    if (stack.length === 0) /* We are done. Exit. */; 
    if (stack > 1) return; // ignore inner values
    // By default, JSONparse2 keeps all the child elements in memory until the root parent is emitted.
    // Let's delete the objects after processing them in order to optimize memory.
    delete parent[key];
    // TODO process `value`
  }

  const response = await fetch('http://example.com/');
  const reader = response.body.getReader();
  while(true) {
    const { done, value } = await reader.read();
    if (done) break;
    jsonparse.write(value);
  }
```

## Why building this if we have JSONparse

JSONParser was awesome.... in 2011.

JSONparse2 is:

* **More than twice as fast.**
* **Works on the browser.**
* Well documented
* Better designed and more plugable/configurable by clearly separates the tokenizer and parser processes.
* Simpler and cleaner code. Uses ES6 and doesn't rely on deprecated Node.js method.
* 100% unit test coverage.
* Fully compliant with the JSON spec. You will always get the same result as using `JSON.parse()`.


### Breaking changes compared to JSONparse

* Big number are not kept as a string by default. you can achieve such behaviour by simply overriding the `parseNumber` method.
* Characters above 244 are correctly parsed instead of throwing an error.
* Trailing comas are not allowed in objects or arrays.
* JSONparse uses a string as internal buffer by default. This offers better performance but can lead to memory exhaustion if your JSON include very long strings (due to V8 optimizations). To get the exact same behaviour as in JSON parse you should set the `stringBufferSize` to `64 * 1024`.

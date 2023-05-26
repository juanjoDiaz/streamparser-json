# @streamparser/json

[![npm version][npm-version-badge]][npm-badge-url]
[![npm monthly downloads][npm-downloads-badge]][npm-badge-url]
[![Build Status][build-status-badge]][build-status-url]
[![Coverage Status][coverage-status-badge]][coverage-status-url]

Fast dependency-free library to parse a JSON stream using utf-8 encoding in Node.js, Deno or any modern browser. Fully compliant with the JSON spec and `JSON.parse(...)`.

## streamparser/json ecosystem

There are multiple flavours of @streamparser:

* The **[@streamparser/json](https://www.npmjs.com/package/@streamparser/json)** package allows to parse any JSON string or stream using pure Javascript.
* The **[@streamparser/json-whatwg](https://www.npmjs.com/package/@streamparser/json-whatwg)** wraps `@streamparser/json` into a WHATWG TransformStream.
* The **[@streamparser/json-node](https://www.npmjs.com/package/@streamparser/json-node)** wraps `@streamparser/json` into a node Transform stream.

## License

See [LICENSE.md].

[npm-version-badge]: https://badge.fury.io/js/@streamparser%2Fjson.svg
[npm-badge-url]: https://www.npmjs.com/package/@streamparser/json
[npm-downloads-badge]: https://img.shields.io/npm/dm/@streamparser%2Fjson.svg
[build-status-badge]: https://github.com/juanjoDiaz/streamparser-json/actions/workflows/on-push.yaml/badge.svg
[build-status-url]: https://github.com/juanjoDiaz/streamparser-json/actions/workflows/on-push.yaml
[coverage-status-badge]: https://coveralls.io/repos/github/juanjoDiaz/streamparser-json/badge.svg?branch=main
[coverage-status-url]: https://coveralls.io/github/juanjoDiaz/streamparser-json?branch=main


# Why building this if we have JSONparse

JSONParser was awesome.... in 2011.

@streamparser/json strengths include:

* As performant as JSONparse an even faster in some cases.
* Works on the browser.
* Allows selector of what to emit.
* Well documented.
* Better designed and more plugable/configurable by clearly separating the tokenizer and token parser processes.
* Simpler and cleaner code. Uses ES6 and doesn't rely on deprecated Node.js methods.
* 100% unit test coverage.
* Fully compliant with the JSON spec. You will always get the same result as using `JSON.parse()`.


## ~~Breaking changes~~ Improvements compared to JSONparse

* JSONparse errors keep big number as a string which is not compliant with the spec. With @streamparser/json you can achieve such behaviour by simply overriding the `parseNumber` method.
* JSONparse errors on characters above 244 which is not compliant with the spec. @streamparser/json parsed them correctly.
* JSONparse incorrectly allows trailing comas in objects or arrays which is not compliant with the spec. @streamparser/json do not.
* JSONparse's uses the `onError` callback to handle errors. Since the `write` method is synchronous, @streamparser/json defaults to throwing on error, so wrapping the write operation in a try-catch block captures all possible errors. If the `onError` callback is set, nothing is thrown.
* JSONparse uses buffers to parse strings to avoid memory exhaustion if your JSON include very long strings (due to V8 optimizations). This has a performance impact and it is not necessary for most use cases. @streamparser/json uses a string as internal buffer by default to improve performance and allows the user to get the exact same behaviour as in JSONparse by setting the `stringBufferSize` option to `64 * 1024`.
* JSONparse parses all valid JSON objects that come through the stream and doesn't support ending the processing. @streamparser/json ends the processing after a single object unless the user explicitly configure a `separator`. When using a separator, the user can end the processing by calling the `end` method which will end the processing and throw and error if the stream is in the middle of parsing something i.e. the JSON passed so far was incomplete/incorrect. Users can use the `onEnd` callback to act when the processing ends.
* JSONparse will fail to emit a number until is followed by a non-numeric character, i.e. it will not parse a single number which is valid JSON. @streamparser/json uses the `end` method to emit any possible number that was being parsed before completely ending the processing.

## Breaking changes

* Since v0.12 the callbacks arguments have been objectified to be able to be more strict with Typescripts typings
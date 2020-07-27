function fakeParseJSON(str) {
  let i = 0;

  const value = parseValue();
  expectEndOfInput();
  return value;

  function parseObject() {
    if (str[i] === "{") {
      i++;
      skipWhitespace();

      const result = {};

      let initial = true;
      // if it is not '}',
      // we take the path of string -> whitespace -> ':' -> value -> ...
      while (i < str.length && str[i] !== "}") {
        if (!initial) {
          eatComma();
          skipWhitespace();
        }
        const key = parseString();
        if (key === undefined) {
          expectObjectKey();
        }
        skipWhitespace();
        eatColon();
        const value = parseValue();
        result[key] = value;
        initial = false;
      }
      expectNotEndOfInput("}");
      // move to the next character of '}'
      i++;

      return result;
    }
  }

  function parseArray() {
    if (str[i] === "[") {
      i++;
      skipWhitespace();

      const result = [];
      let initial = true;
      while (i < str.length && str[i] !== "]") {
        if (!initial) {
          eatComma();
        }
        const value = parseValue();
        result.push(value);
        initial = false;
      }
      expectNotEndOfInput("]");
      // move to the next character of ']'
      i++;
      return result;
    }
  }

  function parseValue() {
    skipWhitespace();
    const value = parseString() ??
      parseNumber() ??
      parseObject() ??
      parseArray() ??
      parseKeyword("true", true) ??
      parseKeyword("false", false) ??
      parseKeyword("null", null);
    skipWhitespace();
    return value;
  }

  function parseKeyword(name, value) {
    if (str.slice(i, i + name.length) === name) {
      i += name.length;
      return value;
    }
  }

  function skipWhitespace() {
    while (
      str[i] === " " ||
      str[i] === "\n" ||
      str[i] === "\t" ||
      str[i] === "\r"
    ) {
      i++;
    }
  }

  function parseString() {
    if (str[i] === '"') {
      i++;
      let result = "";
      while (i < str.length && str[i] !== '"') {
        if (str[i] === "\\") {
          const char = str[i + 1];
          if (
            char === '"' ||
            char === "\\" ||
            char === "/" ||
            char === "b" ||
            char === "f" ||
            char === "n" ||
            char === "r" ||
            char === "t"
          ) {
            result += char;
            i++;
          } else if (char === "u") {
            if (
              isHexadecimal(str[i + 2]) &&
              isHexadecimal(str[i + 3]) &&
              isHexadecimal(str[i + 4]) &&
              isHexadecimal(str[i + 5])
            ) {
              result += String.fromCharCode(
                parseInt(str.slice(i + 2, i + 6), 16),
              );
              i += 5;
            } else {
              i += 2;
              expectEscapeUnicode(result);
            }
          } else {
            expectEscapeCharacter(result);
          }
        } else {
          result += str[i];
        }
        i++;
      }
      expectNotEndOfInput('"');
      i++;
      return result;
    }
  }

  function isHexadecimal(char) {
    return (
      (char >= "0" && char <= "9") ||
      (char.toLowerCase() >= "a" && char.toLowerCase() <= "f")
    );
  }

  function parseNumber() {
    let start = i;
    if (str[i] === "-") {
      i++;
      expectDigit(str.slice(start, i));
    }
    if (str[i] === "0") {
      i++;
    } else if (str[i] >= "1" && str[i] <= "9") {
      i++;
      while (str[i] >= "0" && str[i] <= "9") {
        i++;
      }
    }

    if (str[i] === ".") {
      i++;
      expectDigit(str.slice(start, i));
      while (str[i] >= "0" && str[i] <= "9") {
        i++;
      }
    }
    if (str[i] === "e" || str[i] === "E") {
      i++;
      if (str[i] === "-" || str[i] === "+") {
        i++;
      }
      expectDigit(str.slice(start, i));
      while (str[i] >= "0" && str[i] <= "9") {
        i++;
      }
    }
    if (i > start) {
      return Number(str.slice(start, i));
    }
  }

  function eatComma() {
    expectCharacter(",");
    i++;
  }

  function eatColon() {
    expectCharacter(":");
    i++;
  }

  // error handling
  function expectNotEndOfInput(expected) {
    if (i === str.length) {
      printCodeSnippet(`Expecting a \`${expected}\` here`);
      throw new Error("JSON_ERROR_0001 Unexpected End of Input");
    }
  }

  function expectEndOfInput() {
    if (i < str.length) {
      printCodeSnippet("Expecting to end here");
      throw new Error("JSON_ERROR_0002 Expected End of Input");
    }
  }

  function expectObjectKey() {
    printCodeSnippet(`Expecting object key here

For example:
{ "foo": "bar" }
  ^^^^^`);
    throw new Error("JSON_ERROR_0003 Expecting JSON Key");
  }

  function expectCharacter(expected) {
    if (str[i] !== expected) {
      printCodeSnippet(`Expecting a \`${expected}\` here`);
      throw new Error("JSON_ERROR_0004 Unexpected token");
    }
  }

  function expectDigit(numSoFar) {
    if (!(str[i] >= "0" && str[i] <= "9")) {
      printCodeSnippet(`JSON_ERROR_0005 Expecting a digit here

For example:
${numSoFar}5
${" ".repeat(numSoFar.length)}^`);
      throw new Error("JSON_ERROR_0006 Expecting a digit");
    }
  }

  function expectEscapeCharacter(strSoFar) {
    printCodeSnippet(`JSON_ERROR_0007 Expecting escape character

For example:
"${strSoFar}\\n"
${" ".repeat(strSoFar.length + 1)}^^
List of escape characters are: \\", \\\\, \\/, \\b, \\f, \\n, \\r, \\t, \\u`);
    throw new Error("JSON_ERROR_0008 Expecting an escape character");
  }

  function expectEscapeUnicode(strSoFar) {
    printCodeSnippet(`Expect escape unicode

For example:
"${strSoFar}\\u0123
${" ".repeat(strSoFar.length + 1)}^^^^^^`);
    throw new Error("JSON_ERROR_0009 Expecting an escape unicode");
  }

  function printCodeSnippet(message) {
    const from = Math.max(0, i - 10);
    const trimmed = from > 0;
    const padding = (trimmed ? 4 : 0) + (i - from);
    const snippet = [
      (trimmed ? "... " : "") + str.slice(from, i + 1),
      " ".repeat(padding) + "^",
      " ".repeat(padding) + message,
    ].join("\n");
    console.log(snippet);
  }
}

// console.log(fakeParseJSON('{ "a": 1, "b": { "c": "asdfasdf" } }'));
// console.log(fakeParseJSON(fs.readFileSync('../samplejson/basic.json').toString()));

// console.log("Try uncommenting the fail cases and see their error message");
// console.log("↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓");

// Fail cases:
// printFailCase("-");
// printFailCase("-1.");
// printFailCase("1e");
// printFailCase("-1e-2.2");
// printFailCase("{");
// printFailCase("{}{");
// printFailCase('{"a"');
// printFailCase('{"a": "b",');
// printFailCase('{"a":"b""c"');
// printFailCase('{"a":"foo\\}');
// printFailCase('{"a":"foo\\u"}');
// printFailCase("[");
// printFailCase("[][");
// printFailCase("[[]");
// printFailCase('["]');

function printFailCase(json) {
  try {
    console.log(`fakeParseJSON('${json}')`);
    fakeParseJSON(json);
  } catch (error) {
    console.error(error);
  }
}

module.exports = fakeParseJSON;

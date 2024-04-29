import { Readable } from "stream";
import JSONParser from "../../src/jsonparser.js";
import Tokenizer from "../../src/tokenizer.js";
import TokenParser from "../../src/tokenparser.js";
import type { ParsedTokenInfo } from "@streamparser/json/utils/types/parsedTokenInfo.js";
import type { ParsedElementInfo } from "@streamparser/json/utils/types/parsedElementInfo.js";

export type TestData = {
  value: string | string[] | Iterable<number>;
  paths?: string[];
  expected: unknown[];
};

type ParseableData = string | Iterable<number>;
type InputData<T> = T | T[] | (() => Generator<T>);

function iterableData<T>(data: InputData<T>): Iterable<T> {
  if (typeof data === "function") return (data as () => Generator<T>)();
  if (Array.isArray(data)) return data;
  return [data];
}

export async function runJSONParserTest(
  jsonparser: JSONParser,
  data: InputData<ParseableData>,
  onValue: (parsedElementInfo: ParsedElementInfo) => void = () => {
    /* Do nothing */
  },
) {
  return new Promise((resolve, reject) => {
    const input = new Readable();
    input._read = () => {
      /* Do nothing */
    };
    jsonparser.on("data", onValue);
    jsonparser.on("error", reject);
    jsonparser.on("end", resolve);
    input.pipe(jsonparser);
    for (const value of iterableData(data)) {
      input.push(value);
    }
    input.push(null);
  });
}

export async function runTokenizerTest(
  tokenizer: Tokenizer,
  data: InputData<ParseableData>,
  onToken: (parsedElementInfo: ParsedTokenInfo) => void = () => {
    /* Do nothing */
  },
) {
  return new Promise((resolve, reject) => {
    const input = new Readable({ objectMode: true });
    input._read = () => {
      /* Do nothing */
    };
    tokenizer.on("data", onToken);
    tokenizer.on("error", reject);
    tokenizer.on("end", resolve);
    input.pipe(tokenizer);
    for (const value of iterableData(data)) {
      input.push(value);
    }
    input.push(null);
  });
}

export async function runTokenParserTest(
  tokenParser: TokenParser,
  data: InputData<Omit<ParsedTokenInfo, "offset">>,
  onValue: (parsedElementInfo: ParsedElementInfo) => void = () => {
    /* Do nothing */
  },
) {
  return new Promise((resolve, reject) => {
    const input = new Readable({ objectMode: true });
    input._read = () => {
      /* Do nothing */
    };
    tokenParser.on("data", onValue);
    tokenParser.on("error", reject);
    tokenParser.on("end", resolve);
    input.pipe(tokenParser);
    for (const value of iterableData(data)) {
      input.push(value);
    }
    input.push(null);
  });
}

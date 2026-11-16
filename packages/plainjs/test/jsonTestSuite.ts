import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import JSONParser from "../src/jsonparser.js";
import { TokenizerError } from "../src/tokenizer.js";
import { TokenParserError } from "../src/tokenparser.js";

type Result = "accept" | "reject";
type Expectation = Result | "optional";

const suiteRoot = fileURLToPath(
  new URL("./data/JSONTestSuite/", import.meta.url),
);

const testCases = ["test_parsing", "test_transform"].flatMap((suite) =>
  readdirSync(join(suiteRoot, suite), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(({ name }) => {
      const expectation: Expectation =
        suite === "test_transform"
          ? "optional"
          : name.startsWith("y_")
            ? "accept"
            : name.startsWith("n_")
              ? "reject"
              : "optional";

      return {
        id: `${suite}/${name}`,
        input: readFileSync(join(suiteRoot, suite, name)),
        expectation,
      };
    }),
);

function isInputError(error: unknown): boolean {
  return (
    error instanceof TokenizerError ||
    error instanceof TokenParserError ||
    (error instanceof TypeError &&
      error.message === "The encoded data was not valid for encoding utf-8") ||
    (error instanceof Error &&
      error.message.startsWith("Parser ended in mid-parsing"))
  );
}

function parse(input: Uint8Array): Result {
  const parser = new JSONParser();
  let rootCount = 0;
  parser.onValue = ({ stack }) => {
    if (stack.length === 0) rootCount += 1;
  };

  try {
    parser.write(input);
    if (!parser.isEnded) parser.end();
  } catch (error) {
    if (isInputError(error)) return "reject";
    throw error;
  }

  return parser.isEnded && rootCount === 1 ? "accept" : "reject";
}

describe("JSONTestSuite", () => {
  for (const { id, input, expectation } of testCases) {
    test(id, () => {
      const result = parse(input);
      if (expectation !== "optional") expect(result).toBe(expectation);
    });
  }
});

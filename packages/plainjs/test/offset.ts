import { runTokenizerTest } from "./utils/testRunner.js";
import { Tokenizer } from "../src/index.js";
import TokenType from "../src/utils/types/tokenType.js";

const {
  LEFT_BRACE,
  RIGHT_BRACE,
  LEFT_BRACKET,
  RIGHT_BRACKET,
  COLON,
  COMMA,
  TRUE,
  FALSE,
  NULL,
  STRING,
  NUMBER,
} = TokenType;

const input1 = '{\n  "string": "value",\n  "number": 3,\n  "object"';
const input2 = ': {\n  "key": "vд"\n  },\n  "array": [\n  -1,\n  12\n  ]\n  ';
const input3 = '"null": null, "true": true, "false": false, "frac": 3.14 }';

const offsets = [
  [0, LEFT_BRACE],
  [4, STRING],
  [12, COLON],
  [14, STRING],
  [21, COMMA],
  [25, STRING],
  [33, COLON],
  [35, NUMBER],
  [36, COMMA],
  [40, STRING],
  [48, COLON],
  [50, LEFT_BRACE],
  [54, STRING],
  [59, COLON],
  [61, STRING],
  [69, RIGHT_BRACE],
  [70, COMMA],
  [74, STRING],
  [81, COLON],
  [83, LEFT_BRACKET],
  [87, NUMBER],
  [89, COMMA],
  [93, NUMBER],
  [98, RIGHT_BRACKET],
  [102, STRING],
  [108, COLON],
  [110, NULL],
  [114, COMMA],
  [116, STRING],
  [122, COLON],
  [124, TRUE],
  [128, COMMA],
  [130, STRING],
  [137, COLON],
  [139, FALSE],
  [144, COMMA],
  [146, STRING],
  [152, COLON],
  [154, NUMBER],
  [159, RIGHT_BRACE],
];

test("offset", async () => {
  let i = 0;

  await runTokenizerTest(
    new Tokenizer(),
    [input1, input2, input3],
    ({ token, offset }) => {
      expect(offset).toEqual(offsets[i][0]);
      expect(token).toEqual(offsets[i][1]);
      i += 1;
    }
  );
});

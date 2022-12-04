import { JsonKey, JsonStruct } from "./jsonTypes.ts";

export enum TokenParserMode {
  OBJECT = 0,
  ARRAY = 1,
}

export interface StackElement {
  key: JsonKey;
  value: JsonStruct;
  mode?: TokenParserMode;
  emit: boolean;
}

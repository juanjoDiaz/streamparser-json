import type { JsonPrimitive } from "../utils/types/jsonTypes.js";
import type TokenType from "../utils/types/tokenType.js";

export interface OptimisticParsedTokenInfo {
  token: TokenType;
  value: JsonPrimitive;
  offset: number;
  type: "complete" | "incomplete";
}

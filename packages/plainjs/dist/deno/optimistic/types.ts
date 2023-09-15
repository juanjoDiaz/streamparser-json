import type { JsonPrimitive } from "../utils/types/jsonTypes.ts";
import type TokenType from "../utils/types/tokenType.ts";

export interface OptimisticParsedTokenInfo {
  token: TokenType;
  value: JsonPrimitive;
  offset: number;
  type: "complete" | "incomplete";
}

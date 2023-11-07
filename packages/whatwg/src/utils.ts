import type { ParsedElementInfo } from "@streamparser/json/utils/types/parsedElementInfo.js";

export function cloneParsedElementInfo(
  parsedElementInfo: ParsedElementInfo,
): ParsedElementInfo {
  const { value, key, parent, stack, partial } = parsedElementInfo;
  return { value, key, parent: clone(parent), stack: clone(stack), partial };
}

function clone<T>(obj: T): T {
  // Only objects are passed by reference and must be cloned
  if (typeof obj !== "object") return obj;
  // Solve arrays with empty positions
  if (Array.isArray(obj) && obj.filter((i) => i).length === 0) return obj;
  return JSON.parse(JSON.stringify(obj));
}

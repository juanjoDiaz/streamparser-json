// Slow code to string converter (only used when throwing syntax errors)
export function getKeyFromValue(obj, value) {
  return Object.entries(obj).find(([_, possibleValue]) => possibleValue === value)[0];
}

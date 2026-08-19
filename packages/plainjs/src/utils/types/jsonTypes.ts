/**
 * The types of the JSON values that the parser produces.
 *
 * @module
 */

/** A JSON scalar value: a string, a number, a boolean or `null`. */
export type JsonPrimitive = string | number | boolean | null;
/**
 * The key under which a value was found: the property name if the value is
 * inside an object, the index if it's inside an array, or `undefined` if it's
 * the top-level value of the JSON document.
 */
export type JsonKey = string | number | undefined;
/** A JSON object. */
export type JsonObject = { [key: string]: JsonPrimitive | JsonStruct };
/** A JSON array. */
export type JsonArray = (JsonPrimitive | JsonStruct)[];
/** A JSON container: either an object or an array. */
export type JsonStruct = JsonObject | JsonArray;

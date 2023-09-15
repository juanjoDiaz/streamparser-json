export type JsonPrimitive = string | number | boolean | null;
export type JsonKey = string | number | undefined;
export type JsonObject = {
  [key: string]: JsonPrimitive | JsonStruct | undefined;
};
export type JsonArray = (JsonPrimitive | JsonStruct)[];
export type JsonStruct = JsonObject | JsonArray;

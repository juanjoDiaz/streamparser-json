import { TokenType, StackElement } from "@streamparser/json";
import { JsonPrimitive, JsonKey, JsonObject, JsonArray, JsonStruct } from "@streamparser/json/utils/types.js";


export interface ParsedElementInfo {
  value: JsonPrimitive | JsonStruct,
  key: JsonKey | undefined,
  parent: JsonStruct | undefined,
  stack: StackElement[];
}

export interface ParsedArrayElement extends ParsedElementInfo{ 
  value: JsonPrimitive | JsonStruct,
  key: number,
  parent: JsonArray,
  stack: StackElement[]
};

export interface ParsedObjectProperty extends ParsedElementInfo{ 
  value: JsonPrimitive | JsonStruct,
  key: string,
  parent: JsonObject,
  stack: StackElement[]
};

export interface ParsedTopLevelElement extends ParsedElementInfo{ 
  value: JsonPrimitive | JsonStruct,
  key: undefined,
  parent: undefined,
  stack: []
};
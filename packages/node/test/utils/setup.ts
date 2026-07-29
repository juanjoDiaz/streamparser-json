import {
  ReadableStream as NodeReadableStream,
  TransformStream as NodeTransformStream,
} from "node:stream/web";

if (!global.TransformStream) {
  // @ts-expect-error Overriding TransformStream for Node 16
  global.TransformStream = NodeTransformStream;
  // @ts-expect-error Overriding ReadableStream for Node 16
  global.ReadableStream = NodeReadableStream;
}

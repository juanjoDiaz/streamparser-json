import tap from "tap";
import JsonParser from "../src/jsonparse";
import { charset } from "../src/utils/utf-8";

const { test } = tap;

const { QUOTATION_MARK } = charset;

const quote = String.fromCharCode(QUOTATION_MARK);

test("write accept strings", (t) => {
  t.plan(1);
  const value = "test";

  const p = new JsonParser();
  p.onValue = (v) => t.equal(v, value);
  p.onEnd = () => t.end();

  p.write(quote);
  p.write(value);
  p.write(quote);

  p.end();
});

test("write accept Uint8Array", (t) => {
  t.plan(1);
  const value = "test";

  const p = new JsonParser();
  p.onValue = (v) => t.equal(v, value);
  p.onEnd = () => t.end();

  p.write(quote);
  p.write(new Uint8Array([116, 101, 115, 116]));
  p.write(quote);

  p.end();
});

test("write accept Uint16Array", (t) => {
  t.plan(1);

  const value = "test";

  const p = new JsonParser();
  p.onValue = (v) => t.equal(v, value);
  p.onEnd = () => t.end();

  p.write(quote);
  p.write(new Uint16Array([116, 101, 115, 116]));
  p.write(quote);

  p.end();
});

test("write accept Uint32Array", (t) => {
  t.plan(1);

  const value = "test";

  const p = new JsonParser();
  p.onValue = (v) => t.equal(v, value);
  p.onEnd = () => t.end();

  p.write(quote);
  p.write(new Uint32Array([116, 101, 115, 116]));
  p.write(quote);

  p.end();
});

test("write accept Array", (t) => {
  t.plan(1);

  const value = "test";

  const p = new JsonParser();
  p.onValue = (v) => t.equal(v, value);
  p.onEnd = () => t.end();

  p.write(quote);
  p.write([116, 101, 115, 116]);
  p.write(quote);

  p.end();
});

test("write throw on invalid type", (t) => {
  t.plan(1);

  const p = new JsonParser();
  p.onError = () => t.ok(true);
  
  p.write(745674 as any);
});

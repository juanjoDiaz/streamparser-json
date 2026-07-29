// Representative JSON corpus for whole-library throughput benchmarking.
//
// Every generator is PURE, index-driven string building: no Math.random, no
// Date, no Intl, no imports. The same source produces byte-identical output in
// Node and in every browser, so cross-engine numbers are comparable and nothing
// large has to be committed to the repo -- each shape is generated in-process at
// run time and sized to a byte target.
//
// Shapes 2/3/4 mirror the structure of the canonical nativejson-benchmark trio
// (canada.json / citm_catalog.json / twitter.json) so results line up with the
// published literature; the rest are pragmatic real-world categories (bulk
// export, columnar numbers, text corpus, NDJSON log stream). All content is
// synthetic (example.com, "Person N", fabricated ids) -- no real data.

// splitmix32 integer hash -- pure function of a 32-bit input. Determinism comes
// from hashing the item index, not from carried PRNG state, so any item can be
// generated independently and identically anywhere.
function hash32(x) {
  x = (x ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}
const hash2 = (a, b) => hash32((Math.imul(a, 0x01000193) ^ b) >>> 0);
const unit = (x) => hash32(x) / 4294967296;
const between = (x, lo, hi) => lo + (hash32(x) % (hi - lo + 1));
const pick = (x, arr) => arr[hash32(x) % arr.length];

const _enc = new TextEncoder();
export const byteLength = (s) => _enc.encode(s).length;

// Size an array-shaped doc to ~targetBytes. Measure the average per-item bytes
// (from a 64-item sample, one separator each) and the FIXED frame/envelope bytes
// separately -- otherwise a large envelope (e.g. catalog's events map) is
// amortized into the per-item average and the doc undershoots badly. Emit the
// count that fills (target - envelope). Deterministic; lands within a few %.
function fitToBytes(item, sep, frame, targetBytes) {
  const SAMPLE = 64;
  let sample = "";
  for (let i = 0; i < SAMPLE; i++) sample += (i ? sep : "") + item(i);
  const avgPerItem = byteLength(sample) / SAMPLE;
  const envelope = byteLength(frame(""));
  const n = Math.max(1, Math.round((targetBytes - envelope) / avgPerItem));
  const parts = new Array(n);
  for (let i = 0; i < n; i++) parts[i] = item(i);
  return frame(parts.join(sep));
}
const arrayFrame = (s) => `[${s}]`;

// --- 1. realistic-mixed: heterogeneous REST records (the headline "real JSON") -
function uuid(i) {
  const h = (n) => hash32(n).toString(16).padStart(8, "0");
  return (
    h(i) +
    "-" +
    h(i + 1).slice(0, 4) +
    "-" +
    h(i + 2).slice(0, 4) +
    "-" +
    h(i + 3).slice(0, 4) +
    "-" +
    h(i + 4) +
    h(i + 5).slice(0, 4)
  );
}
function apiRecord(i) {
  return (
    '{"id":"' +
    uuid(i) +
    '","type":"user","attributes":{"name":"Person ' +
    i +
    '","email":"user' +
    i +
    '@example.com","age":' +
    between(i, 18, 90) +
    ',"active":' +
    (i % 3 !== 0) +
    ',"score":' +
    (unit(i) * 100).toFixed(4) +
    ',"tags":["' +
    pick(i, ["a", "b", "c", "d"]) +
    '","' +
    pick(i + 1, ["x", "y", "z"]) +
    '"],"address":{"city":"' +
    pick(i, ["Berlin", "Paris", "Tokyo", "Lima"]) +
    '","zip":"' +
    (10000 + (hash32(i) % 90000)) +
    '"}},"created_at":"2025-0' +
    (1 + (i % 9)) +
    "-1" +
    (i % 9) +
    "T0" +
    (i % 10) +
    ':00:00Z"}'
  );
}
const realisticMixed = (target) =>
  fitToBytes(apiRecord, ",", arrayFrame, target);

// --- 2. geo-coordinates: GeoJSON, number-heavy, deeply-nested arrays (~canada) -
const coord = (i) =>
  "[" +
  (-141 + unit(2 * i) * 89).toFixed(6) +
  "," +
  (41 + unit(2 * i + 1) * 43).toFixed(6) +
  "]";
function geoFeature(f) {
  const pts = 60;
  const ring = new Array(pts);
  for (let k = 0; k < pts; k++) ring[k] = coord(f * 100003 + k);
  return (
    '{"type":"Feature","properties":{"name":"region-' +
    f +
    '","area_km2":' +
    between(f, 100, 900000) +
    '},"geometry":{"type":"Polygon","coordinates":[[' +
    ring.join(",") +
    "]]}}"
  );
}
const geoCoordinates = (target) =>
  fitToBytes(
    geoFeature,
    ",",
    (s) => `{"type":"FeatureCollection","features":[${s}]}`,
    target,
  );

// --- 3. catalog: deeply-nested enterprise payload (~citm_catalog) --------------
function idNameMap(seed, n, prefix) {
  const p = new Array(n);
  for (let i = 0; i < n; i++)
    p[i] =
      '"' +
      (100000000 + (hash32(seed + i) % 900000000)) +
      '":"' +
      prefix +
      "-" +
      i +
      '"';
  return `{${p.join(",")}}`;
}
const CATALOG_EVENTS = 200;
function catalogEvent(e) {
  const sub = [];
  for (let k = 0; k < 2 + (e % 4); k++)
    sub.push(300000000 + (hash32(e * 7 + k) % 90000000));
  const id = 138000000 + e;
  return (
    '"' +
    id +
    '":{"id":' +
    id +
    ',"logo":' +
    (e % 3 ? "null" : `"/img/${id}.png"`) +
    ',"name":"Event ' +
    e +
    '","subTopicIds":[' +
    sub.join(",") +
    '],"subjectCode":null,"subtitle":null,"topicIds":[' +
    (320000000 + e) +
    "," +
    (107000000 + e) +
    "]}"
  );
}
function catalogPerf(p) {
  const prices = [],
    areas = [];
  for (let k = 0; k < 1 + (p % 3); k++)
    prices.push(
      '{"amount":' +
        (5000 + (hash32(p * 11 + k) % 95000)) +
        ',"audienceSubCategoryId":337100890,"seatCategoryId":' +
        (338000000 + k) +
        "}",
    );
  for (let k = 0; k < 1 + (p % 5); k++)
    areas.push(`{"areaId":${205000000 + k},"blockIds":[]}`);
  const id = 339000000 + p;
  return (
    '{"eventId":' +
    (138000000 + (p % CATALOG_EVENTS)) +
    ',"id":' +
    id +
    ',"logo":null,"name":' +
    (p % 4 ? "null" : `"Perf ${p}"`) +
    ',"prices":[' +
    prices.join(",") +
    '],"seatCategories":[{"areas":[' +
    areas.join(",") +
    '],"seatCategoryId":' +
    (338000000 + (p % 7)) +
    '}],"seatMapImage":null,"start":' +
    (1372700000000 + p * 3600000) +
    ',"venueCode":"VENUE_' +
    (p % 20) +
    '"}'
  );
}
function catalog(target) {
  const ev = new Array(CATALOG_EVENTS);
  for (let e = 0; e < CATALOG_EVENTS; e++) ev[e] = catalogEvent(e);
  const head =
    '{"areaNames":' +
    idNameMap(1, 20, "area") +
    ',"audienceSubCategoryNames":' +
    idNameMap(2, 1, "sub") +
    ',"blockNames":{}' +
    ',"events":{' +
    ev.join(",") +
    '},"performances":[';
  const tail =
    '],"seatCategoryNames":' +
    idNameMap(3, 64, "seat") +
    ',"subTopicNames":' +
    idNameMap(4, 19, "subtopic") +
    ',"subjectNames":{}' +
    ',"topicNames":' +
    idNameMap(6, 4, "topic") +
    ',"venueNames":' +
    idNameMap(7, 20, "venue") +
    "}";
  return fitToBytes(catalogPerf, ",", (s) => head + s + tail, target);
}

// --- 4. social-feed: unicode-heavy social timeline (~twitter) ------------------
const SNIP = [
  "一",
  "の検索結果",
  "こんにちは世界",
  "テスト",
  "streaming",
  "JSON",
  "мир",
  "café",
  "résumé",
  "東京",
];
const words = (i, n) => {
  const w = new Array(n);
  for (let k = 0; k < n; k++) w[k] = pick(hash2(i, k), SNIP);
  return w.join(" ");
};
function feedUser(i) {
  return (
    '{"id":' +
    (1000000 + i) +
    ',"id_str":"' +
    (1000000 + i) +
    '","name":"' +
    words(i * 3, 2) +
    '","screen_name":"user_' +
    i +
    '","location":"' +
    pick(i, ["東京", "New York", "München", ""]) +
    '","followers_count":' +
    between(i, 0, 100000) +
    ',"friends_count":' +
    between(i * 2, 0, 5000) +
    ',"verified":' +
    (i % 17 === 0) +
    ',"profile_image_url":"http://example.com/' +
    i +
    '.jpg"}'
  );
}
function tweet(i) {
  const idNum = `70000000000000${String(1000 + i)}`;
  const tags = [];
  for (let k = 0; k < i % 3; k++)
    tags.push(
      '{"text":"' +
        pick(hash2(i, k), SNIP) +
        '","indices":[' +
        k +
        "," +
        (k + 5) +
        "]}",
    );
  return (
    '{"created_at":"Wed Aug 27 13:08:' +
    String(i % 60).padStart(2, "0") +
    ' +0000 2025"' +
    ',"id":' +
    idNum +
    ',"id_str":"' +
    idNum +
    '","text":"' +
    words(i, 8) +
    " \\ud83d\\ude00 #" +
    pick(i, SNIP) +
    '"' +
    ',"truncated":false,"user":' +
    feedUser(i) +
    ',"retweet_count":' +
    between(i, 0, 5000) +
    ',"favorite_count":' +
    between(i * 3, 0, 20000) +
    ',"entities":{"hashtags":[' +
    tags.join(",") +
    '],"urls":[],"user_mentions":[]}' +
    ',"lang":"' +
    pick(i, ["ja", "en", "und", "de"]) +
    '"}'
  );
}
const socialFeed = (target) =>
  fitToBytes(
    tweet,
    ",",
    (s) =>
      '{"statuses":[' +
      s +
      '],"search_metadata":{"count":0,"query":"%E4%B8%80","completed_in":0.05}}',
    target,
  );

// --- 5. records-array: flat uniform DB/bulk export -----------------------------
function row(i) {
  return (
    '{"id":' +
    i +
    ',"sku":"SKU-' +
    (100000 + i) +
    '","price":' +
    (between(i, 100, 99999) / 100).toFixed(2) +
    ',"qty":' +
    between(i, 0, 1000) +
    ',"in_stock":' +
    (i % 2 === 0) +
    ',"category":"' +
    pick(i, ["tools", "food", "books", "toys", "home"]) +
    '","updated":' +
    (1690000000 + i * 37) +
    "}"
  );
}
const recordsArray = (target) => fitToBytes(row, ",", arrayFrame, target);

// --- 6. numbers-array: every number-tokenizer branch ---------------------------
function num(i) {
  const r = hash32(i);
  switch (r % 4) {
    case 0:
      return String((r % 2000000) - 1000000);
    case 1:
      return ((r % 1000000) / 1000).toFixed(3);
    case 2:
      return (unit(i) * 2 - 1).toExponential(6);
    default:
      return (unit(i) * 1e6).toFixed(1);
  }
}
const numbersArray = (target) => fitToBytes(num, ",", arrayFrame, target);

// --- 7. strings-array: ASCII-dominant text with minority escapes/unicode --------
const LOREM = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
];
function sentence(i) {
  const n = 3 + (hash32(i) % 12),
    w = new Array(n);
  for (let k = 0; k < n; k++) w[k] = pick(hash2(i, k), LOREM);
  let s = w.join(" ");
  if (i % 20 === 0) s += ' \\"quote\\" and\\ttab';
  if (i % 13 === 0) s += " café résumé";
  return `"${s}"`;
}
const stringsArray = (target) => fitToBytes(sentence, ",", arrayFrame, target);

// --- 8. ndjson-logs: newline-delimited multi-shape event stream ----------------
const LVL = ["INFO", "WARN", "ERROR", "DEBUG"];
const MSG = [
  "request completed",
  "cache miss",
  "connection reset",
  "user login",
  "payload too large",
  "retrying upstream",
];
function logLine(i) {
  const ts =
    '"ts":"2025-07-27T' +
    String(i % 24).padStart(2, "0") +
    ":" +
    String(i % 60).padStart(2, "0") +
    ':00.123Z"';
  switch (hash32(i) % 3) {
    case 0:
      return (
        "{" +
        ts +
        ',"level":"INFO","type":"request","method":"' +
        pick(i, ["GET", "POST", "PUT"]) +
        '","path":"/api/v1/resource/' +
        (hash32(i) % 1000) +
        '","status":' +
        pick(i, [200, 201, 404, 500]) +
        ',"duration_ms":' +
        between(i, 1, 800) +
        ',"bytes":' +
        between(i * 2, 100, 50000) +
        "}"
      );
    case 1:
      return (
        "{" +
        ts +
        ',"level":"' +
        pick(i, LVL) +
        '","type":"log","logger":"svc.module.' +
        (i % 12) +
        '","message":"' +
        pick(i, MSG) +
        " (id=" +
        (hash32(i) % 100000) +
        ')","thread":' +
        (i % 8) +
        "}"
      );
    default:
      return (
        "{" +
        ts +
        ',"type":"metric","name":"' +
        pick(i, ["cpu.load", "mem.used", "req.rate", "gc.pause"]) +
        '","value":' +
        (unit(i) * 100).toFixed(3) +
        ',"tags":{"host":"node-' +
        (i % 16) +
        '","region":"' +
        pick(i, ["us", "eu", "ap"]) +
        '"}}'
      );
  }
}
const ndjsonLogs = (target) => fitToBytes(logLine, "\n", (s) => s, target);

// --- Tier-3 stress shapes (Node-only, explicitly NOT representative) -----------
function whitespaceHeavy(target) {
  const pad = " ".repeat(200);
  const unitStr = `${pad}{${pad}"k"${pad}:${pad}"v"${pad}}${pad}`;
  return fitToBytes(() => unitStr, ",", arrayFrame, target);
}
function deepNested(target) {
  // A single object nested `depth` levels; size ~ depth so derive depth from target.
  const depth = Math.max(1, Math.round(target / 6));
  return `{${'"a":{'.repeat(depth)}"v":1${"}".repeat(depth + 1)}`;
}
const longString = (target) => `"${"a".repeat(Math.max(1, target - 2))}"`;
const longNumber = (target) => "9".repeat(Math.max(1, target));

// --- Registry ------------------------------------------------------------------
// Each entry: { gen(targetBytes)->string, selector (JSONPath that filters the
// item stream, for the Tier-2 options sweep), ndjson (separator config) }.
export const TIER1 = [
  { name: "realistic-mixed", gen: realisticMixed, selector: "$.*" },
  { name: "geo-coordinates", gen: geoCoordinates, selector: "$.features.*" },
  { name: "catalog", gen: catalog, selector: "$.performances.*" },
  { name: "social-feed", gen: socialFeed, selector: "$.statuses.*" },
  { name: "records-array", gen: recordsArray, selector: "$.*" },
  { name: "numbers-array", gen: numbersArray, selector: "$.*" },
  { name: "strings-array", gen: stringsArray, selector: "$.*" },
  { name: "ndjson-logs", gen: ndjsonLogs, selector: "$", ndjson: true },
];

export const TIER3_STRESS = [
  { name: "whitespace-heavy", gen: whitespaceHeavy },
  { name: "deep-nested", gen: deepNested },
  { name: "long-string", gen: longString },
  { name: "long-number", gen: longNumber },
];

// Build a corpus entry's bytes at a target size. Returns { name, bytes, ndjson }.
export function generate(entry, targetBytes) {
  const source = entry.gen(targetBytes);
  return {
    name: entry.name,
    bytes: _enc.encode(source),
    ndjson: !!entry.ndjson,
  };
}

// Runs the end-to-end throughput benchmark in Node + Chromium/Firefox/WebKit.
// Node measures all three adapters (core, Node Transform, WHATWG
// TransformStream); the browsers measure core + WHATWG (the Node Transform
// needs node:stream, so it can't run in a browser). The built ESM is served
// over http so the browsers import the exact same code Node uses.
import { chromium, firefox, webkit } from "playwright";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import { JSONParser } from "@streamparser/json";
import { JSONParser as JSONParserNode } from "@streamparser/json-node";
import { JSONParser as JSONParserWhatwg } from "@streamparser/json-whatwg";
import { runThroughputBench } from "./bench.mjs";

// Open a fresh page pointed at the harness and wait until it's ready.
async function openBenchPage(browser) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction("window.__bench || window.__ERROR__", {
    timeout: 60000,
  });
  const err = await page.evaluate("window.__ERROR__");
  if (err) {
    await page.close();
    throw new Error(err);
  }
  return page;
}

// Run every scenario in its OWN fresh page. A single long-lived page slides
// into GC thrashing (Firefox degrades to ~0 MB/s and, in one task, OOM-crashes;
// see bench.mjs) as heap accumulates across scenarios, so closing the page
// between scenarios is what keeps the per-scenario numbers honest.
async function runInBrowser(type) {
  const browser = await type.launch();
  try {
    const probe = await openBenchPage(browser);
    const labels = await probe.evaluate("window.__bench.labels");
    const adapters = await probe.evaluate("window.__bench.adapters");
    await probe.close();

    const rows = [];
    for (let i = 0; i < labels.length; i++) {
      const page = await openBenchPage(browser);
      rows.push(await page.evaluate(`window.__bench.run(${i})`));
      await page.close();
    }
    return { adapters, rows };
  } finally {
    await browser.close();
  }
}

const packagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIME = { ".js": "text/javascript", ".mjs": "text/javascript" };

// The WHATWG build imports the core via the bare "@streamparser/json"
// specifier, so the page needs an import map to resolve it to the served core.
const HTML = `<!doctype html><html><head>
<script type="importmap">
{ "imports": {
  "@streamparser/json": "/plainjs/dist/mjs/index.js",
  "@streamparser/json/": "/plainjs/dist/mjs/"
} }
</script>
</head><body><script type="module">
import { JSONParser } from '/plainjs/dist/mjs/index.js';
import { JSONParser as JSONParserWhatwg } from '/whatwg/dist/mjs/index.js';
import { runThroughputScenario, throughputScenarioLabels, throughputAdapterNames } from '/performance/throughput/bench.mjs';
try {
  const parsers = { JSONParser, JSONParserWhatwg };
  window.__bench = {
    labels: throughputScenarioLabels(),
    adapters: throughputAdapterNames(parsers),
    run: (i) => runThroughputScenario(parsers, i),
  };
} catch (e) { window.__ERROR__ = String((e && e.stack) || e); }
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  try {
    const path = req.url.split("?")[0];
    if (path === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(HTML);
      return;
    }
    const data = await readFile(join(packagesDir, path));
    res.setHeader(
      "Content-Type",
      MIME[extname(path)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

const envs = {};

// Node, in-process (all three adapters).
envs.node = await runThroughputBench({
  JSONParser,
  JSONParserNode,
  JSONParserWhatwg,
});

// Browsers (core + WHATWG).
for (const [name, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
]) {
  try {
    envs[name] = await runInBrowser(type);
  } catch (e) {
    console.error(`\n${name} could not run: ${e.message.split("\n")[0]}`);
  }
}
server.close();

// Report: one table per environment (MB/s; higher is faster).
for (const [envName, data] of Object.entries(envs)) {
  console.log(`\n=== ${envName} ===   (MB/s; higher is faster)`);
  const w = 10;
  console.log(
    "input".padEnd(22) +
      "KB".padStart(6) +
      data.adapters.map((a) => a.padStart(w)).join(""),
  );
  for (const row of data.rows) {
    let line = row.label.padEnd(22) + String(row.kb).padStart(6);
    for (const a of data.adapters) {
      const v = row.mbps[a];
      line += (v == null ? "n/a" : String(v)).padStart(w);
    }
    console.log(line);
  }
}

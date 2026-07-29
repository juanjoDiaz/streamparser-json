// Runs the string-builder benchmark in Node and in Chromium, Firefox and
// WebKit (Safari's engine) via Playwright, then prints one comparison table
// per environment. Serves the built ESM over http so the browsers can import
// the exact same code Node uses.

import { readFile } from "node:fs/promises";
import http from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BufferedString,
  NonBufferedString,
} from "@streamparser/json/utils/bufferedString.js";
import { chromium, firefox, webkit } from "playwright";
import { runStringBuilderBench } from "./bench.mjs";

const packagesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const MIME = { ".js": "text/javascript", ".mjs": "text/javascript" };

const HTML = `<!doctype html><html><body><script type="module">
import { NonBufferedString, BufferedString } from '/plainjs/dist/mjs/utils/bufferedString.js';
import { runStringBuilderBench } from '/performance/micro/string-builder/bench.mjs';
try { window.__RESULT__ = runStringBuilderBench({ NonBufferedString, BufferedString }); }
catch (e) { window.__ERROR__ = String((e && e.stack) || e); }
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

// Node, in-process.
envs.node = runStringBuilderBench({ NonBufferedString, BufferedString });

// Browsers.
for (const [name, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
]) {
  let browser;
  try {
    browser = await type.launch();
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForFunction("window.__RESULT__ || window.__ERROR__", {
      timeout: 180000,
    });
    const err = await page.evaluate("window.__ERROR__");
    if (err) console.error(`\n${name} ERROR:\n${err}`);
    else envs[name] = await page.evaluate("window.__RESULT__");
  } catch (e) {
    console.error(`\n${name} could not run: ${e.message}`);
  } finally {
    if (browser) await browser.close();
  }
}
server.close();

// Report.
for (const [envName, data] of Object.entries(envs)) {
  const vals = Object.values(data.correctness);
  const ok = vals.every((v) => v === vals[0]);
  const cases = [...new Set(data.results.map((r) => r.case))];
  const variants = [...new Set(data.results.map((r) => r.variant))];
  console.log(`\n=== ${envName} ===  (correctness ok: ${ok})`);
  const w = 22;
  console.log("case".padEnd(10) + variants.map((v) => v.padStart(w)).join(""));
  for (const c of cases) {
    let line = c.padEnd(10);
    for (const v of variants) {
      const r = data.results.find((x) => x.case === c && x.variant === v);
      line += `${r.mbps} MB/s`.padStart(w);
    }
    console.log(line);
  }
}

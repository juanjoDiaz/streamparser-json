// Runs the multibyte span-vs-per-code-point benchmark in Node + Chromium,
// Firefox and WebKit via Playwright.

import { readFile } from "node:fs/promises";
import http from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BufferedString,
  NonBufferedString,
} from "@streamparser/json/utils/bufferedString.js";
import { chromium, firefox, webkit } from "playwright";
import { runSpanBench } from "./bench.mjs";

const packagesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const MIME = { ".js": "text/javascript", ".mjs": "text/javascript" };
const HTML = `<!doctype html><html><body><script type="module">
import { NonBufferedString, BufferedString } from '/plainjs/dist/mjs/utils/bufferedString.js';
import { runSpanBench } from '/performance/micro/string-span/bench.mjs';
try { window.__RESULT__ = runSpanBench({ NonBufferedString, BufferedString }); }
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
envs.node = runSpanBench({ NonBufferedString, BufferedString });
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

for (const [envName, results] of Object.entries(envs)) {
  console.log(`\n=== ${envName} ===   (MB/s; perCodepoint -> span)`);
  for (const r of results) {
    const x = r.perCP && r.span ? `${(r.span / r.perCP).toFixed(2)}x` : "n/a";
    console.log(
      `  ${r.case.padEnd(22)} ${r.builder.padEnd(12)} ${String(r.perCP).padStart(5)} -> ${String(r.span).padStart(6)}   ${x}`,
    );
  }
}

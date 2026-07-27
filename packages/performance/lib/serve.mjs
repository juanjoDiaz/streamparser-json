// Reusable browser harness: serve the built ESM over http and drive a benchmark
// in Chromium/Firefox/WebKit. Node-only (http + Playwright); never served to a
// page. Factors out the http server + MIME + import-map page shell + the
// fresh-page-per-scenario Playwright loop shared by every browser benchmark.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const MIME = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
};

// Serve everything under `packagesDir` (the monorepo `packages/` dir) and serve
// "/" as a page whose <head> carries `importmap` (so the WHATWG build's bare
// `@streamparser/json` specifier resolves to the served core) and whose module
// body is `moduleScript` (it must set window.__bench = {labels, adapters, run}).
export async function startServer(packagesDir, { importmap, moduleScript }) {
  const HTML =
    "<!doctype html><html><head>\n" +
    '<script type="importmap">' +
    JSON.stringify({ imports: importmap }) +
    "</script>\n" +
    '</head><body><script type="module">\n' +
    moduleScript +
    "\n</script></body></html>";

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
  return { url, close: () => server.close() };
}

// Drive one benchmark across one browser engine, running EACH scenario in its
// OWN fresh page (closed after). A single long-lived page accumulates heap and
// Firefox degrades to ~0 MB/s / OOM-crashes on a big matrix; closing the page
// between scenarios resets the heap so only one scenario's data is ever live.
// Returns { adapters, labels, rows } with rows[i] = whatever __bench.run(i)
// returns (null if a scenario throws or exceeds scenarioTimeout -- one dead
// cell never kills the run).
export async function benchInBrowser(browserType, url, opts = {}) {
  const { readyTimeout = 60000, scenarioTimeout = 120000, onScenario } = opts;
  const browser = await browserType.launch();

  const openReady = async () => {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "commit" });
    await page.waitForFunction("window.__bench || window.__ERROR__", {
      timeout: readyTimeout,
    });
    const err = await page.evaluate("window.__ERROR__");
    if (err) {
      await page.close();
      throw new Error(err);
    }
    return page;
  };

  try {
    const probe = await openReady();
    const labels = await probe.evaluate("window.__bench.labels");
    const adapters = await probe.evaluate("window.__bench.adapters");
    await probe.close();

    const rows = [];
    for (let i = 0; i < labels.length; i++) {
      if (onScenario) onScenario(labels[i], i, labels.length);
      let page;
      let timer;
      try {
        page = await openReady();
        const timeout = new Promise((_, rej) => {
          timer = setTimeout(
            () => rej(new Error("scenario timeout")),
            scenarioTimeout,
          );
        });
        rows.push(
          await Promise.race([
            page.evaluate(`window.__bench.run(${i})`),
            timeout,
          ]),
        );
      } catch (e) {
        process.stderr.write(
          `  [${labels[i]}] skipped: ${e.message.split("\n")[0]}\n`,
        );
        rows.push(null);
      } finally {
        clearTimeout(timer);
        if (page) await page.close().catch(() => {});
      }
    }
    return { adapters, labels, rows };
  } finally {
    await browser.close();
  }
}

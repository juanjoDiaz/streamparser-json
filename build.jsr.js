#!/usr/bin/env node

/*global process*/

import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const [, , src, dest] = process.argv; // '.' './dist/jsr'

const pkgInfo = JSON.parse(
  readFileSync(path.join(src, "package.json"), "utf8"),
);

// JSR/Deno resolve TypeScript source directly, so relative `.js` specifiers
// (the NodeNext convention) must be rewritten to point at the `.ts` files.
// Bare specifiers (e.g. `@streamparser/json`) are left untouched and resolved
// through the `imports` map generated in the jsr.json below.
function rewriteRelativeImports(code) {
  return code.replace(/from "(\.[.\\/-\w]+).js"/gm, 'from "$1.ts"');
}

const exportsMap = {};

function processDir(srcDir, destDir, relBase = "") {
  mkdirSync(destDir, { recursive: true });

  readdirSync(srcDir).forEach((name) => {
    const currentPath = path.join(srcDir, name);
    const destPath = path.join(destDir, name);
    const rel = relBase ? `${relBase}/${name}` : name;

    if (lstatSync(currentPath).isDirectory()) {
      processDir(currentPath, destPath, rel);
      return;
    }

    if (!name.endsWith(".ts")) return;

    writeFileSync(
      destPath,
      rewriteRelativeImports(readFileSync(currentPath, "utf8")),
    );

    // Mirror the npm `exports` map: `index` is the default entry and every
    // other module is exposed under its `.js` subpath (what consumers import).
    const noExt = rel.slice(0, -".ts".length);
    if (noExt === "index") {
      exportsMap["."] = "./index.ts";
    } else {
      exportsMap[`./${noExt}.js`] = `./${rel}`;
    }
  });
}

rmSync(dest, { recursive: true, force: true });
processDir(path.join(src, "src"), dest);

// Map every cross-package dependency to its JSR equivalent so the published
// package resolves siblings from JSR instead of expecting an npm install.
const imports = {};
for (const [dep, range] of Object.entries(pkgInfo.dependencies ?? {})) {
  imports[dep] = `jsr:${dep}@${range}`;
  imports[`${dep}/`] = `jsr:/${dep}@${range}/`;
}

const jsrConfig = {
  name: pkgInfo.name,
  version: pkgInfo.version,
  license: pkgInfo.license,
  exports: exportsMap,
  ...(Object.keys(imports).length > 0 ? { imports } : {}),
};

writeFileSync(
  path.join(dest, "jsr.json"),
  `${JSON.stringify(jsrConfig, null, 2)}\n`,
);

// The `jsr` CLI anchors `deno publish` at the nearest package.json, so drop a
// minimal one here to keep the publish rooted in this self-contained folder.
writeFileSync(
  path.join(dest, "package.json"),
  `${JSON.stringify(
    { name: pkgInfo.name, version: pkgInfo.version, type: "module" },
    null,
    2,
  )}\n`,
);

// Copy the README and LICENSE so the JSR package page renders them.
for (const file of ["README.md", "LICENSE"]) {
  writeFileSync(path.join(dest, file), readFileSync(path.join(src, file)));
}

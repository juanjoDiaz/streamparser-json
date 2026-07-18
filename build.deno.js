#!/usr/bin/env node

/*global process, URL*/

import path from "path";
import {
  mkdirSync,
  readdirSync,
  lstatSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "fs";

const pkgInfo = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

const denoXURL = `https://deno.land/x/streamparser_json@v${pkgInfo.version}`;

function copyReadme(src, dest) {
  writeFileSync(
    path.join(dest, "README.md"),
    readFileSync(path.join(src, "README.md"), "utf8")
      .replace(
        /from ['"]@streamparser\/json\/(.*)\.js['"]/gm,
        `from "${denoXURL}/$1.ts"`,
      )
      .replace(
        /from ['"]@streamparser\/json['"]/gm,
        `from "${denoXURL}/index.ts"`,
      ),
  );
}

function processDir(src, dest) {
  mkdirSync(dest, { recursive: true });

  readdirSync(src).forEach((name) => {
    const currentPath = path.join(src, name);
    const destPath = path.join(dest, name);
    const currentStats = lstatSync(currentPath);
    if (currentStats.isDirectory()) {
      processDir(currentPath, destPath);
      return;
    }

    writeFileSync(
      destPath,
      readFileSync(currentPath)
        .toString()
        .replace(/from "(\.[.\\/-\w]+).js"/gm, 'from "$1.ts"')
        .replace(/from "@streamparser\/json"/gm, `from "${denoXURL}/index.ts"`)
        .replace(
          /from "@streamparser\/json\/(.*).js"/gm,
          `from "${denoXURL}/$1.ts"`,
        ),
    );
  });
}

const [, , src, dest] = process.argv; // './src', './dist'
rmSync(dest, { recursive: true, force: true });
processDir(path.join(src, "src"), dest);
copyReadme(src, dest);

#!/usr/bin/env node

import path from "path";
import {
  mkdirSync,
  readdirSync,
  lstatSync,
  readFileSync,
  writeFileSync,
} from "fs";

function copyReadme(src, dest) {
  writeFileSync(
    path.join(dest, "README.md"),
    readFileSync("./README.md")
      .toString()
      .replace(
        /import \{ (.*) \} from '@streamparser\/json';/gm,
        'import { $1 } from "https://deno.land/x/streamparser_json@v0.0.10/index.ts";/'
      )
      .replace(
        /import { (.*) } from '@streamparser\/json\/(.*).js';/gm,
        'import { $1 } from "https://deno.land/x/streamparser_json@v0.0.10/$2.ts)";/'
      )
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
        .replace(
          /from "@streamparser\/json"/gm,
          'from "https://deno.land/x/streamparser_json@v0.0.10/index.ts"'
        )
        .replace(
          /from "@streamparser\/json\/(.*).js"/gm,
          'from "https://deno.land/x/streamparser_json@v0.0.10/$1.ts"'
        )
    );
  });
}

const [, , src, dest] = process.argv; // './src', './dist'
processDir(path.join(src, "src"), dest);
copyReadme(src, dest);

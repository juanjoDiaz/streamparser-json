#!/usr/bin/env node

const path = require("path");
const {
  readdirSync,
  lstatSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} = require("fs");

function processDir(src) {
  readdirSync(src)
    .filter((name) => !/.d.ts$/.test(name))
    .forEach((name) => {
      const currentPath = path.join(src, name);
      const currentStats = lstatSync(currentPath);
      if (currentStats.isDirectory()) {
        processDir(currentPath);
        return;
      }

      writeFileSync(
        currentPath.replace(/\.js$/, ".mjs"),
        readFileSync(currentPath).toString().replace(
          /from "(\.[.\\/-\w]+)"/gm,
          "from '$1.mjs'",
        ),
      );
      unlinkSync(currentPath);
    });
}

const src = process.argv[2]; // './dist'
processDir(src);

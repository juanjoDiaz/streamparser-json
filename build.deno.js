#!/usr/bin/env node

const path = require("path");
const {
  mkdirSync,
  readdirSync,
  lstatSync,
  readFileSync,
  writeFileSync,
} = require("fs");

function copyReadme(dest) {
  writeFileSync(
    path.join(dest, "README.md"),
    readFileSync("./README.md").toString()
      .replace(
        /import \{ JSONparser \} from '@streamparser\/json';/gm,
        "import JSONparser from 'https://deno.land/x/streamparser_json@v0.0.3/jsonparse.ts';/",
      )
      .replace(
        /import { Tokenizer } from '@streamparser\/json';/gm,
        "import Tokenizer from 'https://deno.land/x/streamparser_json@v0.0.3/tokenizer.ts';/",
      )
      .replace(
        /import { Parser } from '@streamparser\/json';/gm,
        "import Parser from 'https://deno.land/x/streamparser_json@v0.0.3/parser.ts';/",
      ),
  );
}

function processDir(src, dest) {
  mkdirSync(dest, { recursive: true });

  readdirSync(src)
    .forEach((name) => {
      const currentPath = path.join(src, name);
      const destPath = path.join(dest, name);
      const currentStats = lstatSync(currentPath);
      if (currentStats.isDirectory()) {
        processDir(currentPath, destPath);
        return;
      }

      writeFileSync(
        destPath,
        readFileSync(currentPath).toString().replace(
          /from "(\.[.\\/-\w]+)"/gm,
          "from '$1.ts'",
        ),
      );
    });
}

const src = process.argv[2]; // './src'
const dest = process.argv[3]; // './dist'
copyReadme(dest);
processDir(src, dest);

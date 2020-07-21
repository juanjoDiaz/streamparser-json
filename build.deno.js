#!/usr/bin/env node

const path = require('path');
const { mkdirSync, readdirSync, lstatSync, readFileSync, writeFileSync } = require('fs');

function processDir(src, dest) {
  mkdirSync(dest, { recursive: true });

  readdirSync(src)
    .forEach(name => {
      const currentPath = path.join(src, name);
      const destPath = path.join(dest, name);
      const currentStats = lstatSync(currentPath);
      if (currentStats.isDirectory()) {
        processDir(currentPath, destPath);
        return;
      }

      writeFileSync(
        destPath,
        readFileSync(currentPath).toString().replace(/from '(\.[.\\/-\w]+)'/gm, "from '$1.ts'"),
      );
    });
}

const src = process.argv[2]; // './src'
const dest = process.argv[3]; // './dist'
processDir(src, dest);

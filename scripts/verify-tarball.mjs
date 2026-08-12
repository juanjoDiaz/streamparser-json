#!/usr/bin/env node

/**
 * Packs each workspace package, installs the resulting tarballs into a
 * throwaway project (as a real npm consumer would), and requires/imports
 * each package's entrypoint. Guards against dist/ entrypoints going stale
 * or missing from a published tarball (npm pack does not run
 * prepublishOnly, only prepack/prepare, so a build step wired to the
 * wrong lifecycle hook silently ships a broken package).
 *
 * Also checks that every source map in the tarball can actually resolve its
 * sources, since we emit sourceMap/declarationMap without inlining sources:
 * the maps point at src/*.ts next to dist/, so dropping src/ from "files"
 * leaves consumer bundlers reporting ENOENT for every source map we ship.
 *
 * And checks that no build-only output ships. "files" allowlists dist/, but
 * dist/ also collects things npm consumers can never use: the incremental
 * build cache (tsc derives its path from outDir/rootDir, landing it in dist/
 * itself rather than the overridden dist/mjs or dist/cjs) and dist/jsr. Both
 * are excluded by negated patterns that match only the layout the build
 * happens to produce today, so verify the result instead of the pattern.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(entryPath);
    else yield entryPath;
  }
}

/**
 * dist/ holds outputs for more than one registry, so the npm tarball has to
 * carve out the parts npm consumers can't reach: the incremental build cache
 * and the JSR build (unreachable through "exports", published separately from
 * the working tree by the release workflow).
 */
const buildOnlyOutputs = [
  {
    label: "incremental build cache",
    matches: (p) => p.endsWith(".tsbuildinfo"),
  },
  { label: "JSR build", matches: (p) => p.split(path.sep).includes("jsr") },
];

function verifyNoBuildOnlyOutputs(packageRoot, name) {
  const leaked = [];
  for (const filePath of walk(packageRoot)) {
    const relativePath = path.relative(packageRoot, filePath);
    for (const { label, matches } of buildOnlyOutputs) {
      if (matches(relativePath)) leaked.push(`${relativePath} (${label})`);
    }
  }

  if (leaked.length > 0) {
    throw new Error(
      `${name}: build-only output leaked into the tarball:\n${leaked
        .map((entry) => `  ${entry}`)
        .join("\n")}`,
    );
  }

  console.log(`OK: ${name} ships no build-only output`);
}

/**
 * A source map entry is only usable if the source is either inlined in
 * sourcesContent or present on disk at the path the map points to.
 */
function verifySourceMaps(packageRoot, name) {
  const dangling = [];
  let sourceCount = 0;

  for (const filePath of walk(packageRoot)) {
    if (!filePath.endsWith(".map")) continue;
    const {
      sources = [],
      sourcesContent = [],
      sourceRoot = "",
    } = JSON.parse(readFileSync(filePath, "utf8"));

    sources.forEach((source, i) => {
      sourceCount += 1;
      if (typeof sourcesContent[i] === "string") return;
      const resolved = path.resolve(path.dirname(filePath), sourceRoot, source);
      if (!existsSync(resolved)) {
        dangling.push(`${path.relative(packageRoot, filePath)} -> ${source}`);
      }
    });
  }

  if (dangling.length > 0) {
    throw new Error(
      `${name}: ${dangling.length} source map source(s) missing from the tarball:\n${dangling
        .map((entry) => `  ${entry}`)
        .join("\n")}`,
    );
  }

  console.log(`OK: ${name} resolves all ${sourceCount} source map source(s)`);
}

const repoRoot = process.cwd();

const packages = [
  { dir: "packages/plainjs", name: "@streamparser/json" },
  { dir: "packages/node", name: "@streamparser/json-node" },
  { dir: "packages/whatwg", name: "@streamparser/json-whatwg" },
];

const packDestination = mkdtempSync(path.join(tmpdir(), "streamparser-pack-"));
const installDir = mkdtempSync(path.join(tmpdir(), "streamparser-install-"));

try {
  const tarballPaths = packages.map((pkg) => {
    const output = execFileSync(
      "npm",
      ["pack", "--pack-destination", packDestination, "--json"],
      { cwd: path.join(repoRoot, pkg.dir) },
    ).toString();
    const [{ filename }] = JSON.parse(output);
    return path.join(packDestination, filename);
  });

  writeFileSync(
    path.join(installDir, "package.json"),
    JSON.stringify(
      { name: "tarball-install-check", version: "0.0.0", private: true },
      null,
      2,
    ),
  );

  execFileSync("npm", ["install", "--no-audit", "--no-fund", ...tarballPaths], {
    cwd: installDir,
    stdio: "inherit",
  });

  for (const pkg of packages) {
    execFileSync("node", ["-e", `require('${pkg.name}');`], {
      cwd: installDir,
      stdio: "inherit",
    });
    execFileSync(
      "node",
      ["--input-type=module", "-e", `await import('${pkg.name}');`],
      { cwd: installDir, stdio: "inherit" },
    );
    console.log(
      `OK: ${pkg.name} requires and imports from an installed tarball`,
    );
    const installedRoot = path.join(
      installDir,
      "node_modules",
      ...pkg.name.split("/"),
    );
    verifySourceMaps(installedRoot, pkg.name);
    verifyNoBuildOnlyOutputs(installedRoot, pkg.name);
  }
} finally {
  rmSync(packDestination, { recursive: true, force: true });
  rmSync(installDir, { recursive: true, force: true });
}

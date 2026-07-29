#!/usr/bin/env node

/**
 * Packs each workspace package, installs the resulting tarballs into a
 * throwaway project (as a real npm consumer would), and requires/imports
 * each package's entrypoint. Guards against dist/ entrypoints going stale
 * or missing from a published tarball (npm pack does not run
 * prepublishOnly, only prepack/prepare, so a build step wired to the
 * wrong lifecycle hook silently ships a broken package).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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
  }
} finally {
  rmSync(packDestination, { recursive: true, force: true });
  rmSync(installDir, { recursive: true, force: true });
}

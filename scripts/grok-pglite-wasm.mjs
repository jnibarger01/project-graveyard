// Ship PGLite's WASM/data files into the Nitro server-function bundle so the
// no-DATABASE_URL PGLite fallback can run from the built output (serverless
// filesystems are read-only, so the files must be bundled, not written at
// runtime). Production uses Neon via an injected DATABASE_URL and never loads
// these, but shipping them keeps the built output self-contained.
//
// Idempotent + safe: resolves the `__server.func/_libs` dir dynamically; no-op
// when the build output is absent or the package isn't installed.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const files = ["pglite.wasm", "pglite.data", "initdb.wasm"];

function findLibsDir(base) {
  if (!existsSync(base)) return null;
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const child = join(base, entry.name);
      if (entry.name === "_libs") return child;
      const nested = findLibsDir(child);
      if (nested) return nested;
    }
  }
  return null;
}

const outputRoot = join(root, ".vercel/output/functions");
const libsDir = findLibsDir(outputRoot);
if (!libsDir) {
  console.log("[pglite-wasm] build output not found — skipping");
  process.exit(0);
}
if (!existsSync(srcDir)) {
  console.log("[pglite-wasm] pglite package not found — skipping");
  process.exit(0);
}

mkdirSync(libsDir, { recursive: true });
for (const file of files) {
  const from = join(srcDir, file);
  const to = join(libsDir, file);
  if (existsSync(from)) {
    copyFileSync(from, to);
    console.log(`[pglite-wasm] shipped ${file} -> ${dirname(to)}`);
  } else {
    console.log(`[pglite-wasm] missing ${file} — skipping`);
  }
}
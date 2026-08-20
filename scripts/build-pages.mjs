import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";
import config from "../vite.pages.config.ts";

const output = resolve("dist-pages");
await rm(output, { recursive: true, force: true });
await build({ ...config, configFile: false });
// The named input keeps the Pages entry isolated from the production app.
// Normalize the emitted filename for GitHub Pages' conventional root document.
await cp(resolve(output, "pages.html"), resolve(output, "index.html"));
await cp(resolve(output, "index.html"), resolve(output, "404.html"));
await mkdir(output, { recursive: true });
console.log("Static GitHub Pages artifact written to dist-pages/ (with 404.html fallback).");

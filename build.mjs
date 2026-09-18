
import * as esbuild from "esbuild";
import { cp, mkdir, rm, readdir, copyFile } from "node:fs/promises";
import path from "node:path";

const outdir = "dist";
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await cp("static", outdir, { recursive: true });

const common = {
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ["chrome120"],
  platform: "browser",
  format: "esm",
  external: ["node:module", "node:fs", "fs", "module"],
};

await esbuild.build({
  ...common,
  entryPoints: ["src/background.js"],
  outfile: `${outdir}/background.js`,
});

await esbuild.build({
  ...common,
  entryPoints: ["src/offscreen.js"],
  outfile: `${outdir}/offscreen.js`,
});

await esbuild.build({
  ...common,
  entryPoints: ["src/evaluator.js"],
  outfile: `${outdir}/evaluator.js`,
});

await esbuild.build({
  ...common,
  entryPoints: ["src/popup.js"],
  outfile: `${outdir}/popup.js`,
});

await esbuild.build({
  ...common,
  format: "iife",
  entryPoints: ["src/content.js"],
  outfile: `${outdir}/content.js`,
});

// Copy the ONNX Runtime WASM/MJS files locally.
// Transformers.js/ORT must not execute code from a CDN in Manifest V3.
const vendor = path.join(outdir, "vendor");
await mkdir(vendor, { recursive: true });

const ortDist = "node_modules/onnxruntime-web/dist";
const files = await readdir(ortDist);
const wanted = files.filter((name) =>
  /^ort-wasm-simd-threaded(\.jsep)?\.(wasm|mjs)$/.test(name) ||
  /^ort-wasm-simd-threaded\.(wasm|mjs)$/.test(name)
);
for (const name of wanted) {
  await copyFile(path.join(ortDist, name), path.join(vendor, name));
}

console.log("Built extension in dist/");
console.log("Load dist/ with chrome://extensions -> Developer mode -> Load unpacked");

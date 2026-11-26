import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
const worker = await readFile(new URL("../public/service-worker.js", import.meta.url), "utf8");

test("FileKit exposes install and use actions", () => {
  assert.match(html, /id="installApp"/);
  assert.match(html, /id="useApp"/);
  assert.match(html, /beforeinstallprompt/);
  assert.match(html, /appinstalled/);
  assert.match(html, /Install app or Add to Home Screen/);
});

test("overview tool tiles support mouse and keyboard activation", () => {
  assert.match(html, /tile\.addEventListener\('click',open\)/);
  assert.match(html, /tile\.addEventListener\('keydown'/);
});

test("production app bundles its processing libraries locally", () => {
  for (const dependency of ["pdf-lib", "pdfjs-dist", "xlsx", "jszip", "mammoth"]) {
    assert.ok(html.includes(`from "${dependency}"`), `missing local bundle import: ${dependency}`);
  }
  assert.match(html, /pdfjs\.GlobalWorkerOptions\.workerSrc/);
});

test("PWA manifest and service worker include install shell assets", () => {
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some(icon => icon.src === "./icons/filekit.svg"));
  assert.match(worker, /filekit-static-v3/);
  assert.match(worker, /\.\/manifest\.webmanifest/);
  assert.match(worker, /\.\/icons\/filekit\.svg/);
});

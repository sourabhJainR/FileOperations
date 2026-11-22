import test from "node:test";
import assert from "node:assert/strict";
import { validateFiles, safeOutputName, safeArchivePath, createTaskRunner, FileKitError, assertWithinResourceLimit } from "../core.js";
import { exportWorkbook, compareWorkbooks } from "../spreadsheet.js";
const file = (name, size = 10) => ({ name, size });
test("file limits reject oversize batches and empty selection", () => {
  assert.throws(() => validateFiles([]), e => e.code === "NO_FILES");
  assert.throws(() => validateFiles([file("big", 20)], { maxFiles: 2, maxFileBytes: 10, maxBatchBytes: 20 }), e => e.code === "FILE_TOO_LARGE");
  assert.equal(validateFiles([file("a", 2), file("b", 3)], { maxFiles: 2, maxFileBytes: 5, maxBatchBytes: 5 }).totalBytes, 5);
});
test("output names and archive paths are sanitized", () => {
  assert.equal(safeOutputName("../a:b?.txt"), "_a_b_.txt");
  assert.throws(() => safeArchivePath("../../escape.txt"), e => e.code === "UNSAFE_ARCHIVE_PATH");
  assert.equal(safeArchivePath("folder/report.txt"), "folder/report.txt");
});
test("task runner reports progress and isolates per-file errors", async () => {
  const progress = [], runner = createTaskRunner({ onProgress: p => progress.push(p) });
  const result = await runner.run([1, 2, 3], async n => { if (n === 2) throw Error("bad input"); return n * 2; });
  assert.deepEqual(result.results, [2, undefined, 6]); assert.equal(result.errors.length, 1);
  assert.equal(progress.at(-1).percent, 100);
});
test("task runner supports cancellation", async () => {
  const runner = createTaskRunner(); runner.abort();
  await assert.rejects(() => runner.run([1], async n => n), e => e.code === "CANCELLED");
});
test("pixel budget rejects excessive allocations", () => {
  assert.throws(() => assertWithinResourceLimit({ width: 10000, height: 10000 }), e => e.code === "PIXEL_LIMIT");
});
const XLSX = { utils: { sheet_to_csv: s => s.csv, sheet_to_json: s => s.rows, sheet_to_html: s => s.html } };
test("spreadsheet export includes every sheet", () => {
  const wb = { SheetNames: ["One", "Two"], Sheets: { One: { csv: "a", rows: [], html: "<table/>" }, Two: { csv: "b", rows: [], html: "<table/>" } } };
  assert.deepEqual(exportWorkbook(wb, XLSX).map(x => x.sheet), ["One", "Two"]);
});
test("spreadsheet compare checks all sheets and missing sheets", () => {
  const a = { SheetNames: ["One", "Two"], Sheets: { One: { rows: [[1]] }, Two: { rows: [[2]] } } };
  const b = { SheetNames: ["One", "Three"], Sheets: { One: { rows: [[1]] }, Three: { rows: [[3]] } } };
  const result = compareWorkbooks(a, b, XLSX);
  assert.equal(result.find(x => x.sheet === "One").status, "equal");
  assert.equal(result.find(x => x.sheet === "Two").status, "missing");
});

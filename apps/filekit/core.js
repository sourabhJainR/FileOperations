/** FileKit execution and file-safety primitives. No network or server access. */
export const DEFAULT_LIMITS = Object.freeze({ maxFiles: 100, maxFileBytes: 100 * 1024 * 1024, maxBatchBytes: 500 * 1024 * 1024, maxPages: 500, maxPixels: 80_000_000, maxZipEntries: 2_000, maxZipExpandedBytes: 500 * 1024 * 1024 });
export class FileKitError extends Error { constructor(code, message, details = {}) { super(message); this.name = "FileKitError"; this.code = code; this.details = details; } }
export function validateFiles(files, limits = DEFAULT_LIMITS) {
  if (!Array.isArray(files) || files.length === 0) throw new FileKitError("NO_FILES", "Select at least one file.");
  if (files.length > limits.maxFiles) throw new FileKitError("TOO_MANY_FILES", `Select no more than ${limits.maxFiles} files.`);
  let total = 0;
  for (const file of files) {
    if (!file || typeof file.size !== "number" || typeof file.name !== "string") throw new FileKitError("INVALID_FILE", "A selected item is not a valid file.");
    if (file.size > limits.maxFileBytes) throw new FileKitError("FILE_TOO_LARGE", `${file.name} exceeds the per-file size limit.`, { name: file.name, size: file.size });
    total += file.size;
  }
  if (total > limits.maxBatchBytes) throw new FileKitError("BATCH_TOO_LARGE", "The selected files exceed the total batch size limit.", { total });
  return { count: files.length, totalBytes: total };
}
export function safeOutputName(name, fallback = "output") {
  const clean = String(name || "").normalize("NFKC").replace(/[\\/\\0-\\r\\n<>:"|?*]/g, "_").replace(/^\.+/, "").trim();
  return (clean || fallback).slice(0, 180);
}
export function safeArchivePath(path) {
  const raw = String(path || "").replace(/\\/g, "/");
  if (!raw || raw.startsWith("/") || /^[a-zA-Z]:/.test(raw) || raw.split("/").some(p => p === ".." || p === ".")) {
    throw new FileKitError("UNSAFE_ARCHIVE_PATH", "Archive contains an unsafe path.", { path });
  }
  return raw.split("/").filter(Boolean).map(p => safeOutputName(p)).join("/");
}
export function createTaskRunner({ onProgress = () => {}, signal } = {}) {
  const controller = new AbortController();
  if (signal) signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  const abort = reason => controller.abort(reason || "Cancelled by user");
  const check = () => { if (controller.signal.aborted) throw new FileKitError("CANCELLED", "Processing was cancelled."); };
  async function run(items, worker, { concurrency = 1 } = {}) {
    if (!Array.isArray(items)) throw new FileKitError("INVALID_BATCH", "Batch input must be a list.");
    const results = new Array(items.length), errors = [];
    let next = 0, completed = 0;
    const total = items.length;
    const execute = async () => {
      while (true) {
        check();
        const index = next++;
        if (index >= total) return;
        try { results[index] = await worker(items[index], { index, signal: controller.signal, check }); }
        catch (error) {
          const normalized = normalizeError(error, items[index]?.name);
          errors.push({ index, name: items[index]?.name, error: normalized });
        } finally {
          completed++;
          onProgress({ completed, total, percent: total ? Math.round(completed * 100 / total) : 100, current: items[index]?.name || String(index + 1), errors: errors.length, cancelled: controller.signal.aborted });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(8, concurrency, total || 1)) }, execute));
    check();
    return { results, errors, completed, total, ok: errors.length === 0 };
  }
  return { run, abort, signal: controller.signal };
}
export function normalizeError(error, fileName) {
  if (error instanceof FileKitError) return { code: error.code, message: error.message, details: error.details };
  if (error?.name === "AbortError") return { code: "CANCELLED", message: "Processing was cancelled." };
  return { code: "PROCESSING_FAILED", message: error?.message || "The file could not be processed.", fileName };
}
export function assertWithinResourceLimit({ width, height, maxPixels = DEFAULT_LIMITS.maxPixels }) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > maxPixels)
    throw new FileKitError("PIXEL_LIMIT", "The requested image/page render exceeds the pixel limit.", { width, height, maxPixels });
}

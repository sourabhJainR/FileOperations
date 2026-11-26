import { FileKitError } from "./core.js";

export function runQpdf(operation, file, options = {}) {
  if (typeof Worker === "undefined") {
    return Promise.reject(new FileKitError(
      "PDF_ENGINE_UNAVAILABLE",
      "PDF security requires a browser with Web Worker support.",
    ));
  }
  if (!(file instanceof Blob)) {
    return Promise.reject(new FileKitError(
      "PDF_INPUT_INVALID",
      "PDF security requires a File or Blob input.",
    ));
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pdf-qpdf-worker.js", import.meta.url), { type: "module" });
    const id = crypto.randomUUID();
    let settled = false;
    const timer = setTimeout(
      () => finish(reject, new FileKitError(
        "PDF_ENGINE_TIMEOUT",
        "The local PDF security engine did not finish in time.",
      )),
      120000,
    );
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      callback(value);
    };

    worker.onmessage = (event) => {
      const data = event.data;
      if (data.id !== id) return;
      if (data.type === "progress") options.onProgress?.(data.message);
      else if (data.type === "complete") finish(resolve, new Uint8Array(data.bytes));
      else if (data.type === "error") {
        finish(reject, new FileKitError(
          operation === "unlock" ? "PDF_PASSWORD_INVALID" : "PDF_SECURITY_FAILED",
          data.message,
        ));
      }
    };
    worker.onerror = (event) => finish(
      reject,
      new FileKitError("PDF_ENGINE_FAILED", event.message || "PDF security worker failed."),
    );

    // File/Blob is structured-cloned without copying the full PDF into the
    // worker's JS heap. The worker mounts it read-only through WORKERFS.
    worker.postMessage({ id, operation, file, options: { ...options, onProgress: undefined } });
  });
}

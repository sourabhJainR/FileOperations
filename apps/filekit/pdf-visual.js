import { assertWithinResourceLimit, DEFAULT_LIMITS, FileKitError } from "./core.js";
/** Render and compare PDF pages. Requires PDF.js; comparison is visual, not semantic. */
export async function renderPdfPage(pdf, pageNumber, { scale = 1.25, maxPixels = DEFAULT_LIMITS.maxPixels, signal } = {}) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.numPages) throw new FileKitError("INVALID_PAGE", "PDF page number is out of range.");
  if (signal?.aborted) throw new FileKitError("CANCELLED", "Processing was cancelled.");
  const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale });
  assertWithinResourceLimit({ width: Math.ceil(viewport.width), height: Math.ceil(viewport.height), maxPixels });
  const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  try {
    await page.render({ canvasContext: canvas.getContext("2d", { willReadFrequently: true }), viewport, signal }).promise;
    if (signal?.aborted) throw new FileKitError("CANCELLED", "Processing was cancelled.");
    return canvas;
  } catch (error) { canvas.width = canvas.height = 0; throw error; }
}
export async function comparePdfVisual(left, right, { scale = 1.25, threshold = 24, maxPages = DEFAULT_LIMITS.maxPages, signal, onProgress = () => {} } = {}) {
  const pages = Math.max(left.numPages, right.numPages);
  if (pages > maxPages) throw new FileKitError("PAGE_LIMIT", "PDF comparison exceeds the page limit.", { pages, maxPages });
  const results = [];
  for (let page = 1; page <= pages; page++) {
    if (signal?.aborted) throw new FileKitError("CANCELLED", "Processing was cancelled.");
    if (page > left.numPages || page > right.numPages) { results.push({ page, status: "missing-page", left: page <= left.numPages, right: page <= right.numPages }); continue; }
    const [a, b] = await Promise.all([renderPdfPage(left, page, { scale, signal }), renderPdfPage(right, page, { scale, signal })]);
    const sameSize = a.width === b.width && a.height === b.height;
    if (!sameSize) results.push({ page, status: "different-size", left: [a.width, a.height], right: [b.width, b.height] });
    else {
      const x = a.getContext("2d").getImageData(0, 0, a.width, a.height).data;
      const y = b.getContext("2d").getImageData(0, 0, b.width, b.height).data;
      const diff = a.getContext("2d").createImageData(a.width, a.height); let changed = 0, total = 0;
      for (let i = 0; i < x.length; i += 4) {
        const delta = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i+1] - y[i+1]), Math.abs(x[i+2] - y[i+2]));
        if (delta > threshold) { changed++; diff.data[i] = 255; diff.data[i+1] = 0; diff.data[i+2] = 0; diff.data[i+3] = 210; }
        else { diff.data[i] = x[i]; diff.data[i+1] = x[i+1]; diff.data[i+2] = x[i+2]; diff.data[i+3] = 255; }
        total += delta;
      }
      a.getContext("2d").putImageData(diff, 0, 0);
      results.push({ page, status: changed ? "different" : "equal", changedPixels: changed, totalPixels: a.width * a.height, changedPercent: changed / (a.width * a.height) * 100, meanChannelDelta: total / (a.width * a.height * 3), diffCanvas: a });
    }
    b.width = b.height = 0; onProgress({ page, total: pages, percent: Math.round(page * 100 / pages) });
  }
  return results;
}

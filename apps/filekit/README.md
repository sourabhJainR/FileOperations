# FileKit

FileKit is a local-first browser file utility. The production build bundles processing libraries into static assets; no application server or file-upload backend is required.

## Install and use

Serve the built app from HTTPS (or localhost). Open FileKit, choose an operation from the Overview tiles or left navigation, add files, review the operation's fidelity warning, and select Process. Use the header's **Install FileKit** button when the browser exposes an install prompt. If it does not, use the browser menu (Install app / Add to Home Screen); iOS uses Share → Add to Home Screen.

The PWA shell is cached after the first successful visit. First visit, dependency installation and build need network access. Browser storage can be evicted. This is not an air-gapped first-run installer.

## Development and build

Requires Node.js 20 or newer.

```sh
npm install
npm test
npm run build
npm run test:browser
npm run serve
```

## Processing foundations

- Bounded batch runner, progress callbacks, cancellation signals and per-file error isolation.
- File count, per-file byte, batch byte, page count and pixel budgets.
- Sanitized output names and archive path validation helpers.
- Multi-sheet spreadsheet export and comparison APIs.
- PDF page rendering and pixel-difference comparison APIs.
- Local npm dependencies, Vite build, web app manifest and service-worker shell caching.

## Advanced workflows

- ZIP extraction checks every entry path, rejects traversal and absolute paths, validates entry count, per-entry size and total expanded size before adding bytes to the output archive. Extraction is in-memory; limits are enforced before output generation.
- Spreadsheet export processes every worksheet. Workbook comparison reports missing sheets and cell-level differences.
- PDF visual comparison renders pages and reports per-page status, changed-pixel percentage and a red difference preview. It is a raster comparison, not a semantic or signature check.
- PDF page reorder requires a complete, unique page permutation. Watermarking and metadata read/update are available.
- Batch archive and spreadsheet tasks report progress and isolate per-file failures. Cancellation is cooperative between file operations; browser APIs that do not support abort cannot be interrupted mid-call.
- OCR uses Tesseract.js with English language data. The first OCR run downloads worker/language resources from the Tesseract CDN; image files remain local, but OCR is not available on a fully offline first run. Metadata updates accept a JSON object with title, author, subject, keywords, creator and producer fields.
- Browser regression tests use Playwright/Chromium and check the advanced UI and service-worker offline shell after initial registration.

## Current UI coverage and known gaps

Legacy single-operation handlers remain for the original tools. The advanced panel is the supported entry point for the newly integrated workflows. Resource budgets are not yet applied to every legacy conversion path. Archive extraction is memory-bound by configured limits but is not streaming-to-disk; very large archives should be split. Browser-level coverage is focused on core user journeys, not every file-format edge case.

The current spreadsheet UI exports and compares the first sheet only. PDF comparison in the legacy UI is text extraction, not the new visual comparison API. Image operations do not promise metadata, animation or color-profile preservation. DOCX support extracts text only. There is no OCR, redaction, digital signature, macro execution or server-side conversion.

## Fidelity and privacy

PDF raster compression is lossy and removes selectable text/vector content. PDF pixel comparison depends on render scale and threshold; it does not prove semantic equivalence or compare signatures/metadata. Browser memory can exceed source file size by several times during decoding. Tune limits with target-device testing.

Files are processed locally in the browser and are not uploaded to a FileKit processing backend. Browser extensions, compromised devices and downloaded outputs remain outside this privacy boundary.

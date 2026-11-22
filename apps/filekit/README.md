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
- Multi-sheet spreadsheet export and comparison APIs, plus multi-workbook consolidation into one workbook.
- PDF page rendering, pixel-difference comparison, merge, image/document creation and editable DOCX export APIs.
- Local npm dependencies, Vite build, web app manifest and service-worker shell caching.

## Advanced workflows

- ZIP extraction checks every entry path, rejects traversal and absolute paths, validates entry count, per-entry size and total expanded size. Recursive nested ZIP extraction shares depth, entry-count and expanded-byte budgets across the full tree. Nested archive processing can feed extracted images, PDFs, Excel files or OCR images directly into a selected operation. Extraction is in-memory; limits are enforced before output generation.
- Spreadsheet export processes every worksheet. Workbook comparison reports missing sheets and cell-level differences. Workbook consolidation imports all sheets from multiple XLSX, XLS, XLSM and CSV files into one output workbook; source workbook names are prefixed to avoid collisions.
- PDF visual comparison renders pages and reports per-page status, changed-pixel percentage and a red difference preview. It is a raster comparison, not a semantic or signature check.
- PDF merge combines pages from multiple source files. Image-to-PDF creates a page per image; PDF-to-images renders each PDF page to PNG files in a ZIP. Mixed image and document inputs can be assembled in selected order. Document-to-PDF supports DOCX text extraction, TXT, Markdown, CSV, HTML and RTF text; it does not preserve original document styling. PDF-to-DOCX extracts selectable text into editable Word paragraphs; it does not preserve exact layout, fonts, images, tables or scanned text. OCR is separate for image-based documents. PDF page reorder requires a complete, unique page permutation. Watermarking and metadata read/update are available.
- PDF password protection and unlocking use qpdf 12.4.2 compiled to WebAssembly and run in a dedicated browser worker. Locking requires an open password (minimum 8 characters), supports a separate owner password, and lets users choose printing, copying, editing, annotation, form-filling and page-assembly permissions. Unlocking requires the current open or owner password; incorrect passwords fail closed. Permission flags are advisory and may not be enforced by every PDF reader. Accessibility extraction remains allowed under the PDF standard.
- PDF page numbering supports `{page}` and `{pages}` placeholders. Form flattening makes interactive fields non-editable and requires confirmation.
- Batch archive and spreadsheet tasks report progress and isolate per-file failures. Cancellation is cooperative between file operations; browser APIs that do not support abort cannot be interrupted mid-call.
- OCR uses Tesseract.js with English language data. The first OCR run downloads worker/language resources from the Tesseract CDN; image files remain local, but OCR is not available on a fully offline first run. Metadata updates accept a JSON object with title, author, subject, keywords, creator and producer fields.
- Browser regression tests use Playwright/Chromium and check the advanced UI and service-worker offline shell after initial registration.

## Current UI coverage and known gaps

Legacy single-operation handlers remain for the original tools. The advanced panel is the supported entry point for the newly integrated workflows. Resource budgets are not yet applied to every legacy conversion path. Archive extraction is memory-bound by configured limits but is not streaming-to-disk; very large archives should be split. Browser-level coverage is focused on core user journeys, not every file-format edge case.

The current legacy spreadsheet UI exports and compares the first sheet only; use the Advanced tools panel for multi-sheet workflows and workbook consolidation. PDF comparison in the legacy UI is text extraction, not the new visual comparison API. Image operations do not promise metadata, animation or color-profile preservation. DOCX support extracts text only. There is no redaction, digital signature, macro execution or server-side conversion. PDF-to-DOCX is text-first and should be reviewed before use where page fidelity matters. Image conversion uses the browser's first decoded frame for animated formats.

## Document composition and archive workflows\n\nThe Advanced tools panel can combine image files into one PDF, convert supported text/document files into a text-first PDF, merge multiple PDFs, and export selectable PDF text to an editable DOCX. Image and document files can be mixed in one PDF composition run and retain their selected order. Workbook consolidation creates one worksheet per source worksheet and prefixes names with the source filename. Recursive ZIP processing extracts nested archives in memory and applies a selected operation to the leaf files. The recursive extractor enforces a maximum nesting depth of 5, 2,000 total entries and 500 MB total expanded data by default; each entry is limited to 100 MB. The UI's normal file-count and batch-size limits also apply to extracted files.\n\n## PDF security implementation

AES-256 encryption and authenticated decryption run locally through qpdf WebAssembly. The worker keeps CPU-heavy processing off the main UI thread. A wrong password or unsupported encryption is reported as a failure; FileKit does not bypass passwords. PDF permission flags are reader-enforced hints, not DRM.

## Release status\n\nThe PDF security, document composition, workbook consolidation and nested ZIP workflows are implemented and have passed the current Node, production-build and Chromium regression gates. They are in [PR #5](https://github.com/sourabhJainR/FileOperations/pull/5) awaiting merge. They are not part of a published release until PR #5 is merged and a tagged release is created.\n\n## Fidelity and privacy

PDF raster compression is lossy and removes selectable text/vector content. PDF pixel comparison depends on render scale and threshold; it does not prove semantic equivalence or compare signatures/metadata. Browser memory can exceed source file size by several times during decoding. Tune limits with target-device testing.

Files are processed locally in the browser and are not uploaded to a FileKit processing backend. Browser extensions, compromised devices and downloaded outputs remain outside this privacy boundary.

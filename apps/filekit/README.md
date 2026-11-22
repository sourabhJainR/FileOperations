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
npm run serve
```

## Processing foundations

- Bounded batch runner, progress callbacks, cancellation signals and per-file error isolation.
- File count, per-file byte, batch byte, page count and pixel budgets.
- Sanitized output names and archive path validation helpers.
- Multi-sheet spreadsheet export and comparison APIs.
- PDF page rendering and pixel-difference comparison APIs.
- Local npm dependencies, Vite build, web app manifest and service-worker shell caching.

## Current UI coverage and known gaps

The existing UI still has legacy single-operation handlers. Multi-sheet workbook APIs and PDF visual comparison are not yet fully connected to the user interface. Batch progress/cancellation and resource budgets are not enforced in every operation. ZIP extraction must reject unsafe paths and enforce entry/expanded-byte limits before writing each entry. Do not use archive extraction with untrusted input until this is complete.

The current spreadsheet UI exports and compares the first sheet only. PDF comparison in the legacy UI is text extraction, not the new visual comparison API. Image operations do not promise metadata, animation or color-profile preservation. DOCX support extracts text only. There is no OCR, redaction, digital signature, macro execution or server-side conversion.

## Fidelity and privacy

PDF raster compression is lossy and removes selectable text/vector content. PDF pixel comparison depends on render scale and threshold; it does not prove semantic equivalence or compare signatures/metadata. Browser memory can exceed source file size by several times during decoding. Tune limits with target-device testing.

Files are processed locally in the browser and are not uploaded to a FileKit processing backend. Browser extensions, compromised devices and downloaded outputs remain outside this privacy boundary.

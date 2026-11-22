# FileKit

FileKit is a local-first browser file utility. The production build bundles its processing libraries into static assets; no application server or file-upload backend is required.

## Development and build

Requires Node.js 20 or newer.

```sh
cd apps/filekit
npm install
npm test
npm run build
npm run serve
```

Deploy the contents of `dist/` to a static HTTPS host. The service worker caches the application shell and same-origin build assets after the first successful visit. The first visit and initial dependency installation/build require network access. Do not describe first-use as offline. For a fully air-gapped deployment, distribute the built `dist/` directory internally and verify it in the target browser.

## Processing foundations added

- Batch runner with bounded concurrency (1–8), per-file failure isolation, progress callbacks and AbortSignal cancellation.
- File count, per-file byte, total batch byte, page count and rendered-pixel budgets.
- Structured error codes and sanitized output/archive path helpers. ZIP extraction must reject traversal paths before writing entries.
- Multi-sheet spreadsheet export to CSV, JSON or HTML, and sheet-by-sheet comparison including missing sheets and cell coordinates.
- PDF visual comparison by rendering corresponding pages with PDF.js, calculating changed-pixel percentages and producing a red difference overlay. It reports missing pages and differing render dimensions. It is a raster comparison, not a guarantee of semantic equivalence.
- Local npm dependencies and Vite build replace runtime CDN dependencies. A service worker caches same-origin production assets after first load.

## Current limitations and safety

The existing UI still contains legacy single-operation handlers. The new batch runner, multi-sheet APIs and PDF visual comparison modules are foundations and are not yet wired into every UI workflow. Cancellation is cooperative; operations must pass the provided AbortSignal and check it between expensive steps. ZIP traversal validation must be applied to every archive entry before extraction. Do not process untrusted archives until that integration is complete.

Resource limits in `core.js` are defaults and should be tuned using supported-device testing. Browser memory can exceed file size by several times during PDF/image decoding. Encrypted PDFs, malformed Office files, macros, embedded objects, digital signatures and conversion fidelity require separate validation. No OCR is provided. PDF raster comparison depends on render scale and threshold; it does not compare hidden metadata, text semantics, signatures or vector structure.

## Automated tests

`npm test` runs Node's built-in regression suite for file limits, path sanitization, batch progress/error isolation/cancellation, pixel budgets and multi-sheet spreadsheet behavior. PDF canvas rendering needs browser-level tests and representative fixtures; it is not covered by the Node suite.

## Privacy

File content is processed locally in the browser. The app does not upload selected files to a FileKit backend. A static host serves the application assets. Treat browser extensions, compromised devices and downloaded outputs as outside this application's privacy boundary.

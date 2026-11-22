# FileOperations

FileOperations hosts FileKit, a browser-based file utility suite. Selected files are processed on the user's device; the application does not require a FileKit file-upload backend.

## Quick start

1. Open the hosted FileKit app over HTTPS.
2. Choose a tool or select a tool tile from Overview.
3. Add files by browsing or drag and drop.
4. Review the operation and its fidelity notes before processing.
5. Download the generated result and verify it before using it in a critical workflow.

Use **Install FileKit** in the app header when the browser offers installation. On supported desktop browsers, accept the install prompt. On iPhone/iPad, use Share → Add to Home Screen. If installation is unavailable, FileKit remains usable in the browser. Installation and offline support require a secure HTTPS deployment (localhost is suitable for development).

## Current capabilities

| Area | Available operations | Important limits |
|---|---|---|
| PDF | Merge, split/extract pages, rotate, raster-based compression, text extraction, page images, text comparison | No OCR; raster compression loses selectable text and vector content; visual comparison is not semantic comparison |
| Images | Resize, format conversion, images to PDF, side-by-side comparison and pixel difference | Browser codecs determine format support; animation and metadata preservation are not guaranteed |
| Spreadsheets | CSV/XLSX import, CSV/JSON/HTML export, workbook sheet listing and comparison foundations | UI currently exposes first-sheet operations; formula recalculation, macros and formatting fidelity are not guaranteed |
| Documents | DOCX text extraction | Not a full DOCX-to-PDF or DOCX-to-ODT layout-preserving converter |
| Archives | ZIP creation and extraction foundations | Do not process untrusted archives until path traversal, entry-count and expanded-size limits are enforced in the UI flow |
| General | File information, drag/drop, local processing | Batch progress, cancellation and all resource limits are not yet integrated into every legacy operation |

See [FileKit implementation notes](apps/filekit/README.md) for build, privacy and fidelity details.

## Install and offline use

FileKit is a Progressive Web App shell. On supported browsers, install it from the in-app **Install FileKit** action or the browser's install menu. The app must be served from HTTPS (or localhost). The service worker caches the app shell after a successful first visit; this is not an air-gapped first-run installer. Browser storage can be cleared or evicted by the browser, so do not treat cached files as permanent.

## Releases

There is no production release published yet. The merged foundation PR is not a release declaration. Use the [GitHub Releases page](https://github.com/sourabhJainR/FileOperations/releases) for tagged, validated versions.

### Release readiness checklist

- [ ] Version and release notes updated
- [ ] CI tests and production build pass on the exact release commit
- [ ] Browser smoke tests pass on Chromium, Firefox and WebKit
- [ ] Representative PDF, image, XLSX, DOCX and ZIP fixtures pass
- [ ] ZIP traversal and decompression-bomb protections verified
- [ ] Batch progress, cancellation and resource limits verified
- [ ] Install prompt and offline reload tested on HTTPS
- [ ] Privacy, accessibility and dependency review completed
- [ ] Known fidelity limitations documented

## Comparison with common file tools

This is a capability-positioning review, not a claim that FileKit has been benchmarked against the hosted services or desktop applications. Feature sets and plan limits change; re-check vendors before making procurement decisions.

| Tool | Typical strength | FileKit position | Gap to close |
|---|---|---|---|
| Adobe Acrobat | PDF editing, OCR, forms, signatures and enterprise workflows | Local PDF merge/split/rotate/text and visual comparison foundations | OCR, editing, forms, signatures, redaction, accessibility and document QA |
| Smallpdf / iLovePDF | Fast guided PDF conversion and common PDF workflows | Local-first PDF basics and comparison | More conversion formats, OCR, compression quality controls, batch UX and polished previews |
| PDF24 | Broad PDF utilities, including desktop/offline options | Browser-local utility direction | Comparable breadth, robust offline packaging and PDF metadata/security tools |
| CloudConvert | Large format-conversion catalogue and configurable jobs | A smaller set of local browser conversions | Format coverage, conversion profiles, queues and fidelity test corpus |
| 7-Zip | Reliable archive handling and broad archive formats | ZIP create/extract foundation | More archive formats, streaming, safe extraction and large-archive tests |
| LibreOffice | Rich office document and spreadsheet editing/conversion | Spreadsheet data export/comparison and DOCX text extraction | Layout-preserving Office conversion, formulas, charts, styles and round-trip tests |
| ImageMagick | Advanced image conversion and manipulation | Common browser image resize/convert/compare | Advanced formats, color profiles, metadata, animation and batch pipelines |

### Product priorities

1. **Trust and safety:** enforce ZIP path validation and decompressed-size/entry limits before extraction; add MIME/signature checks, safe filenames, cancellation and bounded memory use.
2. **Core parity:** multi-sheet XLSX export and comparison in the UI; PDF visual compare UI; batch queue with progress, retry and cancel.
3. **High-value additions:** OCR for scanned PDFs, PDF page reorder/delete, watermark, metadata inspection/removal, image crop/rotate, CSV/XLSX merge, and DOCX-to-PDF through an optional local conversion engine.
4. **Quality:** browser regression tests, golden fixtures, conversion-fidelity reports, accessibility checks and dependency vulnerability scanning.
5. **Differentiation:** privacy-first local processing, no account requirement, transparent fidelity warnings, repeatable batch jobs and offline-capable deployment.

## Development

Requires Node.js 20 or newer.

```sh
cd apps/filekit
npm install
npm test
npm run build
npm run serve
```

Deploy the contents of `apps/filekit/dist/` to a static HTTPS host. For local development, Vite serves the app on localhost.

## Privacy

File content is processed in the browser. The static host serves application assets; selected files are not sent to a FileKit processing backend. This is not a security certification. Browser extensions, compromised devices, browser storage and downloaded outputs remain outside the application's privacy boundary.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FileKitError, DEFAULT_LIMITS } from "./core.js";
import { runQpdf } from "./pdf-qpdf.js";

const MIN_PASSWORD_LENGTH = 8;

function createOwnerPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function validatePassword(password, label) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > 256) {
    throw new FileKitError("INVALID_PASSWORD", label + " must be between 8 and 256 characters.");
  }
  if (password.trim().length === 0) {
    throw new FileKitError("INVALID_PASSWORD", label + " cannot be blank.");
  }
}

export async function lockPdf(file, {
  userPassword,
  ownerPassword,
  permissions = {
    printing: "highResolution",
    modifying: false,
    copying: false,
    annotating: false,
    fillingForms: false,
    contentAccessibility: true,
    documentAssembly: false,
  },
  maxPages = DEFAULT_LIMITS.maxPages,
  onProgress = () => {},
} = {}) {
  validatePassword(userPassword, "Open password");
  const owner = ownerPassword || createOwnerPassword();
  validatePassword(owner, "Owner password");
  if (owner === userPassword) {
    throw new FileKitError("INVALID_PASSWORD", "Owner password must differ from the open password.");
  }

  // pdf-lib provides an independent structural/page-count check. qpdf reads
  // the original Blob through WORKERFS, avoiding a second full input copy.
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const document = await PDFDocument.load(sourceBytes);
  if (document.getPageCount() > maxPages) {
    throw new FileKitError("PAGE_LIMIT", "PDF exceeds the configured page limit.");
  }

  const result = await runQpdf("lock", file, {
    userPassword,
    ownerPassword: owner,
    permissions,
    onProgress,
  });
  return new Blob([result], { type: "application/pdf" });
}

export async function unlockPdf(file, {
  password,
  maxPages = DEFAULT_LIMITS.maxPages,
  onProgress = () => {},
} = {}) {
  if (typeof password !== "string" || password.length > 256) {
    throw new FileKitError("INVALID_PASSWORD", "Enter the PDF open or owner password.");
  }

  const result = await runQpdf("unlock", file, { password, onProgress });
  const verified = await PDFDocument.load(result);
  if (verified.getPageCount() > maxPages) {
    throw new FileKitError("PAGE_LIMIT", "PDF exceeds the configured page limit.");
  }
  return new Blob([result], { type: "application/pdf" });
}

export async function addPdfPageNumbers(file, {
  format = "Page {page} of {pages}",
  position = "bottom-center",
  fontSize = 9,
  maxPages = DEFAULT_LIMITS.maxPages,
} = {}) {
  const document = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  const pages = document.getPages();
  if (pages.length > maxPages) {
    throw new FileKitError("PAGE_LIMIT", "PDF exceeds the configured page limit.");
  }
  const font = await document.embedFont(StandardFonts.Helvetica);
  pages.forEach((page, index) => {
    const text = format.replaceAll("{page}", String(index + 1)).replaceAll("{pages}", String(pages.length));
    const { width, height } = page.getSize();
    const size = Math.min(Math.max(6, fontSize), 24);
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = position.endsWith("left")
      ? 24
      : position.endsWith("right")
        ? Math.max(12, width - textWidth - 24)
        : (width - textWidth) / 2;
    const y = position.startsWith("top") ? height - 28 : 18;
    page.drawText(text, { x, y, size, font, color: rgb(0.25, 0.25, 0.25) });
  });
  return new Blob([await document.save()], { type: "application/pdf" });
}

export async function flattenPdfForms(file, { maxPages = DEFAULT_LIMITS.maxPages } = {}) {
  const document = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  if (document.getPageCount() > maxPages) {
    throw new FileKitError("PAGE_LIMIT", "PDF exceeds the configured page limit.");
  }
  try {
    document.getForm().flatten();
  } catch (error) {
    throw new FileKitError("PDF_FORM_FLATTEN_FAILED", "Could not flatten the PDF form fields.", {
      cause: String(error?.message || error),
    });
  }
  return new Blob([await document.save()], { type: "application/pdf" });
}

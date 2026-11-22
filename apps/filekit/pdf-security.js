import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FileKitError, DEFAULT_LIMITS } from "./core.js";
import { runQpdf } from "./pdf-qpdf.js";
const MIN_PASSWORD_LENGTH=8;
function createOwnerPassword(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");}
function validatePassword(password,label){if(typeof password!=="string"||password.length<MIN_PASSWORD_LENGTH||password.length>256)throw new FileKitError("INVALID_PASSWORD",label+" must be between 8 and 256 characters.");if(password.trim().length===0)throw new FileKitError("INVALID_PASSWORD",label+" cannot be blank.");}
export async function lockPdf(file,{userPassword,ownerPassword,permissions={printing:"highResolution",modifying:false,copying:false,annotating:false,fillingForms:false,contentAccessibility:true,documentAssembly:false},maxPages=DEFAULT_LIMITS.maxPages,onProgress=()=>{}}={}){
 validatePassword(userPassword,"Open password");validatePassword(ownerPassword||userPassword,"Owner password");
 const bytes=new Uint8Array(await file.arrayBuffer());const doc=await PDFDocument.load(bytes);if(doc.getPageCount()>maxPages)throw new FileKitError("PAGE_LIMIT","PDF exceeds the configured page limit.");
 const owner=ownerPassword||createOwnerPassword();validatePassword(owner,"Owner password");const result=await runQpdf("lock",bytes,{userPassword,ownerPassword:owner,permissions,onProgress});return new Blob([result],{type:"application/pdf"});
}
export async function unlockPdf(file,{password,maxPages=DEFAULT_LIMITS.maxPages,onProgress=()=>{}}={}){
 if(typeof password!=="string"||password.length>256)throw new FileKitError("INVALID_PASSWORD","Enter the PDF open or owner password.");
 const bytes=new Uint8Array(await file.arrayBuffer());
 const result=await runQpdf("unlock",bytes,{password,onProgress});
 const verified=await PDFDocument.load(result);if(verified.getPageCount()>maxPages)throw new FileKitError("PAGE_LIMIT","PDF exceeds the configured page limit.");
 return new Blob([result],{type:"application/pdf"});
}
export async function addPdfPageNumbers(file,{format="Page {page} of {pages}",position="bottom-center",fontSize=9,maxPages=DEFAULT_LIMITS.maxPages}={}){
 const doc=await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));const pages=doc.getPages();if(pages.length>maxPages)throw new FileKitError("PAGE_LIMIT","PDF exceeds the configured page limit.");const font=await doc.embedFont(StandardFonts.Helvetica);
 pages.forEach((page,index)=>{const text=format.replaceAll("{page}",String(index+1)).replaceAll("{pages}",String(pages.length));const {width,height}=page.getSize();const size=Math.min(Math.max(6,fontSize),24);const tw=font.widthOfTextAtSize(text,size);const x=position.endsWith("left")?24:position.endsWith("right")?Math.max(12,width-tw-24):(width-tw)/2;const y=position.startsWith("top")?height-28:18;page.drawText(text,{x,y,size,font,color:rgb(.25,.25,.25)});});
 return new Blob([await doc.save()],{type:"application/pdf"});
}
export async function flattenPdfForms(file,{maxPages=DEFAULT_LIMITS.maxPages}={}){
 const doc=await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));if(doc.getPageCount()>maxPages)throw new FileKitError("PAGE_LIMIT","PDF exceeds the configured page limit.");try{doc.getForm().flatten();}catch(error){throw new FileKitError("PDF_FORM_FLATTEN_FAILED","Could not flatten the PDF form fields.",{cause:String(error?.message||error)});}return new Blob([await doc.save()],{type:"application/pdf"});
}

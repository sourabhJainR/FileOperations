import { PDFDocument } from "@cantoo/pdf-lib";
import { FileKitError, DEFAULT_LIMITS } from "./core.js";
const MIN_PASSWORD_LENGTH=8;
function validatePassword(password,label){if(typeof password!=="string"||password.length<MIN_PASSWORD_LENGTH||password.length>256)throw new FileKitError("INVALID_PASSWORD",label+" must be between 8 and 256 characters.");if(password.trim().length===0)throw new FileKitError("INVALID_PASSWORD",label+" cannot be blank.");}
export async function lockPdf(file,{userPassword,ownerPassword,permissions={printing:"highResolution",modifying:false,copying:false,annotating:false,fillingForms:false,contentAccessibility:true,documentAssembly:false},maxPages=DEFAULT_LIMITS.maxPages}={}){
 validatePassword(userPassword,"Open password");validatePassword(ownerPassword||userPassword,"Owner password");
 const bytes=new Uint8Array(await file.arrayBuffer());const doc=await PDFDocument.load(bytes);if(doc.getPageCount()>maxPages)throw new FileKitError("PAGE_LIMIT","PDF exceeds the configured page limit.");
 doc.encrypt({userPassword,ownerPassword:ownerPassword||userPassword,permissions,algorithm:"AES-256"});
 const encrypted=await doc.save();return new Blob([encrypted],{type:"application/pdf"});
}
export async function unlockPdf(file,{password,maxPages=DEFAULT_LIMITS.maxPages}={}){
 if(typeof password!=="string"||password.length>256)throw new FileKitError("INVALID_PASSWORD","Enter the PDF open or owner password.");
 const bytes=new Uint8Array(await file.arrayBuffer());
 let doc;try{doc=await PDFDocument.load(bytes,{password});}catch(error){const message=String(error?.message||error);if(/password|decrypt|encrypt/i.test(message))throw new FileKitError("PDF_PASSWORD_INVALID","The password is incorrect or this PDF uses an unsupported encryption method.");throw error;}
 if(doc.getPageCount()>maxPages)throw new FileKitError("PAGE_LIMIT","PDF exceeds the configured page limit.");
 return new Blob([await doc.save()],{type:"application/pdf"});
}

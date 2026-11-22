import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from "docx";
import JSZip from "jszip";
import { DEFAULT_LIMITS, FileKitError, assertWithinResourceLimit, validateFiles, safeOutputName } from "./core.js";

const PAGE_W=612,PAGE_H=792,MARGIN=48;
function checkPdfPages(count,maxPages=DEFAULT_LIMITS.maxPages){if(count>maxPages)throw new FileKitError("PAGE_LIMIT","The combined document exceeds the page limit.",{count,maxPages});}
function isImage(file){return /^image\/(png|jpeg|jpg|webp|gif|bmp)$/i.test(file.type)||/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);}
function isDocument(file){return /\.(docx|txt|md|csv|html?|rtf)$/i.test(file.name);}
async function imageForPdf(file){
 const bitmap=await createImageBitmap(file);
 try{assertWithinResourceLimit({width:bitmap.width,height:bitmap.height});const canvas=document.createElement("canvas");canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext("2d",{alpha:false});ctx.drawImage(bitmap,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));if(!blob)throw new FileKitError("IMAGE_DECODE_FAILED","The image could not be converted.");return new Uint8Array(await blob.arrayBuffer());}
 finally{bitmap.close?.();}
}
async function embedImage(pdf,file){
 const bytes=new Uint8Array(await file.arrayBuffer());
 try{return /\.jpe?g$/i.test(file.name)||file.type==="image/jpeg"?await pdf.embedJpg(bytes):await pdf.embedPng(bytes);}
 catch(error){if(!isImage(file))throw error;return pdf.embedPng(await imageForPdf(file));}
}
export async function imagesToPdf(files,{maxPages=DEFAULT_LIMITS.maxPages,onProgress=()=>{}}={}){
 validateFiles(files);if(files.some(f=>!isImage(f)))throw new FileKitError("UNSUPPORTED_IMAGE","Select only PNG, JPEG, WebP, GIF or BMP images.");
 const pdf=await PDFDocument.create();for(let i=0;i<files.length;i++){const img=await embedImage(pdf,files[i]);checkPdfPages(i+1,maxPages);const page=pdf.addPage([PAGE_W,PAGE_H]);const scale=Math.min((PAGE_W-MARGIN*2)/img.width,(PAGE_H-MARGIN*2)/img.height);const w=img.width*scale,h=img.height*scale;page.drawImage(img,{x:(PAGE_W-w)/2,y:(PAGE_H-h)/2,width:w,height:h});onProgress({completed:i+1,total:files.length,percent:Math.round((i+1)*100/files.length),current:files[i].name});}
 return new Blob([await pdf.save()],{type:"application/pdf"});
}
async function readDocumentText(file){
 const ext=file.name.split(".").pop().toLowerCase();
 if(ext==="docx"){const mammoth=await import("mammoth");const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return result.value;}
 if(ext==="html"||ext==="htm"){const parsed=new DOMParser().parseFromString(await file.text(),"text/html");parsed.querySelectorAll("script,style,iframe,object,embed").forEach(n=>n.remove());return parsed.body?.innerText||parsed.body?.textContent||"";}
 if(["txt","md","csv","rtf"].includes(ext)){const raw=await file.text();return ext==="rtf"?raw.replace(/\\'[0-9a-f]{2}/gi," ").replace(/\\[a-z]+-?\d* ?/gi," ").replace(/[{}]/g,""):raw;}
 throw new FileKitError("UNSUPPORTED_DOCUMENT",`Unsupported document type: .${ext}`);
}
function wrapLine(text,font,size,maxWidth){
 const words=String(text).split(/\s+/),lines=[];let line="";
 for(const word of words){const candidate=line?line+" "+word:word;try{font.encodeText(candidate);}catch{throw new FileKitError("UNSUPPORTED_GLYPH","This document contains characters not supported by the built-in PDF font. Save it as UTF-8 plain text with Latin characters or use image-to-PDF.");}
  if(line&&font.widthOfTextAtSize(candidate,size)>maxWidth){lines.push(line);line=word;}else line=candidate;}
 if(line)lines.push(line);return lines;
}
export async function documentsToPdf(files,{maxPages=DEFAULT_LIMITS.maxPages,onProgress=()=>{}}={}){
 validateFiles(files);if(files.some(f=>!isDocument(f)))throw new FileKitError("UNSUPPORTED_DOCUMENT","Supported documents: DOCX, TXT, Markdown, CSV, HTML and RTF.");
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);let page=null,y=0,pages=0;
 const addPage=()=>{checkPdfPages(pages+1,maxPages);page=pdf.addPage([PAGE_W,PAGE_H]);pages++;y=PAGE_H-MARGIN;};
 addPage();
 for(let fi=0;fi<files.length;fi++){const file=files[fi],text=await readDocumentText(file);if(fi>0){addPage();}page.drawText(file.name.slice(0,90),{x:MARGIN,y,size:14,font:bold,color:rgb(.12,.2,.35)});y-=28;
  for(const paragraph of text.replace(/\r/g,"").split("\n")){const lines=wrapLine(paragraph,font,10,PAGE_W-MARGIN*2);if(!lines.length){y-=8;continue;}for(const line of lines){if(y< MARGIN+14)addPage();page.drawText(line,{x:MARGIN,y,size:10,font,color:rgb(.12,.12,.12)});y-=14;}y-=5;}
  onProgress({completed:fi+1,total:files.length,percent:Math.round((fi+1)*100/files.length),current:file.name});
 }
 return new Blob([await pdf.save()],{type:"application/pdf"});
}
export async function filesToPdf(files,{maxPages=DEFAULT_LIMITS.maxPages,onProgress=()=>{}}={}){
 validateFiles(files);if(files.some(f=>!isImage(f)&&!isDocument(f)))throw new FileKitError("UNSUPPORTED_INPUT","Choose images or supported documents (DOCX, TXT, Markdown, CSV, HTML, RTF).");
 const output=await PDFDocument.create();let pages=0;
 for(let i=0;i<files.length;i++){const file=files[i],part=isImage(file)?await imagesToPdf([file],{maxPages}):await documentsToPdf([file],{maxPages});const parsed=await PDFDocument.load(await part.arrayBuffer());pages+=parsed.getPageCount();checkPdfPages(pages,maxPages);const copied=await output.copyPages(parsed,parsed.getPageIndices());copied.forEach(p=>output.addPage(p));onProgress({completed:i+1,total:files.length,percent:Math.round((i+1)*100/files.length),current:file.name});}
 return new Blob([await output.save()],{type:"application/pdf"});
}
export async function pdfToImages(file,{scale=1.5,format="png",maxPages=DEFAULT_LIMITS.maxPages,onProgress=()=>{}}={}){
 const pdfjs=await import("pdfjs-dist"),zip=new JSZip();const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;checkPdfPages(pdf.numPages,maxPages);
 if(!["png","jpeg"].includes(format))throw new FileKitError("UNSUPPORTED_IMAGE_FORMAT","Choose PNG or JPEG output.");
 for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),viewport=page.getViewport({scale});const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);assertWithinResourceLimit({width,height});const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d",{alpha:false});await page.render({canvasContext:ctx,viewport}).promise;const blob=await new Promise(resolve=>canvas.toBlob(resolve,format==="jpeg"?"image/jpeg":"image/png",.92));if(!blob)throw new FileKitError("PDF_RENDER_FAILED","Could not export a PDF page as an image.");zip.file("page-"+String(n).padStart(4,"0")+"."+format,new Uint8Array(await blob.arrayBuffer()));canvas.width=0;canvas.height=0;onProgress({completed:n,total:pdf.numPages,percent:Math.round(n*100/pdf.numPages),current:"Page "+n});}
 return zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:3}});
}
export async function mergePdfs(files,{maxPages=DEFAULT_LIMITS.maxPages,onProgress=()=>{}}={}){
 validateFiles(files);const output=await PDFDocument.create();let total=0;
 for(let i=0;i<files.length;i++){const input=await PDFDocument.load(new Uint8Array(await files[i].arrayBuffer()));total+=input.getPageCount();checkPdfPages(total,maxPages);const pages=await output.copyPages(input,input.getPageIndices());pages.forEach(p=>output.addPage(p));onProgress({completed:i+1,total:files.length,percent:Math.round((i+1)*100/files.length),current:files[i].name});}
 return new Blob([await output.save()],{type:"application/pdf"});
}
export async function pdfToDocx(file,{maxPages=DEFAULT_LIMITS.maxPages,onProgress=()=>{}}={}){
 const pdfjs=await import("pdfjs-dist");const doc=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;checkPdfPages(doc.numPages,maxPages);const paragraphs=[];
 for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),content=await page.getTextContent();let lastY=null,line="";const lines=[];
  for(const item of content.items){if(!item.str)continue;const y=item.transform?.[5]??0;if(lastY!==null&&Math.abs(y-lastY)>3){if(line.trim())lines.push(line.trim());line="";}line+=(line?" ":"")+item.str;lastY=y;}
  if(line.trim())lines.push(line.trim());if(n>1)paragraphs.push(new Paragraph({text:"",pageBreakBefore:true}));paragraphs.push(new Paragraph({text:"Page "+n,heading:HeadingLevel.HEADING_2}));for(const value of lines)paragraphs.push(new Paragraph({children:[new TextRun(value)]}));onProgress({completed:n,total:doc.numPages,percent:Math.round(n*100/doc.numPages),current:"Page "+n});
 }
 const word=new Document({sections:[{properties:{},children:paragraphs}]});return Packer.toBlob(word);
}
export function outputName(file,suffix,extension){return safeOutputName(file.name.replace(/\.[^.]+$/,"")+"-"+suffix)+"."+extension;}

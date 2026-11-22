import JSZip from "jszip";
import { DEFAULT_LIMITS, FileKitError, safeArchivePath, safeOutputName } from "./core.js";
function readEntryBounded(entry,limit,path,signal){
 return new Promise((resolve,reject)=>{const stream=entry.internalStream("uint8array");const chunks=[];let size=0,settled=false;
 const fail=e=>{if(settled)return;settled=true;try{stream.pause();}catch{}reject(e);};
 stream.on("data",chunk=>{if(signal?.aborted)return fail(new FileKitError("CANCELLED","Extraction cancelled."));size+=chunk.byteLength;if(size>limit)return fail(new FileKitError("ZIP_ENTRY_TOO_LARGE","An archive entry exceeds the size limit.",{path,size,limit}));chunks.push(chunk);});
 stream.on("error",fail);stream.on("end",()=>{if(settled)return;settled=true;const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength;}resolve(out);});stream.resume();
 });
}
export async function extractZipSafely(file,{maxEntries=DEFAULT_LIMITS.maxZipEntries,maxExpandedBytes=DEFAULT_LIMITS.maxZipExpandedBytes,maxEntryBytes=DEFAULT_LIMITS.maxFileBytes,signal,onProgress=()=>{}}={}){
 const zip=await JSZip.loadAsync(file,{checkCRC32:true,createFolders:false});
 const entries=Object.values(zip.files).filter(x=>!x.dir);
 if(entries.length>maxEntries)throw new FileKitError("ZIP_ENTRY_LIMIT","Archive contains too many files.",{entries:entries.length,maxEntries});
 const plans=entries.map(entry=>{const path=safeArchivePath(entry.name);const declared=entry._data?.uncompressedSize;if(!Number.isSafeInteger(declared)||declared<0)throw new FileKitError("INVALID_ZIP_ENTRY","Archive entry has no valid expanded-size declaration.",{path});if(declared>maxEntryBytes)throw new FileKitError("ZIP_ENTRY_TOO_LARGE","An archive entry exceeds the size limit.",{path,declared,maxEntryBytes});return {entry,path,declared};});
 const declaredTotal=plans.reduce((n,p)=>n+p.declared,0);if(declaredTotal>maxExpandedBytes)throw new FileKitError("ZIP_EXPANDED_LIMIT","Archive expands beyond the configured size limit.",{declaredTotal,maxExpandedBytes});
 const output=new JSZip();let expanded=0,done=0;
 for(const p of plans){if(signal?.aborted)throw new FileKitError("CANCELLED","Extraction cancelled.");const remaining=Math.min(maxEntryBytes,maxExpandedBytes-expanded);const bytes=await readEntryBounded(p.entry,remaining,p.path,signal);if(bytes.byteLength!==p.declared)throw new FileKitError("ZIP_SIZE_MISMATCH","Archive entry size does not match its directory record.",{path:p.path,declared:p.declared,actual:bytes.byteLength});expanded+=bytes.byteLength;output.file(p.path,bytes,{createFolders:false});done++;onProgress({completed:done,total:entries.length,percent:Math.round(done*100/entries.length),current:p.path});}
 return {blob:await output.generateAsync({type:"blob",streamFiles:true}),entries:done,expandedBytes:expanded};
}
export async function packFiles(files,{maxEntries=DEFAULT_LIMITS.maxZipEntries,maxExpandedBytes=DEFAULT_LIMITS.maxZipExpandedBytes,signal,onProgress=()=>{}}={}){
 if(files.length>maxEntries)throw new FileKitError("ZIP_ENTRY_LIMIT","Too many files for one archive.");const zip=new JSZip();let total=0;
 for(let i=0;i<files.length;i++){if(signal?.aborted)throw new FileKitError("CANCELLED","Archive creation cancelled.");const f=files[i];total+=f.size;if(total>maxExpandedBytes)throw new FileKitError("ZIP_EXPANDED_LIMIT","Selected files exceed the archive budget.");zip.file(safeOutputName(f.name),f);onProgress({completed:i+1,total:files.length,percent:Math.round((i+1)*100/files.length),current:f.name});}
 return zip.generateAsync({type:"blob",streamFiles:true});
}

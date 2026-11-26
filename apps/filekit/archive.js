import JSZip from "jszip";
import { DEFAULT_LIMITS, FileKitError, normalizeError, safeArchivePath, safeOutputName } from "./core.js";
function readEntryBounded(entry,limit,path,signal){
 return new Promise((resolve,reject)=>{const stream=entry.internalStream("uint8array");const chunks=[];let size=0,settled=false;
 const fail=e=>{if(settled)return;settled=true;try{stream.pause();}catch{}reject(e);};
 stream.on("data",chunk=>{if(signal?.aborted)return fail(new FileKitError("CANCELLED","Extraction cancelled."));size+=chunk.byteLength;if(size>limit)return fail(new FileKitError("ZIP_ENTRY_TOO_LARGE","An archive entry exceeds the size limit.",{path,size,limit}));chunks.push(chunk);});
 stream.on("error",fail);stream.on("end",()=>{if(settled)return;settled=true;const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength;}resolve(out);});stream.resume();
 });
}
export async function extractZipSafely(file,{maxEntries=DEFAULT_LIMITS.maxZipEntries,maxExpandedBytes=DEFAULT_LIMITS.maxZipExpandedBytes,maxEntryBytes=DEFAULT_LIMITS.maxFileBytes,signal,onProgress=()=>{}}={}){
 const zip=await JSZip.loadAsync(await file.arrayBuffer(),{checkCRC32:true,createFolders:false});
 const entries=Object.values(zip.files).filter(x=>!x.dir);
 if(entries.length>maxEntries)throw new FileKitError("ZIP_ENTRY_LIMIT","Archive contains too many files.",{entries:entries.length,maxEntries});
 const plans=entries.map(entry=>{const path=safeArchivePath(entry.name);const declared=entry._data?.uncompressedSize;if(!Number.isSafeInteger(declared)||declared<0)throw new FileKitError("INVALID_ZIP_ENTRY","Archive entry has no valid expanded-size declaration.",{path});if(declared>maxEntryBytes)throw new FileKitError("ZIP_ENTRY_TOO_LARGE","An archive entry exceeds the size limit.",{path,declared,maxEntryBytes});return {entry,path,declared};});
 const declaredTotal=plans.reduce((n,p)=>n+p.declared,0);if(declaredTotal>maxExpandedBytes)throw new FileKitError("ZIP_EXPANDED_LIMIT","Archive expands beyond the configured size limit.",{declaredTotal,maxExpandedBytes});
 const output=new JSZip();const seen=new Set();let expanded=0,done=0;
 for(const p of plans){if(seen.has(p.path))throw new FileKitError("DUPLICATE_ARCHIVE_PATH","Archive entries collide after path sanitisation.",{path:p.path});seen.add(p.path);if(signal?.aborted)throw new FileKitError("CANCELLED","Extraction cancelled.");const remaining=Math.min(maxEntryBytes,maxExpandedBytes-expanded);const bytes=await readEntryBounded(p.entry,remaining,p.path,signal);if(bytes.byteLength!==p.declared)throw new FileKitError("ZIP_SIZE_MISMATCH","Archive entry size does not match its directory record.",{path:p.path,declared:p.declared,actual:bytes.byteLength});expanded+=bytes.byteLength;output.file(p.path,bytes,{createFolders:false});done++;onProgress({completed:done,total:entries.length,percent:Math.round(done*100/entries.length),current:p.path});}
 return {blob:await output.generateAsync({type:"blob",streamFiles:true}),entries:done,expandedBytes:expanded};
}
export async function packFiles(files,{maxEntries=DEFAULT_LIMITS.maxZipEntries,maxExpandedBytes=DEFAULT_LIMITS.maxZipExpandedBytes,signal,onProgress=()=>{}}={}){
 if(files.length>maxEntries)throw new FileKitError("ZIP_ENTRY_LIMIT","Too many files for one archive.");const zip=new JSZip();let total=0;
 for(let i=0;i<files.length;i++){if(signal?.aborted)throw new FileKitError("CANCELLED","Archive creation cancelled.");const f=files[i];total+=f.size;if(total>maxExpandedBytes)throw new FileKitError("ZIP_EXPANDED_LIMIT","Selected files exceed the archive budget.");zip.file(safeOutputName(f.name),f);onProgress({completed:i+1,total:files.length,percent:Math.round((i+1)*100/files.length),current:f.name});}
 return zip.generateAsync({type:"blob",streamFiles:true});
}

/**
 * Recursively extracts nested ZIPs into safe in-memory File objects.
 * Budgets are shared across the complete tree, not reset per nested archive.
 */
export async function extractZipTree(file,{maxDepth=5,maxEntries=DEFAULT_LIMITS.maxZipEntries,maxExpandedBytes=DEFAULT_LIMITS.maxZipExpandedBytes,maxEntryBytes=DEFAULT_LIMITS.maxFileBytes,signal,onProgress=()=>{}}={}){
 const state={entries:0,expandedBytes:0,files:[],archives:0,seen:new Set()};
 const isZip=(name,bytes)=>/\.zip$/i.test(name)&&bytes.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b&&[0x03,0x05,0x07].includes(bytes[2])&&[0x04,0x06,0x08].includes(bytes[3]);
 const walk=async(bytes,archiveName,prefix,depth)=>{
  if(depth>maxDepth)throw new FileKitError("ZIP_DEPTH_LIMIT","Nested ZIP depth exceeds the configured limit.",{archiveName,maxDepth});
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true,createFolders:false});
  const entries=Object.values(zip.files).filter(entry=>!entry.dir);
  for(const entry of entries){
   if(signal?.aborted)throw new FileKitError("CANCELLED","Nested archive processing was cancelled.");
   state.entries++;if(state.entries>maxEntries)throw new FileKitError("ZIP_ENTRY_LIMIT","Nested archives contain too many files.",{maxEntries});
   const relative=safeArchivePath(entry.name),path=safeArchivePath(prefix?prefix+"/"+relative:relative);
   const declared=entry._data?.uncompressedSize;
   if(!Number.isSafeInteger(declared)||declared<0||declared>maxEntryBytes)throw new FileKitError("ZIP_ENTRY_TOO_LARGE","A nested archive entry exceeds the per-file limit.",{path,declared,maxEntryBytes});
   if(state.expandedBytes+declared>maxExpandedBytes)throw new FileKitError("ZIP_EXPANDED_LIMIT","Nested archives exceed the combined expanded-size limit.",{maxExpandedBytes});
   const data=await readEntryBounded(entry,Math.min(maxEntryBytes,maxExpandedBytes-state.expandedBytes),path,signal);
   if(data.byteLength!==declared)throw new FileKitError("ZIP_SIZE_MISMATCH","Nested archive entry size does not match its directory record.",{path,declared,actual:data.byteLength});
   state.expandedBytes+=data.byteLength;
   if(isZip(path,data)){state.archives++;const childPrefix=path.replace(/\.zip$/i,"");await walk(data,path,childPrefix,depth+1);}
   else{if(state.seen.has(path))throw new FileKitError("DUPLICATE_ARCHIVE_PATH","Nested archives contain colliding file paths.",{path});state.seen.add(path);state.files.push(new File([data],path));}
   onProgress({completed:state.entries,total:Math.max(state.entries,entries.length),percent:Math.min(99,Math.round(state.expandedBytes*100/Math.max(maxExpandedBytes,1))),current:path,expandedBytes:state.expandedBytes});
  }
 };
 await walk(await file.arrayBuffer(),file.name,"",0);
 onProgress({completed:state.entries,total:state.entries,percent:100,current:file.name,expandedBytes:state.expandedBytes});
 return {files:state.files,entries:state.entries,archives:state.archives,expandedBytes:state.expandedBytes};
}


/**
 * Extract a selected ZIP batch under one shared entry and expanded-byte budget.
 * Work is sequential so concurrent archives cannot reserve the same remaining
 * capacity. Failed archives do not reset the budget already consumed by prior
 * successful archives.
 */
export async function extractZipBatch(files, { maxDepth = 5, maxEntries = DEFAULT_LIMITS.maxZipEntries, maxExpandedBytes = DEFAULT_LIMITS.maxZipExpandedBytes, maxEntryBytes = DEFAULT_LIMITS.maxFileBytes, signal, onProgress = () => {} } = {}) {
  if (!Array.isArray(files)) throw new FileKitError("INVALID_BATCH", "ZIP batch input must be a list.");
  const results = new Array(files.length).fill(undefined);
  const errors = [];
  let entries = 0;
  let expandedBytes = 0;
  for (let index = 0; index < files.length; index++) {
    if (signal?.aborted) throw new FileKitError("CANCELLED", "Nested archive processing was cancelled.");
    const file = files[index];
    try {
      const result = await extractZipTree(file, {
        maxDepth,
        maxEntries: Math.max(0, maxEntries - entries),
        maxExpandedBytes: Math.max(0, maxExpandedBytes - expandedBytes),
        maxEntryBytes,
        signal,
        onProgress: progress => onProgress({ ...progress, file: file.name, fileIndex: index, fileCount: files.length }),
      });
      entries += result.entries;
      expandedBytes += result.expandedBytes;
      results[index] = result;
    } catch (error) {
      if (signal?.aborted || error?.code === "CANCELLED") throw error;
      errors.push({ index, name: file?.name, error: normalizeError(error, file?.name) });
    }
  }
  return { results, errors, entries, expandedBytes, completed: files.length, total: files.length, ok: errors.length === 0 };
}

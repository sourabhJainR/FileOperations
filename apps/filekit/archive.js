import JSZip from "jszip";
import { DEFAULT_LIMITS, FileKitError, safeArchivePath, safeOutputName } from "./core.js";
export async function extractZipSafely(file,{maxEntries=DEFAULT_LIMITS.maxZipEntries,maxExpandedBytes=DEFAULT_LIMITS.maxZipExpandedBytes,maxEntryBytes=DEFAULT_LIMITS.maxFileBytes,signal,onProgress=()=>{}}={}) {
  const zip=await JSZip.loadAsync(file,{checkCRC32:true,createFolders:false});
  const entries=Object.values(zip.files).filter(x=>!x.dir);
  if(entries.length>maxEntries) throw new FileKitError("ZIP_ENTRY_LIMIT","Archive contains too many files.",{entries:entries.length,maxEntries});
  const output=new JSZip(); let expanded=0,done=0;
  for(const entry of entries){
    if(signal?.aborted) throw new FileKitError("CANCELLED","Extraction cancelled.");
    const path=safeArchivePath(entry.name);
    const bytes=await entry.async("uint8array");
    if(bytes.byteLength>maxEntryBytes) throw new FileKitError("ZIP_ENTRY_TOO_LARGE","An archive entry exceeds the size limit.",{path,size:bytes.byteLength});
    expanded+=bytes.byteLength;
    if(expanded>maxExpandedBytes) throw new FileKitError("ZIP_EXPANDED_LIMIT","Archive expands beyond the configured size limit.",{expanded,maxExpandedBytes});
    output.file(path,bytes,{createFolders:false}); done++; onProgress({completed:done,total:entries.length,percent:Math.round(done*100/entries.length),current:path});
  }
  return {blob:await output.generateAsync({type:"blob",streamFiles:true}),entries:done,expandedBytes:expanded};
}
export async function packFiles(files,{maxEntries=DEFAULT_LIMITS.maxZipEntries,maxExpandedBytes=DEFAULT_LIMITS.maxZipExpandedBytes,signal,onProgress=()=>{}}={}) {
  if(files.length>maxEntries) throw new FileKitError("ZIP_ENTRY_LIMIT","Too many files for one archive.");
  const zip=new JSZip();let total=0;
  for(let i=0;i<files.length;i++){if(signal?.aborted)throw new FileKitError("CANCELLED","Archive creation cancelled.");const f=files[i];total+=f.size;if(total>maxExpandedBytes)throw new FileKitError("ZIP_EXPANDED_LIMIT","Selected files exceed the archive budget.");zip.file(safeOutputName(f.name),f);onProgress({completed:i+1,total:files.length,percent:Math.round((i+1)*100/files.length),current:f.name});}
  return zip.generateAsync({type:"blob",streamFiles:true});
}

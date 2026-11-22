import createModule from "@soulehshaikh99/qpdf-wasm";
import wasmUrl from "@soulehshaikh99/qpdf-wasm/dist/qpdf.wasm?url";
let runtime;
async function getRuntime(report){
 if(!runtime){
  report("Downloading local PDF security engine");
  const response=await fetch(wasmUrl,{credentials:"same-origin"});
  if(!response.ok)throw new Error("Could not load the local PDF security engine (HTTP "+response.status+").");
  const wasmBinary=await response.arrayBuffer();
  report("Initializing PDF security engine");
  runtime=createModule({wasmBinary,locateFile:()=>wasmUrl,print:()=>{},printErr:message=>report("PDF engine: "+String(message).slice(0,300))});
 }
 return runtime;
}
self.onmessage=async({data})=>{
 const {id,operation,bytes,options}=data;
 let qpdf,inPath="/filekit-input.pdf",outPath="/filekit-output.pdf";
 const report=message=>self.postMessage({id,type:"progress",message});
 try{
  report("Loading local PDF security engine");
  qpdf=await getRuntime(report);
  report("PDF security engine ready");
  for(const path of [inPath,outPath]){try{qpdf.FS.unlink(path)}catch{}}
  qpdf.FS.writeFile(inPath,new Uint8Array(bytes));
  let args;
  if(operation==="lock"){
   const p=options.permissions||{};
   args=["--encrypt",options.userPassword,options.ownerPassword,"256",
    p.printing==="highResolution"?"--print=full":"--print=none",
    p.modifying?"--modify=all":"--modify=none",
    p.modifying?"--modify-other=y":"--modify-other=n",
    p.copying?"--extract=y":"--extract=n",
    p.annotating?"--annotate=y":"--annotate=n",
    p.fillingForms?"--form=y":"--form=n",
    p.documentAssembly?"--assemble=y":"--assemble=n",
    "--",inPath,outPath];
  }else{
   args=["--password="+options.password,"--decrypt",inPath,outPath];
  }
  report(operation==="lock"?"Applying AES-256 PDF encryption":"Removing PDF password protection");
  const code=qpdf.callMain(args);
  if(code!==0&&code!==3)throw new Error("qpdf rejected the PDF or password (exit "+code+").");
  const result=qpdf.FS.readFile(outPath);
  if(!result?.length)throw new Error("PDF security engine returned an empty document.");
  const copy=result.slice();
  self.postMessage({id,type:"complete",bytes:copy.buffer},[copy.buffer]);
 }catch(error){
  self.postMessage({id,type:"error",message:String(error?.message||error)});
 }finally{
  if(qpdf){for(const path of [inPath,outPath]){try{qpdf.FS.unlink(path)}catch{}}}
 }
};

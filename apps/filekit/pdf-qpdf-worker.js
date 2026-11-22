import createModule from "@soulehshaikh99/qpdf-wasm";
import wasmUrl from "@soulehshaikh99/qpdf-wasm/dist/qpdf.wasm?url";
let runtime;
async function getRuntime(){if(!runtime)runtime=createModule({locateFile:()=>wasmUrl});return runtime;}
self.onmessage=async({data})=>{const {id,operation,bytes,options}=data;let qpdf,inPath="/filekit-input.pdf",outPath="/filekit-output.pdf",stderr=[];
try{
 self.postMessage({id,type:"progress",message:"Loading local PDF security engine"});
 qpdf=await getRuntime();
 self.postMessage({id,type:"progress",message:"PDF security engine ready"});
 for(const path of [inPath,outPath]){try{qpdf.FS.unlink(path)}catch{}}
 qpdf.FS.writeFile(inPath,new Uint8Array(bytes));
 const args=operation==="lock"
 ?["--encrypt","--user-password="+options.userPassword,"--owner-password="+options.ownerPassword,"--bits=256",options.permissions.printing==="highResolution"?"--print=full":"--print=none",options.permissions.modifying?"--modify=all":"--modify=none",options.permissions.modifying?"--modify-other=y":"--modify-other=n",options.permissions.copying?"--extract=y":"--extract=n",options.permissions.annotating?"--annotate=y":"--annotate=n",options.permissions.fillingForms?"--form=y":"--form=n",options.permissions.documentAssembly?"--assemble=y":"--assemble=n","--",inPath,outPath]
 :["--password="+options.password,"--decrypt",inPath,outPath];
 self.postMessage({id,type:"progress",message:"Running AES-256 PDF operation"});
 const code=qpdf.callMain(args);if(code!==0&&code!==3)throw new Error("qpdf rejected the PDF or password (exit "+code+").");
 const result=qpdf.FS.readFile(outPath);const copy=result.slice();self.postMessage({id,type:"complete",bytes:copy.buffer},[copy.buffer]);
}catch(error){self.postMessage({id,type:"error",message:String(error?.message||error)});}
finally{if(qpdf){for(const path of [inPath,outPath]){try{qpdf.FS.unlink(path)}catch{}}}}
};

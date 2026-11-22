import createModule from "@soulehshaikh99/qpdf-wasm";
import wasmUrl from "@soulehshaikh99/qpdf-wasm/dist/qpdf.wasm?url";
let runtime;
async function getRuntime(report){if(!runtime){report("Initializing qpdf WebAssembly");runtime=await createModule({locateFile:()=>wasmUrl});}return runtime;}
self.onmessage=async({data})=>{const {id,operation,file,options}=data;let qpdf,mounted=false;const input="/in/input.pdf",output="/out.pdf";
try{
 self.postMessage({id,type:"progress",message:"Loading local PDF security engine"});
 qpdf=await getRuntime(message=>self.postMessage({id,type:"progress",message}));
 self.postMessage({id,type:"progress",message:"PDF security engine ready"});
 qpdf.FS.mkdir("/in");qpdf.FS.mount(qpdf.WORKERFS,{blobs:[{name:"input.pdf",data:file}]}, "/in");mounted=true;
 const args=operation==="lock"
 ?["--encrypt","--user-password="+options.userPassword,"--owner-password="+options.ownerPassword,"--bits=256",options.permissions.printing==="highResolution"?"--print=full":"--print=none",options.permissions.modifying?"--modify=all":"--modify=none",options.permissions.modifying?"--modify-other=y":"--modify-other=n",options.permissions.copying?"--extract=y":"--extract=n",options.permissions.annotating?"--annotate=y":"--annotate=n",options.permissions.fillingForms?"--form=y":"--form=n",options.permissions.documentAssembly?"--assemble=y":"--assemble=n","--",input,output]
 :["--password="+options.password,"--decrypt",input,output];
 self.postMessage({id,type:"progress",message:"Running AES-256 PDF operation"});
 const code=qpdf.callMain(args);if(code!==0&&code!==3)throw new Error("qpdf rejected the PDF or password (exit "+code+").");
 const result=qpdf.FS.readFile(output);const copy=result.slice();self.postMessage({id,type:"complete",bytes:copy.buffer},[copy.buffer]);
}catch(error){self.postMessage({id,type:"error",message:String(error?.message||error)});}
finally{if(qpdf){try{if(mounted)qpdf.FS.unmount("/in")}catch{}try{qpdf.FS.unlink(output)}catch{}try{qpdf.FS.rmdir("/in")}catch{}}}
};

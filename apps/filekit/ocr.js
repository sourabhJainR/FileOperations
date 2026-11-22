import { FileKitError, assertWithinResourceLimit, DEFAULT_LIMITS } from "./core.js";
export async function ocrImage(file,{worker,lang="eng",maxPixels=DEFAULT_LIMITS.maxPixels,onProgress=()=>{},signal}={}) {
 if(!worker)throw new FileKitError("OCR_ENGINE_MISSING","OCR engine is not available. Load the local Tesseract worker and language data first.");
 if(signal?.aborted)throw new FileKitError("CANCELLED","OCR cancelled.");
 const bitmap=await createImageBitmap(file);try{assertWithinResourceLimit({width:bitmap.width,height:bitmap.height,maxPixels});const canvas=document.createElement("canvas");canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext("2d").drawImage(bitmap,0,0);const result=await worker.recognize(canvas);if(signal?.aborted)throw new FileKitError("CANCELLED","OCR cancelled.");return result.data.text;}finally{bitmap.close();}
}

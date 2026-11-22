import { safeOutputName, FileKitError } from "./core.js";
/** Multi-sheet workbook operations. XLSX is injected to keep the module testable. */
export function listSheets(workbook) { return [...(workbook?.SheetNames || [])]; }
export function exportWorkbook(workbook, XLSX, format = "csv") {
  const sheets = listSheets(workbook);
  if (!sheets.length) throw new FileKitError("EMPTY_WORKBOOK", "The workbook has no worksheets.");
  return sheets.map((name, index) => {
    const sheet = workbook.Sheets[name];
    let content, extension, type;
    if (format === "csv") { content = XLSX.utils.sheet_to_csv(sheet); extension = "csv"; type = "text/csv;charset=utf-8"; }
    else if (format === "json") { content = JSON.stringify(XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false }), null, 2); extension = "json"; type = "application/json"; }
    else if (format === "html") { content = XLSX.utils.sheet_to_html(sheet); extension = "html"; type = "text/html;charset=utf-8"; }
    else throw new FileKitError("UNSUPPORTED_EXPORT", `Unsupported spreadsheet export: ${format}`);
    return { sheet: name, index, name: safeOutputName(name, `sheet-${index + 1}`) + "." + extension, content, type };
  });
}
export function compareWorkbooks(left, right, XLSX) {
  const leftNames = listSheets(left), rightNames = listSheets(right);
  const names = [...new Set([...leftNames, ...rightNames])];
  return names.map(name => {
    const a = left.Sheets[name], b = right.Sheets[name];
    if (!a || !b) return { sheet: name, status: "missing", left: !!a, right: !!b, differences: [] };
    const rowsA = XLSX.utils.sheet_to_json(a, { header: 1, defval: null, raw: false });
    const rowsB = XLSX.utils.sheet_to_json(b, { header: 1, defval: null, raw: false });
    const differences = [];
    for (let row = 0; row < Math.max(rowsA.length, rowsB.length); row++) {
      const x = rowsA[row] || [], y = rowsB[row] || [];
      for (let col = 0; col < Math.max(x.length, y.length); col++) {
        if (JSON.stringify(x[col] ?? null) !== JSON.stringify(y[col] ?? null))
          differences.push({ row: row + 1, column: col + 1, left: x[col] ?? null, right: y[col] ?? null });
      }
    }
    return { sheet: name, status: differences.length ? "different" : "equal", differences };
  });
}

/** Combine every sheet from every selected workbook into one XLSX file. */
export function combineWorkbooks(files,XLSX,{maxSheets=1000}={}){
 if(!Array.isArray(files)||files.length<1)throw new FileKitError("NO_FILES","Choose at least one workbook.");
 const combined=XLSX.utils.book_new(),used=new Set();let count=0;
 const uniqueName=(candidate)=>{
  let base=String(candidate).replace(/[\\/?*\[\]:]/g," ").replace(/^'+|'+$/g,"").trim().slice(0,31)||"Sheet";
  let name=base,index=2;while(used.has(name.toLowerCase())){const suffix="_"+index++;name=base.slice(0,31-suffix.length)+suffix;}
  used.add(name.toLowerCase());return name;
 };
 for(const file of files){
  const ext=file.name.split(".").pop().toLowerCase();if(!["xlsx","xls","xlsm","csv"].includes(ext))throw new FileKitError("UNSUPPORTED_WORKBOOK","Only XLSX, XLS, XLSM and CSV files can be combined.",{file:file.name});
  const workbook=XLSX.read(ext==="csv"?file.__text||"":file.__bytes,{type:ext==="csv"?"string":"array",cellDates:true});
  for(const originalName of workbook.SheetNames){count++;if(count>maxSheets)throw new FileKitError("SHEET_LIMIT","Combined workbook contains too many worksheets.",{maxSheets});const source=file.name.replace(/\.[^.]+$/,"");const name=uniqueName(source+"_"+originalName);XLSX.utils.book_append_sheet(combined,workbook.Sheets[originalName],name);}
 }
 if(!count)throw new FileKitError("EMPTY_WORKBOOK","No worksheets were found in the selected files.");
 return XLSX.write(combined,{type:"array",bookType:"xlsx",cellDates:true});
}

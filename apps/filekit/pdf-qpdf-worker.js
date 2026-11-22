import createModule from "@soulehshaikh99/qpdf-wasm";
import wasmUrl from "@soulehshaikh99/qpdf-wasm/dist/qpdf.wasm?url";

self.onmessage = async ({ data }) => {
  const { id, operation, file, options } = data;
  let qpdf;
  let mounted = false;
  const inputDirectory = "/filekit-input";
  const inputPath = inputDirectory + "/input.pdf";
  const outputPath = "/filekit-output.pdf";
  const report = (message) => self.postMessage({ id, type: "progress", message });

  try {
    if (!(file instanceof Blob)) {
      throw new Error("PDF security worker requires a File or Blob input.");
    }

    report("Initializing PDF security engine");
    qpdf = await createModule({
      locateFile: () => wasmUrl,
      print: () => {},
      printErr: (message) => report("PDF engine: " + String(message).slice(0, 300)),
    });

    qpdf.FS.mkdir(inputDirectory);
    qpdf.FS.mount(
      qpdf.WORKERFS,
      { blobs: [{ name: "input.pdf", data: file }] },
      inputDirectory,
    );
    mounted = true;

    let args;
    if (operation === "lock") {
      const permissions = options.permissions || {};
      args = [
        "--encrypt",
        "--user-password=" + options.userPassword,
        "--owner-password=" + options.ownerPassword,
        "--bits=256",
        permissions.printing === "highResolution" ? "--print=full" : "--print=none",
        permissions.modifying ? "--modify=all" : "--modify=none",
        permissions.modifying ? "--modify-other=y" : "--modify-other=n",
        permissions.copying ? "--extract=y" : "--extract=n",
        permissions.annotating ? "--annotate=y" : "--annotate=n",
        permissions.fillingForms ? "--form=y" : "--form=n",
        permissions.documentAssembly ? "--assemble=y" : "--assemble=n",
        "--",
        inputPath,
        outputPath,
      ];
    } else if (operation === "unlock") {
      args = ["--password=" + options.password, "--decrypt", inputPath, outputPath];
    } else {
      throw new Error("Unsupported PDF security operation.");
    }

    report(operation === "lock" ? "Applying AES-256 PDF encryption" : "Removing PDF password protection");
    const exitCode = qpdf.callMain(args);
    if (exitCode !== 0 && exitCode !== 3) {
      throw new Error("qpdf rejected the PDF or password (exit " + exitCode + ").");
    }

    const output = qpdf.FS.readFile(outputPath);
    if (!output || output.length === 0) {
      throw new Error("PDF security engine returned an empty document.");
    }
    const result = output.slice();
    self.postMessage({ id, type: "complete", bytes: result.buffer }, [result.buffer]);
  } catch (error) {
    self.postMessage({ id, type: "error", message: String(error?.message || error) });
  } finally {
    if (qpdf) {
      if (mounted) {
        try { qpdf.FS.unmount(inputDirectory); } catch {}
      }
      try { qpdf.FS.unlink(outputPath); } catch {}
    }
  }
};

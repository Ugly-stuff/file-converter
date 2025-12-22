import express from "express";
import multer from "multer";
import fs from "fs-extra";
import path from "path";
import archiver from "archiver";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Paths
const ROOT = process.cwd(); // provides full current working directory
const UPLOADS = path.join(ROOT, "uploads");
const OUTPUT = path.join(ROOT, "output");
fs.ensureDirSync(UPLOADS);
fs.ensureDirSync(OUTPUT);

// Multer Setup
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => 
      cb(null, UPLOADS),
    filename: (_, file, cb) =>
       cb(null, Date.now() + "-" + file.originalname)
  })
});

// CloudConvert Helper
async function ccConvert(inputPath, outputExt) {
  const apiKey = process.env.CLOUDCONVERT_API_KEY; // to hide my convert key
  if (!apiKey) throw new Error("CLOUDCONVERT_API_KEY not set");

  const jobBody = {
    tasks: {
      upload: { operation: "import/upload" },
      convert: {
        operation: "convert",
        input: ["upload"],
        output_format: outputExt.replace(".", "")
      },
      export: { operation: "export/url", input: ["convert"] }
    }
  };

  // Create job
  const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(jobBody)
  });
  const job = (await jobRes.json()).data;
console.log("Api kye", apiKey);
  // Upload file
  const uploadTask = job.tasks.find(t => t.operation === "import/upload");
  const FormData = (await import("form-data")).default;
  const form = new FormData();

  for (const [k, v] of Object.entries(uploadTask.result.form.parameters || {}))
    form.append(k, String(v));
  form.append("file", fs.createReadStream(inputPath));

  await fetch(uploadTask.result.form.url, { method: "POST", body: form });

  // Poll job
  let finalJob = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const status = await (await fetch(`https://api.cloudconvert.com/v2/jobs/${job.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })).json();
    finalJob = status.data;
    if (finalJob.status === "finished") break;
    if (finalJob.status === "error") throw new Error("CloudConvert failed");
  }

  // Download result
  const fileUrl = finalJob.tasks.find(t => t.operation === "export/url").result.files[0].url;
  const buf = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());
  return buf;
}

// Main Convert Route
app.post("/convert", upload.array("files"), async (req, res) => {
  try {
    if (!req.files?.length)
      return res.json({ status: "error", message: "No files uploaded" });

    const target = (req.body.format || "pdf").toLowerCase();
    const jobId = Date.now().toString();
    const jobFolder = path.join(OUTPUT, jobId);
    fs.ensureDirSync(jobFolder);

    // Convert each file
    for (const file of req.files) {
      const base = path.basename(file.originalname, path.extname(file.originalname));
      const outPath = path.join(jobFolder, `${base}.${target}`);
      const converted = await ccConvert(file.path, "." + target);
      await fs.writeFile(outPath, converted);
    }

    // ZIP + Stream
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="CONVERTED-${jobId}.zip"`);

    const zip = archiver("zip", { zlib: { level: 9 } });
    zip.on("error", err => {
      if (!res.headersSent) res.status(500).json({ status: "error", message: err.message });
    });

    zip.pipe(res);
    zip.directory(jobFolder, false);
    zip.finalize();

    // Cleanup
    res.on("finish", () => fs.remove(jobFolder));

  } catch (err) {
    console.error("Convert error:", err);
    if (!res.headersSent)
      res.status(500).json({ status: "error", message: err.message });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));

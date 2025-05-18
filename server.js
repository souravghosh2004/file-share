const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mime = require("mime");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Store code -> filename & info mapping
const fileMap = new Map();
const fileInfoMap = new Map(); // code => { filename, originalname }

// Helper to generate 6-digit unique code
function generateUniqueCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (fileMap.has(code));
  return code;
}

// Upload route
app.post("/upload", upload.single("file"), (req, res) => {
  const code = generateUniqueCode();
  const filename = req.file.filename;
  const originalname = req.file.originalname;

  fileMap.set(code, filename);
  fileInfoMap.set(code, { filename, originalname });

  // Set 1-hour expiry
  setTimeout(() => {
    const filepath = path.join(__dirname, "uploads", filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    fileMap.delete(code);
    fileInfoMap.delete(code);
  }, 3600000);

  res.json({ code });
});

// Get file info by code (for preview)
app.get("/api/file/:code", (req, res) => {
  const info = fileInfoMap.get(req.params.code);
  if (!info) return res.status(404).json({ error: "Invalid or expired code" });
  res.json({ originalname: info.originalname });
});

// Preview file (inline)
app.get("/download/:code/file", (req, res) => {
  const filename = fileMap.get(req.params.code);
  if (!filename) return res.status(404).send("Invalid or expired code");

  const filepath = path.join(__dirname, "uploads", filename);
  const mimeType = mime.getType(filepath) || "application/octet-stream";
  res.setHeader("Content-Type", mimeType);
  res.sendFile(filepath);
});

// Force download file
app.get("/download/:code/file/download", (req, res) => {
  const filename = fileMap.get(req.params.code);
  if (!filename) return res.status(404).send("Invalid or expired code");

  const filepath = path.join(__dirname, "uploads", filename);
  res.download(filepath, filename);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

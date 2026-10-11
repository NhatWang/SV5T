// forensics-server.js
// Chạy: node forensics-server.js
// Cần: npm install express multer pdf-parse mammoth dotenv cors
// .env cần: GEMINI_API_KEY, GEMINI_MODEL (tùy chọn)

require("dotenv").config();
const express  = require("express");
const multer   = require("multer");
const fs       = require("fs");
const path     = require("path");
const pdfParse = require("pdf-parse");
const mammoth  = require("mammoth");
const cors     = require("cors");

const app  = express();
const PORT = process.env.FORENSICS_PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/forensics-test", (req, res) => {
  res.sendFile(path.join(__dirname, "Public", "forensics-ui.html"));
});

// ── Temp upload dir ───────────────────────────────────────────────────────
const TEMP_DIR = path.join(__dirname, "uploads", "forensics-temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TEMP_DIR),
    filename:    (req, file, cb) =>
      cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cho server test
  fileFilter: (req, file, cb) => {
    const ok = [
      "application/pdf",
      "image/png", "image/jpeg", "image/webp", "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    cb(null, ok.includes(file.mimetype));
  }
});

// ── Đọc file thành content object ────────────────────────────────────────
async function readFile(filePath, mimeType) {
  if (["image/png","image/jpeg","image/webp","image/gif"].includes(mimeType)) {
    return {
      type: "image",
      b64:  fs.readFileSync(filePath).toString("base64"),
      mime: mimeType
    };
  }
  if (mimeType === "application/pdf") {
    const data = await pdfParse(fs.readFileSync(filePath));
    return { type: "text", text: data.text };
  }
  if (mimeType.includes("word")) {
    const result = await mammoth.extractRawText({ path: filePath });
    return { type: "text", text: result.value };
  }
  return { type: "text", text: "" };
}

// ── Forensics prompt ──────────────────────────────────────────────────────
function buildPrompt(textContent) {
  const instructions = `Bạn là chuyên gia phát hiện tài liệu giả mạo. Phân tích tài liệu và tìm 6 dấu hiệu sau:

1. FONT_INCONSISTENCY: Font chữ có đồng nhất không? Chú ý tên người, ngày tháng, số điểm.
2. PIXEL_ARTIFACT: Vùng mờ bất thường, hào quang trắng quanh chữ (AI inpainting), nền không đều quanh text.
3. ALIGNMENT: Dòng text có thẳng hàng không? Có chỗ nào lệch/nghiêng bất thường?
4. LIGHTING: Ánh sáng và bóng đổ có đồng đều không?
5. CONTENT_LOGIC: Tên, ngày tháng, đơn vị, mã số có mâu thuẫn nhau không?
6. COMPRESSION: Vùng nào có mức nén khác hẳn xung quanh (dấu hiệu paste ảnh/text vào)?

Trả về JSON (chỉ JSON, không markdown, không text thừa):
{
  "forgeryScore": <0-100, 0=thật hoàn toàn, 100=chắc chắn giả>,
  "authenticityScore": <100 - forgeryScore>,
  "verdict": <"authentic"|"likely_authentic"|"suspicious"|"likely_forged"|"forged">,
  "signals": [
    {
      "type": <"FONT_INCONSISTENCY"|"PIXEL_ARTIFACT"|"ALIGNMENT"|"LIGHTING"|"CONTENT_LOGIC"|"COMPRESSION">,
      "found": <true|false>,
      "confidence": <0-100>,
      "location": <"vị trí cụ thể trong tài liệu">,
      "detail": <"giải thích chi tiết">
    }
  ],
  "summary": <"tóm tắt 1-2 câu tiếng Việt">,
  "recommendation": <"approve"|"manual_review"|"reject">
}`;

  if (textContent) {
    return instructions + `\n\nNội dung tài liệu:\n---\n${textContent.slice(0, 4000)}\n---`;
  }
  return instructions;
}

// ── Gọi Gemini API ────────────────────────────────────────────────────────
async function callGemini(content) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model  = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  if (!apiKey) throw new Error("Thiếu GEMINI_API_KEY trong .env");

  let parts;
  if (content.type === "image") {
    parts = [
      { inline_data: { mime_type: content.mime, data: content.b64 } },
      { text: buildPrompt() }
    ];
  } else {
    parts = [{ text: buildPrompt(content.text) }];
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ contents: [{ parts }] })
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini lỗi ${resp.status}: ${err.slice(0, 300)}`);
  }

  const data  = await resp.json();
  const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = raw.replace(/```json|```/g, "").match(/\{[\s\S]+\}/);
  if (!match) throw new Error("Gemini không trả về JSON hợp lệ:\n" + raw.slice(0, 300));

  return JSON.parse(match[0]);
}

// ── Cleanup helper ────────────────────────────────────────────────────────
function cleanup(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
}

// ── Routes ────────────────────────────────────────────────────────────────

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    server: "SV5T Forensics Test Server",
    port:    PORT,
    gemini:  !!process.env.GEMINI_API_KEY,
    model:   process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"
  });
});

// Analyze endpoint
app.post("/analyze", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng upload file (field name: 'file')" });
    }

    const { path: filePath, originalname, size, mimetype } = req.file;
    console.log(`\n[${new Date().toLocaleTimeString()}] Analyzing: ${originalname} (${(size/1024).toFixed(1)} KB, ${mimetype})`);

    try {
      const content = await readFile(filePath, mimetype);
      const result  = await callGemini(content);
      cleanup(filePath);

      console.log(`  → verdict: ${result.verdict}, score: ${result.authenticityScore}`);
      console.log(`  → found signals: ${result.signals?.filter(s => s.found).length || 0}/${result.signals?.length || 0}`);

      return res.json({
        success:   true,
        fileName:  originalname,
        fileSize:  size,
        mimeType:  mimetype,
        forensics: result
      });

    } catch (error) {
      cleanup(filePath);
      console.error(`  → ERROR: ${error.message}`);
      return res.status(500).json({ success: false, message: error.message });
    }
  });
});

// Start
app.listen(PORT, () => {
  console.log("╔════════════════════════════════════════╗");
  console.log(`║  SV5T Forensics Server                 ║`);
  console.log(`║  http://localhost:${PORT}                  ║`);
  console.log(`║  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "✓ OK" : "✗ MISSING"}               ║`);
  console.log(`║  Model: ${(process.env.GEMINI_MODEL || "gemini-2.5-flash-lite").padEnd(30)}║`);
  console.log("╚════════════════════════════════════════╝");
  console.log("\nEndpoints:");
  console.log("  GET  /          → health check");
  console.log("  POST /analyze   → upload file, trả về forensics JSON");
});

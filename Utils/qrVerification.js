const Jimp = require("jimp");
const jsQR = require("jsqr");
const { PDFParse } = require("pdf-parse");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { callAzureOpenAIWithImage } = require("./azureAI");

// Remove Vietnamese diacritics for loose matching
function normalizeVi(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/\s+/g, " ")
    .trim();
}

async function readQRFromImage(imagePath) {
  try {
    const image = await Jimp.read(imagePath);
    const data = new Uint8ClampedArray(image.bitmap.data);
    const code = jsQR(data, image.bitmap.width, image.bitmap.height);
    return code ? code.data : null;
  } catch {
    return null;
  }
}

function isDriveUrl(url) {
  return (
    url.includes("drive.google.com") ||
    url.includes("docs.google.com") ||
    url.includes("sheets.google.com") ||
    url.includes("forms.google.com")
  );
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8"
};

// Extract destination URL from HTML (handles JS redirects & meta refresh)
function extractUrlFromHtml(html) {
  const googleMatch = html.match(
    /https?:\/\/(?:drive|docs|sheets|forms)\.google\.com\/[^\s"'<>\\]+/
  );
  if (googleMatch) return googleMatch[0].replace(/\\u002F/g, "/").replace(/\\/g, "");

  const metaMatch =
    html.match(/http-equiv=["']refresh["'][^>]+url=["']?([^"'\s>]+)/i) ||
    html.match(/url=["']?([^"'\s>]+)[^>]+http-equiv=["']refresh/i);
  if (metaMatch) return metaMatch[1];

  const jsMatch = html.match(
    /(?:window\.location(?:\.href)?|location\.(?:replace|assign))\s*[=(]\s*["']([^"']+)["']/
  );
  if (jsMatch) return jsMatch[1];

  return null;
}

// Follow HTTP redirects then parse HTML for JS/meta redirects
async function resolveUrl(url) {
  let current = url;

  try {
    const res = await fetch(current, {
      method: "HEAD",
      redirect: "follow",
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000)
    });
    if (res.url) current = res.url;
  } catch {
    try {
      const res = await fetch(current, {
        redirect: "follow",
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(8000)
      });
      if (res.url) current = res.url;
    } catch {}
  }

  if (isDriveUrl(current)) return current;

  // Fetch HTML and look for embedded Drive URL or JS redirect
  try {
    const res = await fetch(current, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(8000)
    });
    const html = await res.text();
    const found = extractUrlFromHtml(html);
    if (found) return found;
  } catch {}

  return current;
}

function extractFolderIdFromUrl(url) {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function extractFileIdFromUrl(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function isQDCNFile(name) {
  const n = normalizeVi(name);
  return (
    n.includes("qdcn") ||
    n.includes("quyet dinh cong nhan") ||
    (n.includes("quyet dinh") && n.includes("cong nhan"))
  );
}

// Fallback: scrape Drive folder page HTML to extract file IDs (no API key needed)
async function listDriveFolderByHtml(folderId) {
  const url = `https://drive.google.com/drive/folders/${folderId}`;
  const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
  const html = await res.text();

  const ids = new Set();
  for (const m of html.matchAll(/data-id="([a-zA-Z0-9_-]{25,})"/g)) {
    if (m[1] !== folderId) ids.add(m[1]);
  }

  if (ids.size === 0) throw new Error("Không tìm thấy file nào trong folder Drive");

  return [...ids].map((id) => ({ id, name: "", mimeType: "application/pdf" }));
}

async function listDriveFolder(folderId) {
  const key = process.env.GOOGLE_API_KEY;

  if (key) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      return data.files || [];
    }
    if (res.status !== 403) {
      const body = await res.text();
      throw new Error(`Drive API lỗi ${res.status}: ${body.slice(0, 200)}`);
    }
    console.warn("⚠️ Drive API key bị giới hạn IP, dùng phương án dự phòng HTML");
  }

  return listDriveFolderByHtml(folderId);
}

async function downloadDriveFile(fileId) {
  const key = process.env.GOOGLE_API_KEY;

  if (key) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status !== 403) throw new Error(`Download Drive file lỗi ${res.status}`);
    console.warn("⚠️ Drive download API key bị giới hạn IP, dùng direct URL");
  }

  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Direct Drive download lỗi ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Parse PDF: try text extraction first, fall back to Azure Vision OCR for scanned PDFs
async function extractTextFromPdf(pdfBuffer, studentId, studentName) {
  const tmpPath = path.join(os.tmpdir(), `qr_verify_${Date.now()}.pdf`);
  try {
    fs.writeFileSync(tmpPath, pdfBuffer);
    const parser = new PDFParse({ url: `file://${tmpPath}`, verbosity: 0 });
    await parser.load();

    // Try text extraction first
    const textResult = await parser.getText();
    const rawText = textResult?.text || "";
    // Strip pagination markers emitted by scanned PDFs ("-- 1 of 10 --") before checking
    const extractedText = rawText.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim();
    if (extractedText.length > 50) {
      return { text: extractedText, method: "text" };
    }

    // Scanned PDF → getScreenshot returns ALL pages at once
    console.log("📷 PDF scan detected, using Azure Vision OCR...");
    const shot = await parser.getScreenshot({ scale: 1.0 });
    const allPages = shot?.pages || [];

    // Skip page 1 (usually the official decision text, not the student list)
    const listPages = allPages.slice(1);

    // Ask Vision to extract all MSSV numbers → programmatic match (more reliable than yes/no)
    const ocrPrompt = `You are an OCR assistant reading a scanned Vietnamese student list table.
The table has columns: STT (index), MSSV (8-digit student ID), Ho va ten (full name), Khoa (faculty).
Extract ALL 8-digit MSSV numbers visible in this image.
Return ONLY the numbers separated by commas, no other text. Example: 24147014,23200049,24125021`;

    for (const pageData of listPages) {
      try {
        if (!pageData?.dataUrl) continue;
        const base64 = pageData.dataUrl.split(",")[1];
        const answer = await callAzureOpenAIWithImage({
          system: ocrPrompt,
          base64Image: base64,
          mimeType: "image/png",
          maxTokens: 400
        });
        if (!answer) continue;
        // Extract all 8-digit numbers from the response
        const foundIds = (answer.match(/\d{8}/g) || []);
        if (foundIds.includes(studentId)) {
          console.log(`🔍 Vision OCR: found ${studentId} on page ${pageData.pageNumber}`);
          return { text: "FOUND_BY_VISION", method: "vision", foundPage: pageData.pageNumber };
        }
      } catch (e) {
        console.warn(`⚠️ Vision OCR page ${pageData?.pageNumber} error: ${e.message}`);
      }
    }

    return { text: "", method: "vision_not_found" };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

// Main entry point: call with local image path + student record {fullName, studentId}
async function verifyEvidenceQR(imagePath, student) {
  const result = {
    hasQR: false,
    qrUrl: "",
    driveFolderId: "",
    pdfFileId: "",
    pdfFileName: "",
    studentNameFound: false,
    studentIdFound: false,
    verifiedAt: null,
    error: ""
  };

  try {
    const qrContent = await readQRFromImage(imagePath);
    if (!qrContent) return result;

    result.hasQR = true;
    result.qrUrl = qrContent;

    // Resolve shortened links → final Drive URL
    const resolvedUrl = isDriveUrl(qrContent) ? qrContent : await resolveUrl(qrContent);

    if (!isDriveUrl(resolvedUrl)) {
      result.error = `QR không trỏ tới Google Drive (resolved: ${resolvedUrl.slice(0, 120)})`;
      return result;
    }

    const fullName = student?.fullName || "";
    const studentId = student?.studentId || "";

    const folderId = extractFolderIdFromUrl(resolvedUrl);

    // Build ordered candidate list (QĐCN-named PDFs first, then rest)
    let candidates = [];
    if (folderId) {
      result.driveFolderId = folderId;
      const files = await listDriveFolder(folderId);
      if (!files.length) {
        result.error = "Không tìm thấy file nào trong folder Drive";
        return result;
      }
      const named = files.filter((f) => f.name && isQDCNFile(f.name));
      const rest = files.filter((f) => !f.name || !isQDCNFile(f.name));
      candidates = [...named, ...rest];
    } else {
      const fileId = extractFileIdFromUrl(resolvedUrl);
      if (!fileId) {
        result.error = "Không tìm thấy file ID trong link Google Drive";
        return result;
      }
      candidates = [{ id: fileId, name: "" }];
    }

    // Try each candidate file
    for (const file of candidates.slice(0, 5)) {
      let buf;
      try {
        buf = await downloadDriveFile(file.id);
      } catch (e) {
        console.warn(`⚠️ Download file ${file.id} failed: ${e.message}`);
        continue;
      }

      // Must start with %PDF
      if (!buf || buf.slice(0, 4).toString() !== "%PDF") continue;

      try {
        const { text, method } = await extractTextFromPdf(buf, studentId, fullName);

        result.pdfFileId = file.id;
        result.pdfFileName = file.name || "";

        if (method === "vision") {
          // Vision confirmed found
          result.studentNameFound = true;
          result.studentIdFound = true;
        } else if (text.length > 10) {
          const normalizedPdf = normalizeVi(text);
          if (fullName) result.studentNameFound = normalizedPdf.includes(normalizeVi(fullName));
          if (studentId) result.studentIdFound = text.includes(studentId);
        } else {
          continue; // empty result, try next file
        }

        result.verifiedAt = new Date();
        break;
      } catch (e) {
        console.warn(`⚠️ Parse file ${file.id} error: ${e.message}`);
      }
    }

    if (!result.verifiedAt && !result.error) {
      result.error = "Không tìm thấy file PDF hợp lệ trong folder Drive";
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

module.exports = { verifyEvidenceQR };

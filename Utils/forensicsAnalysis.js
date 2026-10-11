// Utils/forensicsAnalysis.js
// Phát hiện ảnh minh chứng có dấu hiệu chỉnh sửa (Photoshop/Canva/AI inpainting).
// Kết hợp 2 tín hiệu độc lập:
//   1. ELA (Error Level Analysis) tất định: nén lại ảnh ở mức chất lượng cố định
//      và so sánh sai khác pixel — vùng bị dán/chỉnh sửa thường nén khác vùng gốc.
//   2. AI thị giác (Azure OpenAI vision): kiểm tra tính đồng nhất font chữ, canh lề,
//      ánh sáng và logic nội dung.
// Đây CHỈ LÀ TÍN HIỆU CẢNH BÁO cho admin xem xét — không tự động từ chối minh chứng.

const fs = require("fs");
const Jimp = require("jimp");

const { callAzureOpenAIWithImage, safeParseAiJson } = require("./azureAI");

const ELA_QUALITY = 90;
const ELA_HOT_PIXEL_DIFF_THRESHOLD = 25;
const FORGERY_SUSPICION_THRESHOLD = 45; // 0-100

/**
 * Tính điểm ELA tất định cho một ảnh: nén lại ở quality cố định rồi so sánh
 * sai khác pixel với bản gốc. Vùng dán/chỉnh sửa thường có mức nén khác biệt
 * rõ rệt so với phần ảnh gốc xung quanh.
 */
async function computeElaScore(filePath) {
  try {
    const original = await Jimp.read(filePath);
    const width = original.bitmap.width;
    const height = original.bitmap.height;
    const totalPixels = width * height;

    if (totalPixels === 0) {
      return { elaScore: 0, avgDiff: 0, hotRatio: 0 };
    }

    const recompressedBuffer = await original
      .clone()
      .quality(ELA_QUALITY)
      .getBufferAsync(Jimp.MIME_JPEG);

    const recompressed = await Jimp.read(recompressedBuffer);

    let totalDiff = 0;
    let hotPixels = 0;

    original.scan(0, 0, width, height, function (x, y, idx) {
      const rDiff = Math.abs(this.bitmap.data[idx] - recompressed.bitmap.data[idx]);
      const gDiff = Math.abs(this.bitmap.data[idx + 1] - recompressed.bitmap.data[idx + 1]);
      const bDiff = Math.abs(this.bitmap.data[idx + 2] - recompressed.bitmap.data[idx + 2]);
      const diff = (rDiff + gDiff + bDiff) / 3;

      totalDiff += diff;
      if (diff > ELA_HOT_PIXEL_DIFF_THRESHOLD) hotPixels += 1;
    });

    const avgDiff = totalDiff / totalPixels;
    const hotRatio = hotPixels / totalPixels;

    // Điểm nghi vấn 0-100, kết hợp sai khác trung bình và tỉ lệ vùng "nóng".
    const elaScore = Math.max(
      0,
      Math.min(100, Math.round(avgDiff * 2 + hotRatio * 300))
    );

    return {
      elaScore,
      avgDiff: Number(avgDiff.toFixed(2)),
      hotRatio: Number(hotRatio.toFixed(4))
    };
  } catch (error) {
    console.error("computeElaScore error:", error.message);
    return { elaScore: 0, avgDiff: 0, hotRatio: 0, error: error.message };
  }
}

function buildForensicsPrompt() {
  return `Bạn là chuyên gia giám định tài liệu, hỗ trợ cán bộ Đoàn - Hội SÀNG LỌC SƠ BỘ ảnh minh chứng.
Vai trò của bạn CHỈ LÀ TRỢ LÝ ĐỀ XUẤT (Copilot) — không phải người quyết định cuối cùng.
Cán bộ chi Hội sẽ xem lại và tự quyết định duyệt hay từ chối.

Hãy phân tích ảnh và tìm các dấu hiệu chỉnh sửa (Photoshop/Canva/AI inpainting):
1. FONT_INCONSISTENCY: Font chữ có đồng nhất không? Chú ý tên người, ngày tháng, số điểm, con dấu.
2. PIXEL_ARTIFACT: Vùng mờ bất thường, hào quang trắng quanh chữ, nền không đều quanh vùng text.
3. ALIGNMENT: Dòng text có thẳng hàng không? Có chỗ nào lệch/nghiêng bất thường so với phần còn lại?
4. LIGHTING: Ánh sáng và bóng đổ trên toàn ảnh có đồng đều không?
5. CONTENT_LOGIC: Tên, ngày tháng, đơn vị, mã số có mâu thuẫn nhau trong nội dung không?

Trả về JSON (chỉ JSON, không markdown, không giải thích thêm):
{
  "forgeryScore": 0-100 (0 = ảnh gốc hoàn toàn, 100 = chắc chắn đã chỉnh sửa),
  "signals": [
    {
      "type": "FONT_INCONSISTENCY" | "PIXEL_ARTIFACT" | "ALIGNMENT" | "LIGHTING" | "CONTENT_LOGIC",
      "found": true hoặc false,
      "confidence": 0-100,
      "location": "vị trí cụ thể trong ảnh",
      "detail": "giải thích ngắn gọn"
    }
  ],
  "summary": "tóm tắt 1-2 câu bằng tiếng Việt"
}`;
}

/**
 * Phân tích forensics cho một ảnh minh chứng (PNG/JPEG).
 * Không bao giờ throw — luôn trả về object để không chặn luồng upload chính.
 */
async function analyzeImageForensics(filePath, mimeType) {
  const elaResult = await computeElaScore(filePath);

  let aiForensics = null;
  let aiError = "";

  try {
    const base64Image = fs.readFileSync(filePath).toString("base64");

    const text = await callAzureOpenAIWithImage({
      system: buildForensicsPrompt(),
      base64Image,
      mimeType,
      maxTokens: 700
    });

    aiForensics = safeParseAiJson(text);
  } catch (error) {
    aiError = error.message;
    console.error("AI forensics analysis error:", error.message);
  }

  const aiForgeryScore = Number(aiForensics?.forgeryScore || 0);
  const forgeryScore = Math.max(elaResult.elaScore || 0, aiForgeryScore || 0);

  const warningFlags = [];

  if ((elaResult.elaScore || 0) >= FORGERY_SUSPICION_THRESHOLD) {
    warningFlags.push("forensics_ela_high_variance");
  }

  const foundSignals = Array.isArray(aiForensics?.signals)
    ? aiForensics.signals.filter((signal) => signal?.found === true)
    : [];

  foundSignals.forEach((signal) => {
    if (signal?.type) {
      warningFlags.push(`forensics_${String(signal.type).toLowerCase()}`);
    }
  });

  return {
    ranAt: new Date(),
    elaScore: elaResult.elaScore || 0,
    aiForgeryScore,
    forgeryScore,
    suspected: forgeryScore >= FORGERY_SUSPICION_THRESHOLD,
    signals: Array.isArray(aiForensics?.signals) ? aiForensics.signals : [],
    summary: aiForensics?.summary || "",
    warningFlags,
    error: aiError
  };
}

module.exports = {
  FORGERY_SUSPICION_THRESHOLD,
  computeElaScore,
  analyzeImageForensics
};

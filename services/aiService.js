// services/aiService.js
// Gọi AI (Azure OpenAI) để phân tích minh chứng, chuẩn hóa kết quả trả về,
// và ghi log lại mọi lần AI xử lý (AIReviewLog) để admin/tra soát sau này.

const fs = require("fs");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

const AIReviewLog = require("../Models/AIReviewLog");

const { buildEvidencePrompt } = require("../Utils/aiPrompts/index");

const {
  callAzureOpenAI,
  callAzureOpenAIWithImage,
  safeParseAiJson
} = require("../Utils/azureAI");

// BẮT BUỘC: AI tuyệt đối không được tự động duyệt (ai_valid/partial_valid) khi
// chưa xác nhận được minh chứng thuộc về đúng sinh viên đang upload. Mọi trường
// hợp matchesCurrentStudent !== "true" (kể cả "unknown") phải chuyển manual_review.
function isStudentIdentityConfirmed(aiResult) {
  return aiResult?.verification?.matchesCurrentStudent === "true";
}

function getEmptyAiResult(reason) {
  return {
    isValid: null,
    confidence: 0,

    matchedType: "",
    subCriteria: "",

    academicEvidenceType: "",
    academicActivityCount: 0,

    volunteerDays: 0,
    volunteerActivityName: "",
    hasVolunteerAward: false,

    kyNangEvidenceType: "",
    foreignLanguageEvidenceType: "",
    hoiNhapEvidenceType: "",
    awardRank: "",
    organizerLevel: "",

    // Dùng cho tab Khác - minh chứng SV5T các năm trước
    sv5tHistoryType: "",
    sv5tHistoryLevel: "",
    sv5tHistoryYears: [],
    consecutiveYears: 0,
    issuer: "",
    awardTitle: "",

    extractedText: "",
    matchedEvidence: [],
    missingInfo: [],

    // AI v2 fields
    promptVersion: "",
    evidenceType: "",
    matchedCategory: "",
    matchedSubCriteria: [],
    decision: "",
    warningFlags: [],

    extractedInfo: {
      studentName: "",
      studentId: "",
      className: "",
      faculty: "",
      university: "",
      activityName: "",
      organizer: "",
      issueDate: "",
      semester: "",
      academicYear: "",
      score: "",
      volunteerDays: 0,
      achievement: ""
    },

    verification: {
      hasStudentIdentity: false,
      hasOrganizer: false,
      hasDate: false,
      hasAchievement: false,
      matchesCurrentStudent: "unknown"
    },

    reason: reason || ""
  };
}

function normalizeAiResult(aiResult) {
  return {
    isValid: aiResult?.isValid ?? null,
    confidence: Number(aiResult?.confidence || 0),
    matchedType: aiResult?.matchedType ?? "",

    subCriteria: aiResult?.subCriteria ?? "",

    academicEvidenceType: aiResult?.academicEvidenceType ?? "",
    academicActivityCount: Number(aiResult?.academicActivityCount || 0),

    volunteerDays: Number(aiResult?.volunteerDays || 0),
    volunteerActivityName: aiResult?.volunteerActivityName ?? "",
    hasVolunteerAward: aiResult?.hasVolunteerAward ?? false,

    kyNangEvidenceType: aiResult?.kyNangEvidenceType ?? "",
    foreignLanguageEvidenceType: aiResult?.foreignLanguageEvidenceType ?? "",
    hoiNhapEvidenceType: aiResult?.hoiNhapEvidenceType ?? "",
    awardRank: aiResult?.awardRank ?? "",
    organizerLevel: aiResult?.organizerLevel ?? "",

    // Dùng cho tab Khác
    sv5tHistoryType:
      aiResult?.sv5tHistoryType ||
      aiResult?.matchedType ||
      "",
    sv5tHistoryLevel: aiResult?.sv5tHistoryLevel ?? "",
    sv5tHistoryYears: Array.isArray(aiResult?.sv5tHistoryYears)
      ? aiResult.sv5tHistoryYears
      : [],
    consecutiveYears: Number(aiResult?.consecutiveYears || 0),
    issuer: aiResult?.issuer ?? "",
    awardTitle: aiResult?.awardTitle ?? "",

    extractedText: aiResult?.extractedText ?? "",
    matchedEvidence: Array.isArray(aiResult?.matchedEvidence)
      ? aiResult.matchedEvidence
      : [],
    missingInfo: Array.isArray(aiResult?.missingInfo)
      ? aiResult.missingInfo
      : [],

    promptVersion: aiResult?.promptVersion ?? "",
    evidenceType: aiResult?.evidenceType ?? "",
    matchedCategory: aiResult?.matchedCategory ?? "",
    matchedSubCriteria: Array.isArray(aiResult?.matchedSubCriteria)
      ? aiResult.matchedSubCriteria
      : [],

    decision: aiResult?.decision ?? "",

    warningFlags: Array.isArray(aiResult?.warningFlags)
      ? aiResult.warningFlags
      : [],

    extractedInfo: {
      studentName: aiResult?.extractedInfo?.studentName ?? "",
      studentId: aiResult?.extractedInfo?.studentId ?? "",
      className: aiResult?.extractedInfo?.className ?? "",
      faculty: aiResult?.extractedInfo?.faculty ?? "",
      university: aiResult?.extractedInfo?.university ?? "",
      activityName: aiResult?.extractedInfo?.activityName ?? "",
      organizer: aiResult?.extractedInfo?.organizer ?? "",
      issueDate: aiResult?.extractedInfo?.issueDate ?? "",
      semester: aiResult?.extractedInfo?.semester ?? "",
      academicYear: aiResult?.extractedInfo?.academicYear ?? "",
      score: aiResult?.extractedInfo?.score ?? "",
      volunteerDays: Number(aiResult?.extractedInfo?.volunteerDays || 0),
      achievement: aiResult?.extractedInfo?.achievement ?? ""
    },

    verification: {
      hasStudentIdentity: aiResult?.verification?.hasStudentIdentity === true,
      hasOrganizer: aiResult?.verification?.hasOrganizer === true,
      hasDate: aiResult?.verification?.hasDate === true,
      hasAchievement: aiResult?.verification?.hasAchievement === true,
      matchesCurrentStudent:
        aiResult?.verification?.matchesCurrentStudent === "true" ||
        aiResult?.verification?.matchesCurrentStudent === true
          ? "true"
          : aiResult?.verification?.matchesCurrentStudent === "false" ||
            aiResult?.verification?.matchesCurrentStudent === false
          ? "false"
          : "unknown"
    },

    reason:
      aiResult?.reason ||
      "AI đã xử lý nhưng không trả lý do cụ thể. Cần admin kiểm tra thủ công."
  };
}

async function createAIReviewLog({
  studentId,
  evidenceId,
  category,
  awardLevel,
  inputType,
  extractedTextLength = 0,
  statusBefore = "",
  statusAfter = "",
  rawResponse = "",
  parsedResult = null,
  errorMessage = ""
}) {
  try {
    await AIReviewLog.create({
      studentId,
      evidenceId,
      category,
      awardLevel,
      model: process.env.AZURE_FOUNDRY_MODEL || "",
      promptVersion: parsedResult?.promptVersion || "",
      inputType,
      extractedTextLength,
      statusBefore,
      statusAfter,
      rawResponse: String(rawResponse || "").slice(0, 8000),
      parsedResult,
      errorMessage
    });
  } catch (logError) {
    console.error("Create AIReviewLog error:", logError.message);
  }
}

async function extractTextFromFile(filePath, fileType) {
  try {
    if (fileType === "application/pdf") {
      const parser = new PDFParse({ url: `file://${filePath}`, verbosity: 0 });
      await parser.load();
      const result = await parser.getText();
      return result?.text?.trim() || "";
    }

    if (
      fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileType === "application/msword"
    ) {
      const result = await mammoth.extractRawText({
        path: filePath
      });

      return result.value?.trim() || "";
    }

    return "";
  } catch (error) {
    console.error("extractTextFromFile error:", error.message);
    return "";
  }
}

async function analyzeEvidenceWithAI(
  filePath,
  fileType,
  category,
  awardLevel = "truong",
  studentContext = {}
) {
  try {
    // ── Xử lý ảnh: dùng OpenAI vision ────────────────────────────────────
    if (fileType === "image/png" || fileType === "image/jpeg") {
      const imageData = fs.readFileSync(filePath);
      const base64Image = imageData.toString("base64");

      const prompt = buildEvidencePrompt({
        category,
        awardLevel,
        studentContext
      });

      if (!prompt) return null;

      const text = await callAzureOpenAIWithImage({
        system: prompt,
        base64Image,
        mimeType: fileType,
        maxTokens: 1024
      });

      const parsed = safeParseAiJson(text);

      if (!parsed) {
        return {
          ...getEmptyAiResult("AI đã phản hồi nhưng không đúng định dạng JSON. Cần admin kiểm tra thủ công."),
          extractedText: text,
          rawResponse: text
        };
      }

      return {
        ...parsed,
        rawResponse: text
      };
    }

    // ── Xử lý PDF / DOCX: extract text rồi gửi lên OpenAI ────────────────
    const extractedText = await extractTextFromFile(filePath, fileType);

    if (!extractedText || extractedText.length < 20) {
      const unreadableReason =
        fileType === "application/pdf"
          ? "File PDF có thể là bản scan/ảnh nên hệ thống chưa đọc được nội dung tự động. Vui lòng upload ảnh JPG/PNG rõ nét hoặc để admin kiểm tra thủ công."
          : fileType === "application/msword"
          ? "File DOC cũ có thể không đọc được tự động. Vui lòng đổi sang DOCX/PDF hoặc để admin kiểm tra thủ công."
          : "File không có nội dung text hoặc không đọc được nội dung. Cần admin xem xét thủ công.";

      return getEmptyAiResult(unreadableReason);
    }

    const textToSend =
      extractedText.length > 3000
        ? extractedText.substring(0, 3000) + "\n...(nội dung đã rút gọn)"
        : extractedText;

    const prompt = buildEvidencePrompt({
      category,
      awardLevel,
      studentContext
    });

    if (!prompt) return null;

    // Chống prompt injection: KHÔNG nối nội dung file vào system prompt.
    // Nội dung file luôn nằm trong message "user", bọc trong thẻ XML rõ ràng.
    const text = await callAzureOpenAI({
      system: prompt,
      messages: [{
        role: "user",
        content: `<user_document>\n${textToSend}\n</user_document>\nPhân tích tài liệu bên trong thẻ XML trên và trả về JSON theo đúng schema đã yêu cầu.`
      }],
      maxTokens: 1024,
      temperature: 0.2
    });

    const parsed = safeParseAiJson(text);

    if (!parsed) {
      return {
        ...getEmptyAiResult("AI đã phản hồi nhưng không đúng định dạng JSON. Cần admin kiểm tra thủ công."),
        extractedText,
        rawResponse: text
      };
    }

    return {
      ...parsed,
      extractedText,
      rawResponse: text
    };
  } catch (error) {
    console.error("analyzeEvidenceWithAI error:", error.message);
    return getEmptyAiResult(
      "Có lỗi khi kết nối hoặc xử lý AI. Cần admin kiểm tra thủ công."
    );
  }
}

module.exports = {
  isStudentIdentityConfirmed,
  getEmptyAiResult,
  normalizeAiResult,
  createAIReviewLog,
  extractTextFromFile,
  analyzeEvidenceWithAI
};

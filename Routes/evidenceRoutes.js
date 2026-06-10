const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

const Evidence = require("../Models/Evidence");
const Student = require("../Models/Student");
const AIReviewLog = require("../Models/AIReviewLog");

const { requireStudentAuth, requireAdminAuth, requireSuperAdmin } = require("../Middlewares/authMiddleware");

const {
  buildEvidenceKey,
  uploadLocalFileToR2
} = require("../Utils/r2Client");

const {
  recomputeHocTapProgress,
  recomputeTinhNguyenProgress,
  recomputeHoiNhapProgress
} = require("../Utils/progressRecompute");

const {
  normalizeAwardLevel,
  getAwardLevelLabel,
  isHigherAwardLevel
} = require("../Utils/sv5tLevels");

const {
  buildEvidencePrompt,
  containsMockTestKeyword
} = require("../Utils/aiPrompts/index");

const {
  buildStudentContext,
  normalizeAiV2Result,
  applyAiSafetyRules
} = require("../Utils/aiDecisionEngine");

const {
  sendPushToAdminsForClass
} = require("../Utils/pushService");

const { verifyEvidenceQR } = require("../Utils/qrVerification");

const {
  callAzureOpenAI,
  callAzureOpenAIWithImage,
  safeParseAiJson
} = require("../Utils/azureAI");

const router = express.Router();

// ─────────────────────────────────────────
// 1. CẤU HÌNH MULTER
// ─────────────────────────────────────────

const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg"
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const TEMP_UPLOAD_DIR = "uploads/evidence-temp/";

if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, {
    recursive: true
  });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TEMP_UPLOAD_DIR);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: function (req, file, cb) {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file PDF, DOC, DOCX, PNG, JPG hoặc JPEG"));
    }
  }
});

function uploadEvidenceMiddleware(req, res, next) {
  const handler = upload.single("evidence");

  handler(req, res, function (err) {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File vượt quá 2 MB. Vui lòng chọn file nhỏ hơn."
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || "File upload không hợp lệ"
      });
    }

    next();
  });
}

// ─────────────────────────────────────────
// 2. HẰNG SỐ & DỮ LIỆU
// ─────────────────────────────────────────

const categoryLabels = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt",
  khac: "Khác"
};

// Tiêu chí tự khai, không nên upload minh chứng qua route này
const SELF_DECLARE_CATEGORIES = ["daoDucTot"];

const B1_EQUIVALENTS = {
  IELTS: {
    minScore: 4.5,
    note: "IELTS 4.5 trở lên = B1"
  },
  TOEFL: {
    minScore: 35,
    note: "TOEFL iBT 35 trở lên = B1"
  },
  TOEIC: {
    minScore: 401,
    note: "TOEIC (Nghe+Đọc) 401 trở lên = B1"
  },
  "VNU-EPT": {
    minScore: 201,
    note: "VNU-EPT 7-B1 (201-225 điểm) trở lên = B1"
  },
  DELF: {
    level: "B1",
    note: "DELF B1 trở lên"
  },
  TCF: {
    level: "niveau 3",
    note: "TCF niveau 3 trở lên = B1"
  },
  GOETHE: {
    level: "B1",
    note: "Goethe B1 trở lên"
  },
  HSK: {
    minScore: 3,
    note: "HSK cấp độ 3 trở lên = B1"
  },
  JLPT: {
    level: "N4",
    note: "JLPT N4 trở lên = B1"
  },
  TOPIK: {
    level: "II level 3",
    note: "TOPIK II level 3 trở lên = B1"
  },
  TRKI: {
    level: "1",
    note: "TRKI 1 trở lên = B1"
  }
};

const officialCriteria = {
  theLucTot: {
    minhChung: [
      "Giấy chứng nhận Thanh niên khỏe từ cấp Trường",
      "Giấy chứng nhận/huy chương thi đấu thể thao từ cấp Khoa trở lên (không tính thể thao điện tử)",
      "Xác nhận tham gia ít nhất 3 hoạt động CLB Thể dục-Thể thao (có chữ ký BCN CLB và BCH Liên chi Hội)",
      "Giấy chứng nhận luyện tập tại trung tâm thể dục-thể thao (tối thiểu 3 tháng)",
      "Hóa đơn tham gia + minh chứng hình ảnh tập Gym/Yoga (tối thiểu 3 tháng, thể hiện rõ trong hóa đơn)"
    ],
    luuY: [
      "Thời gian tối thiểu 3 tháng phải được thể hiện rõ trên giấy tờ",
      "Giải thể thao điện tử không được tính",
      "CLB phải từ cấp Khoa trở lên"
    ]
  },

  tinhNguyenTot: {
    minhChung: [
      "Xác nhận số ngày tình nguyện từ BCH Hội Sinh viên Trường hoặc Liên chi Hội (ít nhất 5 ngày trong năm học)",
      "Giấy khen về hoạt động tình nguyện từ cấp Trường trở lên",
      "Giấy chứng nhận tham gia chiến dịch Mùa hè xanh / Xuân tình nguyện / Tiếp sức mùa thi",
      "Giấy chứng nhận hiến máu nhân đạo"
    ],
    luuY: [
      "Phải có chữ ký và dấu xác nhận của BCH Hội Sinh viên Trường hoặc Liên chi Hội",
      "Số ngày tình nguyện tính theo Hướng dẫn hiện hành của BCH Hội Sinh viên Việt Nam Trường"
    ]
  },

  hoiNhapTot: {
    ngoaiNgu: {
      minhChung: [
        "Tiếng Anh: IELTS 4.5+, TOEFL iBT 35+, TOEIC 401+, VNU-EPT 201+ (7-B1)",
        "Tiếng Pháp: DELF B1 / TCF niveau 3 trở lên",
        "Tiếng Đức: Goethe B1 trở lên",
        "Tiếng Trung: HSK cấp độ 3 trở lên",
        "Tiếng Nhật: JLPT N4 trở lên",
        "Tiếng Hàn: TOPIK II level 3 trở lên",
        "Tiếng Nga: TRKI 1 trở lên",
        "Chứng chỉ phải còn hiệu lực tại thời điểm xét danh hiệu"
      ]
    },

    kyNang: {
      minhChung: [
        "Giấy chứng nhận hoàn thành ít nhất 1 khóa kỹ năng thực hành xã hội",
        "Giải thưởng cuộc thi về kỹ năng từ cấp Khoa trở lên",
        "Xác nhận là báo cáo viên lớp kỹ năng từ cấp Khoa"
      ]
    },

    hoiNhap: {
      minhChung: [
        "Giấy chứng nhận tham gia hoạt động giao lưu quốc tế",
        "Xác nhận là thành viên chính thức chương trình giao lưu với sinh viên quốc tế",
        "Giấy khen từ cấp Trường về công tác Đoàn/Hội",
        "Giấy chứng nhận/kết quả vòng Chung kết cuộc thi thủ lĩnh sinh viên cấp Trường"
      ]
    }
  }
};

// ─────────────────────────────────────────
// 3. HELPER FUNCTIONS
// ─────────────────────────────────────────

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
  contentDescription: "Hãy đọc toàn bộ nội dung văn bản trong ảnh và phân tích tài liệu:",
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
  contentDescription: `Nội dung file:\n---\n${textToSend}\n---`,
  awardLevel,
  studentContext
});

    if (!prompt) return null;

    const text = await callAzureOpenAI({
      system: prompt,
      messages: [{ role: "user", content: "Phân tích tài liệu trên và trả về JSON." }],
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

async function updateStudentProgress(studentId, category) {
  try {
    const student = await Student.findOne({
      studentId
    });

    if (!student || !student.sv5tProgress?.[category]) return;

    const progress = student.sv5tProgress[category];

    const previousCompletedBy = progress.completedBy || "none";

    progress.isCompleted = true;

    if (!progress.completedAt) {
      progress.completedAt = new Date();
    }

    if (
      previousCompletedBy === "activity" ||
      previousCompletedBy === "admin"
    ) {
      progress.completedBy = "activity_and_evidence";
    } else if (
      previousCompletedBy === "student_declare" ||
      previousCompletedBy === "student_declare_and_evidence"
    ) {
      progress.completedBy = "student_declare_and_evidence";
    } else if (
      previousCompletedBy === "activity_and_evidence"
    ) {
      progress.completedBy = "activity_and_evidence";
    } else {
      progress.completedBy = "evidence";
    }

    const allCategories = [
      "daoDucTot",
      "hocTapTot",
      "theLucTot",
      "tinhNguyenTot",
      "hoiNhapTot"
    ];

    let completed = 0;

    allCategories.forEach((c) => {
      if (student.sv5tProgress[c]?.isCompleted) {
        completed += 1;
      }
    });

    student.totalCompletedCriteria = completed;
    student.progressPercent = Math.round((completed / 5) * 100);

    student.sv5tStatus =
      completed === 0
        ? "not_started"
        : completed < 5
        ? "in_progress"
        : "completed";

    await student.save();
  } catch (error) {
    console.error("updateStudentProgress error:", error.message);
  }
}

async function archiveEvidenceToR2(evidence) {
  if (!evidence) return null;

  if (evidence.storageStatus === "r2_archived" && evidence.fileUrl) {
    return evidence;
  }

  if (!evidence.filePath || !fs.existsSync(evidence.filePath)) {
    evidence.storageStatus = "none";
    await evidence.save();
    return evidence;
  }

  const fileKey = buildEvidenceKey(evidence.studentId, evidence.fileName);

  const uploadedFile = await uploadLocalFileToR2({
    localPath: evidence.filePath,
    key: fileKey,
    contentType: evidence.fileType
  });

  evidence.fileKey = uploadedFile.key;
  evidence.fileUrl = uploadedFile.url;
  evidence.storageStatus = "r2_archived";

  if (fs.existsSync(evidence.filePath)) {
    fs.unlinkSync(evidence.filePath);
  }

  evidence.filePath = "";

  await evidence.save();

  return evidence;
}

async function safeArchiveEvidenceToR2(evidence) {
  try {
    return await archiveEvidenceToR2(evidence);
  } catch (error) {
    console.error("Archive evidence to R2 error:", error.message);

    if (!evidence) return null;

    const currentAiResult = evidence.aiResult || {};

    const currentMissingInfo = Array.isArray(currentAiResult.missingInfo)
      ? currentAiResult.missingInfo
      : [];

    const currentWarningFlags = Array.isArray(currentAiResult.warningFlags)
      ? currentAiResult.warningFlags
      : [];

    const safeExtractedInfo = currentAiResult.extractedInfo || {
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
    };

    const safeVerification = currentAiResult.verification || {
      hasStudentIdentity: false,
      hasOrganizer: false,
      hasDate: false,
      hasAchievement: false,
      matchesCurrentStudent: "unknown"
    };

    evidence.storageStatus =
      evidence.filePath && fs.existsSync(evidence.filePath)
        ? "local_temp"
        : evidence.storageStatus || "none";

    evidence.aiResult = {
      isValid:
        currentAiResult.isValid === true
          ? true
          : currentAiResult.isValid === false
          ? false
          : null,

      confidence: Number(currentAiResult.confidence || 0),

      matchedType: currentAiResult.matchedType || "",
      subCriteria: currentAiResult.subCriteria || "",
      academicEvidenceType: currentAiResult.academicEvidenceType || "",
      academicActivityCount: Number(
        currentAiResult.academicActivityCount || 0
      ),

      volunteerDays: Number(currentAiResult.volunteerDays || 0),
      volunteerActivityName: currentAiResult.volunteerActivityName || "",
      hasVolunteerAward: currentAiResult.hasVolunteerAward === true,

      kyNangEvidenceType: currentAiResult.kyNangEvidenceType || "",
      foreignLanguageEvidenceType:
        currentAiResult.foreignLanguageEvidenceType || "",
      hoiNhapEvidenceType: currentAiResult.hoiNhapEvidenceType || "",
      awardRank: currentAiResult.awardRank || "",
      organizerLevel: currentAiResult.organizerLevel || "",

      sv5tHistoryType: currentAiResult.sv5tHistoryType || "",
      sv5tHistoryLevel: currentAiResult.sv5tHistoryLevel || "",
      sv5tHistoryYears: Array.isArray(currentAiResult.sv5tHistoryYears)
        ? currentAiResult.sv5tHistoryYears
        : [],
      consecutiveYears: Number(currentAiResult.consecutiveYears || 0),
      issuer: currentAiResult.issuer || "",
      awardTitle: currentAiResult.awardTitle || "",

      extractedText: currentAiResult.extractedText || "",
      matchedEvidence: Array.isArray(currentAiResult.matchedEvidence)
        ? currentAiResult.matchedEvidence
        : [],

      promptVersion: currentAiResult.promptVersion || "",
      evidenceType: currentAiResult.evidenceType || "",
      matchedCategory:
        currentAiResult.matchedCategory || evidence.category || "",
      matchedSubCriteria: Array.isArray(currentAiResult.matchedSubCriteria)
        ? currentAiResult.matchedSubCriteria
        : [],

      decision: currentAiResult.decision || "",

      warningFlags: [
        ...currentWarningFlags,
        "r2_archive_failed"
      ],

      extractedInfo: safeExtractedInfo,
      verification: safeVerification,

      missingInfo: [
        ...currentMissingInfo,
        `AI đã xử lý xong nhưng chưa lưu được file lên Cloudflare R2: ${error.message}`
      ],

      reason: currentAiResult.reason
        ? `${currentAiResult.reason} Lưu ý hệ thống: AI đã xử lý xong nhưng chưa lưu được file lên Cloudflare R2, admin cần kiểm tra storage.`
        : "AI đã xử lý xong nhưng chưa lưu được file lên Cloudflare R2, admin cần kiểm tra storage."
    };

    await evidence.save();
    return evidence;
  }
}

async function handleSchoolLevelAiResult({
  evidence,
  aiResult,
  studentId,
  category
}) {
  if (category === "hocTapTot") {
    if (aiResult.isValid === true && aiResult.confidence >= 70) {
      evidence.status = "ai_valid";
      await evidence.save();

      await safeArchiveEvidenceToR2(evidence);
      await recomputeHocTapProgress(studentId);
      return;
    }

    if (aiResult.isValid === null && aiResult.confidence >= 70) {
      const type = aiResult.academicEvidenceType || "";
      const count = Number(aiResult.academicActivityCount || 0);

      if (type === "hocThuat_3_activities" && count > 0) {
        evidence.status = "partial_valid";
        await evidence.save();

        await safeArchiveEvidenceToR2(evidence);
        await recomputeHocTapProgress(studentId);
        return;
      }
    }

    if (aiResult.isValid === false) {
      evidence.status = "ai_invalid";
      await evidence.save();
      return;
    }

    evidence.status = "manual_review";
    await evidence.save();
    return;
  }

  if (category === "tinhNguyenTot") {
    const volunteerDays = Number(aiResult.volunteerDays || 0);
    const matchedType = aiResult.matchedType || "";

    const isAward =
      aiResult.hasVolunteerAward === true ||
      matchedType.toLowerCase().includes("giấy khen") ||
      matchedType.toLowerCase().includes("khen thưởng");

    evidence.aiResult.volunteerDays = volunteerDays;
    evidence.aiResult.volunteerActivityName =
      aiResult.volunteerActivityName || "";
    evidence.aiResult.hasVolunteerAward = isAward;

    if ((volunteerDays > 0 || isAward) && aiResult.confidence >= 70) {
      evidence.status =
        isAward || volunteerDays >= 5 ? "ai_valid" : "partial_valid";

      await evidence.save();
      await safeArchiveEvidenceToR2(evidence);
      await recomputeTinhNguyenProgress(studentId);
      return;
    }

    if (aiResult.isValid === false) {
      evidence.status = "ai_invalid";
      await evidence.save();
      return;
    }

    evidence.status = "manual_review";
    await evidence.save();
    return;
  }

  if (category === "hoiNhapTot") {
    const subCriteria = aiResult.subCriteria || "";

    if (
      aiResult.isValid === true &&
      aiResult.confidence >= 70 &&
      ["ngoaiNgu", "kyNang", "hoiNhap"].includes(subCriteria)
    ) {
      evidence.status = "ai_valid";
      evidence.aiResult.subCriteria = subCriteria;

      await evidence.save();
      await safeArchiveEvidenceToR2(evidence);
      await recomputeHoiNhapProgress(studentId);
      return;
    }

    if (aiResult.isValid === false) {
      evidence.status = "ai_invalid";
      await evidence.save();
      return;
    }

    evidence.status = "manual_review";
    await evidence.save();
    return;
  }

  if (aiResult.isValid === true && aiResult.confidence >= 70) {
    evidence.status = "ai_valid";
    await evidence.save();

    await safeArchiveEvidenceToR2(evidence);
    await updateStudentProgress(studentId, category);
    return;
  }

  if (aiResult.isValid === false) {
    evidence.status = "ai_invalid";
    await evidence.save();
    return;
  }

  evidence.status = "manual_review";
  await evidence.save();
}

async function handleOtherSv5tAiResult({
  evidence,
  aiResult
}) {
  evidence.aiResult = {
    ...evidence.aiResult,
    ...aiResult,
    sv5tHistoryType:
      aiResult.sv5tHistoryType ||
      aiResult.matchedType ||
      "",
    reason:
      aiResult.reason ||
      "AI đã phân tích minh chứng SV5T các năm trước. Cần admin kiểm tra nếu thông tin chưa rõ."
  };

  const confidence = Number(aiResult.confidence || 0);

  if (aiResult.isValid === true && confidence >= 70) {
    evidence.status = "ai_valid";

    await evidence.save();
    await safeArchiveEvidenceToR2(evidence);
    return;
  }

  if (aiResult.isValid === false && confidence >= 80) {
    evidence.status = "ai_invalid";

    await evidence.save();
    return;
  }

  evidence.status = "manual_review";

  await evidence.save();
}

async function handleHigherLevelAiResult({ evidence, aiResult, awardLevel }) {
  evidence.status = "manual_review";

  evidence.aiResult = {
    ...evidence.aiResult,
    ...aiResult,
    reason:
      `${aiResult.reason || "AI đã phân tích minh chứng."} ` +
      `Đây là minh chứng xét ${getAwardLevelLabel(awardLevel)}, nên cần admin duyệt chính thức trước khi được tính vào tiến độ.`
  };

  await evidence.save();
}

// ─────────────────────────────────────────
// 4. ROUTES
// ─────────────────────────────────────────

router.get("/test-azure", requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    const reply = await callAzureOpenAI({
      system: "Bạn là trợ lý kiểm tra kết nối.",
      messages: [{ role: "user", content: "Trả lời đúng JSON: {\"success\":true,\"message\":\"Azure OpenAI hoạt động\"}" }],
      maxTokens: 100,
      temperature: 0
    });

    res.json({
      success: true,
      message: "Kết nối Azure OpenAI API thành công",
      reply
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không gọi được Azure OpenAI API",
      error: error.message
    });
  }
});

router.post(
  "/upload",
  requireStudentAuth,
  uploadEvidenceMiddleware,
  async (req, res) => {
    try {
      const studentId = req.student.studentId;
      const { category } = req.body;
      const awardLevel = normalizeAwardLevel(req.body.awardLevel || "truong");

      if (!studentId || !category) {
        return res.status(400).json({
          success: false,
          message: "Thiếu MSSV hoặc tiêu chí"
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn file minh chứng"
        });
      }

      if (SELF_DECLARE_CATEGORIES.includes(category)) {
        const evidence = new Evidence({
          studentId,
          category,
          awardLevel,
          fileName: req.file.originalname,
          filePath: req.file.path,
          fileKey: "",
          fileUrl: "",
          fileSize: req.file.size,
          fileType: req.file.mimetype,
          storageStatus: "local_temp",
          status: "manual_review",
          aiResult: getEmptyAiResult(
            `Tiêu chí "${categoryLabels[category]}" thuộc "${getAwardLevelLabel(awardLevel)}" do sinh viên tự khai báo. Minh chứng này cần admin xem xét nếu đơn vị yêu cầu.`
          )
        });

        await evidence.save();

        return res.json({
          success: true,
          message: `Đã lưu minh chứng "${categoryLabels[category]}". Admin sẽ xem xét và xác nhận nếu cần.`,
          evidence,
          aiProcessed: false
        });
      }

      const evidence = new Evidence({
        studentId,
        category,
        awardLevel,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileKey: "",
        fileUrl: "",
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        storageStatus: "local_temp",
        status: "pending",
        aiResult: getEmptyAiResult("")
      });

      await evidence.save();

      const uploadStudent = await Student.findOne({
  studentId
}).select("studentId fullName className");
const studentContext = buildStudentContext(uploadStudent || req.student);

await sendPushToAdminsForClass(
  uploadStudent?.className || req.student.className || "",
  {
    title: "Có minh chứng mới cần xử lý",
    body: `${uploadStudent?.fullName || studentId} vừa upload minh chứng ${categoryLabels[category] || category}.`,
    url: "/admin-dashboard.html"
  }
).catch((error) => {
  console.error("Push new evidence to admin error:", error.message);
});

      // Start QR verification in parallel with AI (images only)
      const isImageEvidence =
        req.file.mimetype === "image/png" || req.file.mimetype === "image/jpeg";
      const qrPromise = isImageEvidence
        ? verifyEvidenceQR(req.file.path, uploadStudent).catch((e) => {
            console.error("QR verification error:", e.message);
            return null;
          })
        : Promise.resolve(null);

      analyzeEvidenceWithAI(
  req.file.path,
  req.file.mimetype,
  category,
  awardLevel,
  studentContext
)
        .then(async (rawAiResult) => {
          const rawResponse = rawAiResult?.rawResponse || "";

let aiResult = normalizeAiResult(rawAiResult);

aiResult = normalizeAiV2Result(
  aiResult,
  category,
  awardLevel,
  studentContext
);

aiResult = applyAiSafetyRules(aiResult, category);

delete aiResult.rawResponse;
delete aiResult._studentContext;
delete aiResult._awardLevel;

          if (
            awardLevel === "dhqg" &&
            category === "hoiNhapTot" &&
            aiResult.subCriteria === "ngoaiNgu"
          ) {
            const textForMockCheck = [
              aiResult.extractedText,
              aiResult.reason,
              aiResult.matchedType,
              ...(aiResult.matchedEvidence || [])
            ].join(" ");

            if (containsMockTestKeyword(textForMockCheck)) {
              aiResult.isValid = false;
              aiResult.confidence = Math.max(Number(aiResult.confidence || 0), 85);
              aiResult.missingInfo = [
                ...(aiResult.missingInfo || []),
                "Cấp ĐHQG-HCM không chấp nhận chứng nhận trong các đợt thi thử."
              ];
              aiResult.reason =
                "Minh chứng thuộc nhóm Ngoại ngữ nhưng có dấu hiệu là chứng nhận/kết quả thi thử. Theo quy chế cấp ĐHQG-HCM, không chấp nhận chứng nhận trong các đợt thi thử.";
            }
          }

          // Apply QR verification boost (runs parallel with AI, await result here)
          const qrResult = await qrPromise;
          if (qrResult) {
            evidence.qrVerification = qrResult;

            if (qrResult.studentNameFound || qrResult.studentIdFound) {
              const existingConf = Number(aiResult.confidence || 0);
              // Don't override high-confidence safety rejections (e.g. mock-test block at ≥85%)
              if (aiResult.isValid !== false || existingConf < 85) {
                if (aiResult.isValid === false) {
                  aiResult.isValid = true;
                  aiResult.confidence = Math.max(existingConf, 80);
                } else {
                  aiResult.confidence = Math.min(100, existingConf + 15);
                }
                aiResult.reason =
                  (aiResult.reason ? aiResult.reason + " " : "") +
                  "[QR xác nhận: Sinh viên có trong Quyết định công nhận chính thức]";
              }
              console.log(
                `🔍 QR Verified [${studentId}]: name=${qrResult.studentNameFound} id=${qrResult.studentIdFound} file="${qrResult.pdfFileName}"`
              );
            } else if (qrResult.hasQR && !qrResult.error) {
              aiResult.warningFlags = [
                ...(aiResult.warningFlags || []),
                "QR code tìm thấy nhưng tên sinh viên không có trong Quyết định công nhận"
              ];
              console.log(
                `⚠️ QR found but student not in PDF [${studentId}]: ${qrResult.pdfFileName}`
              );
            } else if (qrResult.hasQR && qrResult.error) {
              console.log(`⚠️ QR error [${studentId}]: ${qrResult.error}`);
            }
          }

          evidence.aiResult = aiResult;
          await createAIReviewLog({
  studentId,
  evidenceId: evidence._id,
  category,
  awardLevel,
  inputType: req.file.mimetype,
  extractedTextLength: String(aiResult.extractedText || "").length,
  statusBefore: "pending",
  rawResponse,
  parsedResult: aiResult
});

if (category === "khac") {
  await handleOtherSv5tAiResult({
    evidence,
    aiResult
  });

  console.log(
    `📌 AI Khác [${studentId}/${category}/${awardLevel}]: ${evidence.status} (${aiResult.confidence}%) — ${aiResult.reason}`
  );

  return;
}

if (isHigherAwardLevel(awardLevel)) {
  await handleHigherLevelAiResult({
    evidence,
    aiResult,
    awardLevel
  });

  console.log(
    `🟡 AI đề xuất [${studentId}/${category}/${awardLevel}]: manual_review (${aiResult.confidence}%) — ${aiResult.reason}`
  );

  return;
}

await handleSchoolLevelAiResult({
  evidence,
  aiResult,
  studentId,
  category
});

await createAIReviewLog({
  studentId,
  evidenceId: evidence._id,
  category,
  awardLevel,
  inputType: req.file.mimetype,
  extractedTextLength: String(aiResult.extractedText || "").length,
  statusBefore: "pending",
  statusAfter: evidence.status,
  parsedResult: aiResult
});

          console.log(
            `✅ AI [${studentId}/${category}/${awardLevel}]: ${evidence.status} (${aiResult.confidence}%) — ${aiResult.reason}`
          );
        })
        .catch(async (error) => {
          console.error("Background AI error:", error.message);

          evidence.status = "manual_review";
          evidence.aiResult = getEmptyAiResult(
            "Có lỗi khi chạy AI. Cần admin kiểm tra thủ công."
          );
          evidence.aiResult.missingInfo = [error.message];

          await evidence.save();
          await createAIReviewLog({
  studentId,
  evidenceId: evidence._id,
  category,
  awardLevel,
  inputType: req.file?.mimetype || "",
  statusBefore: "pending",
  statusAfter: "manual_review",
  errorMessage: error.message
});
        });

      res.json({
  success: true,
  message:
    category === "khac"
      ? "Upload thành công. AI đang kiểm tra minh chứng danh hiệu Sinh viên 5 tốt các năm trước, kết quả cập nhật sau vài giây."
      : `Upload thành công. AI đang kiểm tra minh chứng theo quy chế ${getAwardLevelLabel(awardLevel)}, kết quả cập nhật sau vài giây.`,
  evidence,
  aiProcessed: true
});
    } catch (error) {
      console.error("Upload evidence error:", error);

      // Xóa file tạm nếu có lỗi
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.error("Không xóa được file tạm:", unlinkErr.message);
        }
      }

      res.status(500).json({
        success: false,
        message: error.message || "Lỗi server khi upload minh chứng"
      });
    }
  }
);

router.get("/student/:studentId", requireStudentAuth, async (req, res) => {
  const { studentId } = req.params;
  const awardLevel = req.query.awardLevel
    ? normalizeAwardLevel(req.query.awardLevel)
    : null;

  if (req.student.studentId !== studentId) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền xem minh chứng của sinh viên khác"
    });
  }

  try {
    const query = {
      studentId
    };

    if (awardLevel) {
      query.awardLevel = awardLevel;
    }

    const evidences = await Evidence.find(query).sort({
      createdAt: -1
    });

    res.json({
      success: true,
      evidences
    });
  } catch (error) {
    console.error("Get student evidences error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách minh chứng"
    });
  }
});

router.get("/:evidenceId/status", requireStudentAuth, async (req, res) => {
  try {
    const { evidenceId } = req.params;

    const evidence = await Evidence.findById(evidenceId);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy minh chứng"
      });
    }

    if (evidence.studentId !== req.student.studentId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem minh chứng này"
      });
    }

    res.json({
      success: true,
      evidence: {
        _id: evidence._id,
        studentId: evidence.studentId,
        awardLevel: evidence.awardLevel,
        category: evidence.category,
        fileName: evidence.fileName,
        fileUrl: evidence.fileUrl,
        fileKey: evidence.fileKey,
        fileSize: evidence.fileSize,
        fileType: evidence.fileType,
        storageStatus: evidence.storageStatus,
        status: evidence.status,
        aiResult: evidence.aiResult,
        createdAt: evidence.createdAt,
        updatedAt: evidence.updatedAt
      }
    });
  } catch (error) {
    console.error("Get evidence status error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi kiểm tra trạng thái minh chứng"
    });
  }
});

module.exports = router;
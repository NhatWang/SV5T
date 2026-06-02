const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const Evidence = require("../Models/Evidence");
const Student = require("../Models/Student");

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

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
  sendPushToAdminsForClass
} = require("../Utils/pushService");

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

    reason:
      aiResult?.reason ||
      "AI đã xử lý nhưng không trả lý do cụ thể. Cần admin kiểm tra thủ công."
  };
}

async function extractTextFromFile(filePath, fileType) {
  try {
    if (fileType === "application/pdf") {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text?.trim() || "";
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

function getAiAwardLevelContext(awardLevel) {
  const normalizedLevel = normalizeAwardLevel(awardLevel || "truong");

  const contexts = {
    truong: {
      label: "Cấp Trường",
      hocTapNote:
        "Áp dụng quy chế cấp Trường. Riêng nhóm giấy xác nhận hoạt động học thuật thông thường có thể cần cộng dồn đủ 03 hoạt động.",
      volunteerNote:
        "Cấp Trường chấp nhận đủ ít nhất 05 ngày tình nguyện trong năm học hoặc giấy khen/khen thưởng tình nguyện phù hợp từ cấp Trường trở lên.",
      theLucNote:
        "Cấp Trường chấp nhận Thanh niên khỏe từ cấp Trường trở lên, hoạt động thể thao phù hợp từ cấp Khoa trở lên hoặc minh chứng rèn luyện thể thao đủ thời lượng theo quy chế.",
      hoiNhapNote:
        "Cấp Trường yêu cầu đạt đủ 03 nhóm Hội nhập tốt: Ngoại ngữ, Kỹ năng, Hoạt động hội nhập."
    },

    dhqg: {
      label: "Cấp ĐHQG-HCM",
      hocTapNote:
        "Áp dụng quy chế cấp ĐHQG-HCM. Tiêu chuẩn khác yêu cầu đạt ít nhất 01 nhóm minh chứng học thuật hợp lệ. Không áp dụng yêu cầu đủ 03 hoạt động học thuật nếu minh chứng chỉ dùng để xét cấp ĐHQG-HCM.",
      volunteerNote:
        "Cấp ĐHQG-HCM chấp nhận khen thưởng tình nguyện từ cấp Trường trở lên hoặc tham gia ít nhất 05 ngày tình nguyện trong năm học.",
      theLucNote:
        "Cấp ĐHQG-HCM chấp nhận Thanh niên khỏe từ cấp Trường trở lên, hoạt động thể thao cấp ĐHQG-HCM/Thành phố/Trung ương, hoặc là thành viên chính thức đội tuyển cấp Trường trở lên.",
      hoiNhapNote:
        "Cấp ĐHQG-HCM yêu cầu đạt đủ 03 nhóm Hội nhập tốt: Ngoại ngữ, Kỹ năng, Hoạt động hội nhập."
    },

    thanh: {
      label: "Cấp Thành phố Hồ Chí Minh",
      hocTapNote:
        "Áp dụng quy chế cấp Thành phố Hồ Chí Minh. Tiêu chuẩn khác yêu cầu đạt ít nhất 01 nhóm minh chứng học thuật hợp lệ. Không áp dụng yêu cầu đủ 03 hoạt động học thuật nếu minh chứng chỉ dùng để xét cấp Thành phố.",
      volunteerNote:
        "Cấp Thành phố yêu cầu sinh viên có ít nhất 05 ngày tình nguyện trong năm học và có khen thưởng tình nguyện từ cấp Trường trở lên.",
      theLucNote:
        "Cấp Thành phố chấp nhận Thanh niên khỏe từ cấp Trường trở lên, hoạt động thể thao cấp Thành phố/cấp Trung ương, hoặc là thành viên chính thức đội tuyển cấp Thành phố/cấp Quốc gia.",
      hoiNhapNote:
        "Cấp Thành phố yêu cầu đạt đủ 03 nhóm Hội nhập tốt: Ngoại ngữ, Kỹ năng, Hoạt động hội nhập."
    }
  };

  return contexts[normalizedLevel] || contexts.truong;
}

function buildHocTapPrompt(contentDescription, awardLevel = "truong") {
  const context = getAiAwardLevelContext(awardLevel);
  const isHigherLevel = isHigherAwardLevel(awardLevel);

  if (isHigherLevel) {
    return `Đây là minh chứng cho phần "Tiêu chuẩn khác" của tiêu chí "Học tập tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu có thuộc ít nhất 01 nhóm minh chứng học thuật hợp lệ cho ${context.label} hay không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý QUAN TRỌNG:
${context.hocTapNote}

Tiêu chí "Học tập tốt" gồm 2 phần:
A. Tiêu chuẩn bắt buộc: GPA, không nợ môn/học phần/tín chỉ, không gian lận trong thi cử, thái độ học tập đúng đắn.
B. Tiêu chuẩn khác: đạt ít nhất 01 trong các nhóm minh chứng học thuật hợp lệ dưới đây.

Tài liệu này chỉ dùng để AI hỗ trợ phân tích phần B - Tiêu chuẩn khác.

Các nhóm minh chứng hợp lệ cho phần "Tiêu chuẩn khác" của ${context.label}:
[1] Có đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp trong năm học được nghiệm thu đạt yêu cầu theo quy chế cấp xét hiện tại, hoặc đạt giải theo cấp quy định.
[2] Đạt giải trong cuộc thi học thuật, cuộc thi ý tưởng sáng tạo hoặc giải thưởng nghiên cứu khoa học theo cấp/mức giải quy định.
[3] Có bài viết đăng trên tạp chí chuyên ngành hoặc bài tham luận tham gia hội thảo khoa học theo cấp quy định.
[4] Có sản phẩm sáng tạo, giải pháp hữu ích, bằng sáng chế, đơn đăng ký chứng nhận quyền sở hữu trí tuệ hoặc giấy phép xuất bản.
[5] Là thành viên đội tuyển tham gia cuộc thi học thuật cấp quốc gia hoặc quốc tế.
[6] Với cấp Thành phố, có thể tính thành tích nổi bật của sinh viên khối ngành năng khiếu trong cuộc thi cấp Thành, cấp Quốc gia, khu vực trở lên hoặc tác phẩm tham gia triển lãm chuyên ngành cấp Thành trở lên nếu minh chứng thể hiện rõ.

Quy tắc riêng cho AI:
- KHÔNG yêu cầu đủ 03 hoạt động học thuật đối với ${context.label}.
- Nếu tài liệu chỉ là giấy xác nhận tham gia 01 hoạt động học thuật thông thường và không thể hiện giải thưởng, nghiên cứu, bài báo, hội thảo, sản phẩm sáng tạo hoặc đội tuyển học thuật, hãy trả isValid = null hoặc false tùy độ rõ, và yêu cầu admin kiểm tra.
- Nếu tài liệu thuộc nhóm nghiên cứu khoa học, khóa luận, giải thưởng học thuật, bài báo, hội thảo, sản phẩm sáng tạo, bằng sáng chế, sở hữu trí tuệ hoặc đội tuyển học thuật thì có thể xem là minh chứng trực tiếp.
- Nếu thiếu cấp tổ chức, thiếu kết quả giải, thiếu điểm nghiệm thu, thiếu loại xếp loại, thiếu xác nhận hoặc thiếu tên sinh viên thì đưa vào missingInfo.
- Không tự suy đoán cấp tổ chức hoặc thành tích nếu file không thể hiện rõ.

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "loại minh chứng học tập khớp",
  "academicEvidenceType": "nghienCuu hoặc sangTao hoặc baiBao hoặc doiTuyen hoặc khac_direct hoặc chuỗi rỗng",
  "academicActivityCount": 0,
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu nếu có"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}`;
  }

  return `Đây là minh chứng cho phần "Tiêu chuẩn khác" của tiêu chí "Học tập tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu có phù hợp với phần "Tiêu chuẩn khác" của Học tập tốt cấp Trường hay không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý QUAN TRỌNG:
${context.hocTapNote}

Tiêu chí "Học tập tốt" gồm 2 phần:
A. Tiêu chuẩn bắt buộc: GPA, không nợ môn/học phần/tín chỉ, không gian lận trong thi cử, thái độ học tập đúng đắn.
B. Tiêu chuẩn khác: sinh viên phải đạt ít nhất 01 minh chứng học thuật khác.

Tài liệu này chỉ dùng để AI hỗ trợ phân tích phần B - Tiêu chuẩn khác.

Các loại minh chứng hợp lệ cho cấp Trường:
[1] Tham gia và vượt qua vòng đầu tiên hoặc là thành viên Ban Tổ chức của cuộc thi học thuật cấp Khoa trở lên.
[2] Có đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp trong năm học được nghiệm thu từ 7.0 điểm hoặc loại Khá trở lên, hoặc đạt giải cấp Trường/Khoa theo quy chế.
[3] Tham gia cuộc thi ý tưởng sáng tạo, nghiên cứu khoa học từ cấp Khoa/Bộ môn trở lên.
[4] Tham gia ít nhất 03 hoạt động học thuật và có giấy xác nhận. Hoạt động cổ vũ cuộc thi học thuật chỉ tính chung là 01 hoạt động.
[5] Là trợ giảng ít nhất 01 học kỳ và có giấy xác nhận phù hợp.
[6] Có bài viết đăng trên báo/tạp chí chuyên ngành hoặc bài tham luận hội thảo khoa học/sinh hoạt chuyên đề cấp Khoa trở lên.
[7] Có sản phẩm sáng tạo, giải pháp hữu ích, bằng sáng chế, đơn đăng ký chứng nhận quyền sở hữu trí tuệ hoặc giấy phép xuất bản.
[8] Là thành viên chính thức đội tuyển tham gia cuộc thi học thuật cấp quốc gia hoặc quốc tế.

Quy tắc riêng cho AI:
- Nếu tài liệu thuộc nhóm [4] “Tham gia ít nhất 03 hoạt động học thuật”, trả academicEvidenceType = "hocThuat_3_activities".
- Nếu tài liệu chỉ xác nhận 01 hoạt động học thuật thông thường, trả academicActivityCount = 1 và isValid = null để cộng dồn.
- Nếu tài liệu ghi rõ sinh viên đã tham gia đủ 03 hoạt động học thuật, trả academicActivityCount = 3 và có thể trả isValid = true nếu thông tin rõ.
- Không kết luận đạt tiêu chuẩn khác nếu mới chỉ có 1 hoặc 2 hoạt động học thuật thông thường, nhưng vẫn xem là minh chứng hợp lệ một phần để cộng dồn.
- Nếu tài liệu thuộc nhóm NCKH, sáng tạo, trợ giảng, bài báo, đội tuyển học thuật hoặc minh chứng trực tiếp khác thì trả academicEvidenceType tương ứng và academicActivityCount = 0.
- Không tự suy đoán cấp tổ chức hoặc thành tích nếu file không thể hiện rõ.

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "loại minh chứng học tập khớp",
  "academicEvidenceType": "hocThuat_3_activities hoặc nghienCuu hoặc sangTao hoặc troGiang hoặc baiBao hoặc doiTuyen hoặc khac_direct hoặc chuỗi rỗng",
  "academicActivityCount": số hoạt động học thuật xác định được, nếu không thuộc nhóm hoạt động học thuật thì để 0,
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu nếu có"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}`;
}

function buildTheLucPrompt(contentDescription, awardLevel = "truong") {
  const context = getAiAwardLevelContext(awardLevel);

  return `Đây là minh chứng cho tiêu chí "Thể lực tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu có phù hợp với tiêu chí Thể lực tốt của ${context.label} hay không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý THEO CẤP XÉT:
${context.theLucNote}

Các nhóm minh chứng thường hợp lệ:
[1] Giấy chứng nhận đạt danh hiệu "Thanh niên khỏe" từ cấp Trường trở lên.
[2] Giấy chứng nhận hoặc huy chương tham gia/đạt giải hoạt động thể thao phù hợp theo cấp xét hiện tại.
[3] Minh chứng là thành viên chính thức đội tuyển thể thao theo cấp xét hiện tại.
[4] Với cấp Trường, có thể chấp nhận minh chứng tham gia CLB/thể thao/rèn luyện thể thao đủ điều kiện thời lượng theo quy chế trường.
[5] Không tính giải thể thao điện tử.

Quy tắc riêng cho AI:
- Nếu minh chứng không ghi rõ cấp tổ chức, thời gian, tên sinh viên hoặc loại hoạt động thể thao, đưa vào missingInfo.
- Không tự suy đoán cấp tổ chức hoặc thời lượng tập luyện nếu tài liệu không nêu rõ.
- Với cấp cao hơn, nếu minh chứng chỉ thể hiện hoạt động nội bộ cấp thấp và không đủ căn cứ theo quy chế, trả isValid = null hoặc false và yêu cầu admin kiểm tra.

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "loại minh chứng thể lực khớp",
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu hoặc chưa rõ"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}`;
}

function buildTinhNguyenPrompt(contentDescription, awardLevel = "truong") {
  const context = getAiAwardLevelContext(awardLevel);

  return `Đây là minh chứng cho tiêu chí "Tình nguyện tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu có phù hợp với tiêu chí Tình nguyện tốt của ${context.label} hay không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý THEO CẤP XÉT:
${context.volunteerNote}

Các nhóm minh chứng thường hợp lệ:
[1] Giấy xác nhận tham gia tình nguyện có thể hiện số ngày tình nguyện.
[2] Giấy chứng nhận tham gia chiến dịch/chương trình tình nguyện phù hợp.
[3] Giấy khen hoặc khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên.
[4] Giấy chứng nhận hiến máu nhân đạo, nếu quy chế/đơn vị xét cho phép quy đổi hoặc tính vào ngày tình nguyện.
[5] Có thể cộng dồn nhiều minh chứng để đạt ít nhất 05 ngày tình nguyện trong năm học.

Quy tắc riêng về số ngày tình nguyện:
- Nếu tài liệu thể hiện từ 05 ngày tình nguyện trở lên, trả isValid = true.
- Nếu tài liệu chỉ thể hiện 1, 2, 3 hoặc 4 ngày tình nguyện nhưng thông tin hợp lệ, trả isValid = null, volunteerDays bằng số ngày xác định được để hệ thống cộng dồn.
- Nếu tài liệu là giấy khen/khen thưởng tình nguyện phù hợp từ cấp Trường trở lên, trả hasVolunteerAward = true và có thể trả isValid = true dù không ghi số ngày.
- Không tự đoán số ngày nếu tài liệu không ghi rõ hoặc không thể suy ra chắc chắn.
- Nếu thiếu ngày, thiếu tên hoạt động, thiếu đơn vị xác nhận hoặc thiếu tên sinh viên, đưa vào missingInfo.

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "loại minh chứng tình nguyện khớp",
  "volunteerDays": số ngày tình nguyện xác định được, nếu không rõ thì 0,
  "volunteerActivityName": "tên hoạt động/chiến dịch nếu có",
  "hasVolunteerAward": true hoặc false,
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu hoặc chưa rõ"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}`;
}

function buildHoiNhapPrompt(contentDescription, awardLevel = "truong") {
  const context = getAiAwardLevelContext(awardLevel);
  const isDhqgLevel = awardLevel === "dhqg";
  const isThanhLevel = awardLevel === "thanh";

  return `Đây là minh chứng cho tiêu chí "Hội nhập tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu thuộc nhóm nào trong Hội nhập tốt và có hợp lệ không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý THEO CẤP XÉT:
${context.hoiNhapNote}

Tiêu chí "Hội nhập tốt" gồm 3 nhóm. Sinh viên cần đạt đủ cả 3 nhóm:
5.1. Ngoại ngữ
5.2. Kỹ năng
5.3. Hoạt động hội nhập

NHÓM 1 - NGOẠI NGỮ, subCriteria = "ngoaiNgu":
- Dùng cho minh chứng ngoại ngữ cơ bản.
- Chấp nhận chứng chỉ ngoại ngữ tương đương B1 trở lên hoặc mức cao hơn theo quy chế cấp xét hiện tại.
- Chấp nhận điểm học phần ngoại ngữ đạt ngưỡng theo quy chế cấp xét hiện tại.
- Chấp nhận cuộc thi kiến thức ngoại ngữ từ cấp Khoa/cấp Trường trở lên tùy cấp xét.
- Chứng chỉ phải còn hiệu lực nếu tài liệu có ghi thời hạn.

${
  isDhqgLevel
    ? `- QUY TẮC RIÊNG CẤP ĐHQG-HCM: Không chấp nhận chứng nhận trong các đợt thi thử. Nếu tài liệu có dấu hiệu là thi thử, mock test, practice test, placement test thử, kiểm tra thử, chứng nhận thử, kết quả thi thử hoặc giấy chứng nhận từ một đợt thi thử thì phải đánh giá là không hợp lệ cho nhóm Ngoại ngữ cấp ĐHQG-HCM.`
    : ""
}

${
  isThanhLevel
    ? `- QUY TẮC RIÊNG CẤP THÀNH PHỐ:
  Đối với cấp Thành phố, phần Ngoại ngữ gồm 02 lớp điều kiện:
  (A) Điều kiện ngoại ngữ cơ bản: chứng chỉ ngoại ngữ B1 trở lên hoặc điểm học phần ngoại ngữ đạt ngưỡng theo quy chế.
  (B) Điều kiện bổ sung ngoại ngữ: sinh viên phải đạt thêm 01 trong 02 tiêu chí sau:
      (1) Có giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế, hội nghị/hội thảo quốc tế, chương trình gặp gỡ/giao lưu/hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước.
      (2) Đạt giải Ba trở lên tại cuộc thi về kiến thức hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.

  LƯU Ý QUAN TRỌNG:
  - Nếu minh chứng là chứng chỉ ngoại ngữ hoặc điểm học phần ngoại ngữ, hãy phân loại là subCriteria = "ngoaiNgu".
  - Nếu minh chứng là hoạt động giao lưu quốc tế, hội nghị quốc tế, hội thảo quốc tế, chương trình hợp tác/giao lưu với sinh viên quốc tế, hãy phân loại là subCriteria = "hoiNhap" và hoiNhapEvidenceType = "international_exchange".
  - Nếu minh chứng là giải Ba trở lên tại cuộc thi kiến thức hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên, hãy phân loại là subCriteria = "hoiNhap" và hoiNhapEvidenceType = "foreign_language_academic_competition_award_truong_or_above".
  - Tuy các minh chứng này được dùng để hoàn thành điều kiện bổ sung của phần Ngoại ngữ cấp Thành phố, nhưng không được ép chúng thành subCriteria = "ngoaiNgu" nếu bản chất là hoạt động hội nhập hoặc cuộc thi hội nhập.`
    : ""
}

NHÓM 2 - KỸ NĂNG, subCriteria = "kyNang":

Cấp Trường:
- Hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội.
- Đạt giải trong cuộc thi kỹ năng từ cấp Khoa trở lên.
- Là báo cáo viên lớp kỹ năng từ cấp Khoa hoặc tương đương trở lên.
- Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc trong công tác Đoàn/Hội hoặc phong trào sinh viên.
- Tham gia và vào vòng Chung kết cuộc thi thủ lĩnh sinh viên cấp Trường trở lên.

Cấp ĐHQG-HCM:
- Hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội.
- Đạt giải trong cuộc thi kỹ năng từ cấp Trường trở lên.
- Là báo cáo viên lớp kỹ năng từ cấp Trường trở lên.
- Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc trong công tác Đoàn/Hội hoặc phong trào sinh viên.

Cấp Thành phố:
- Hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội.
- Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc trong công tác Đoàn/Hội hoặc phong trào sinh viên.

Nếu tài liệu là minh chứng kỹ năng, trả thêm kyNangEvidenceType:
- "skill_course" nếu là giấy chứng nhận hoàn thành khóa kỹ năng.
- "skill_competition_award_khoa_or_above" nếu là giải cuộc thi kỹ năng từ cấp Khoa trở lên.
- "skill_competition_award_truong_or_above" nếu là giải cuộc thi kỹ năng từ cấp Trường trở lên.
- "skill_reporter_khoa_or_above" nếu là báo cáo viên lớp kỹ năng từ cấp Khoa/tương đương trở lên.
- "skill_reporter_truong_or_above" nếu là báo cáo viên lớp kỹ năng từ cấp Trường trở lên.
- "union_association_award_truong_or_above" nếu là khen thưởng Đoàn/Hội từ cấp Trường trở lên.
- "student_leader_competition_finalist_truong_or_above" nếu là vào chung kết cuộc thi thủ lĩnh sinh viên cấp Trường trở lên.
- "unknown" nếu không xác định được.

NHÓM 3 - HOẠT ĐỘNG HỘI NHẬP, subCriteria = "hoiNhap":

Cấp Trường:
- Tham gia hoạt động giao lưu quốc tế.
- Tham gia/vượt qua vòng đầu hoặc là Ban Tổ chức cuộc thi tìm hiểu văn hóa/hội nhập từ cấp Khoa trở lên.
- Là thành viên chính thức chương trình giao lưu/hợp tác quốc tế.
- Là tình nguyện viên theo đoàn/chương trình giao lưu quốc tế.

Cấp ĐHQG-HCM:
- Tham gia hoạt động giao lưu quốc tế.
- Đạt giải Ba trở lên cuộc thi kiến thức hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.
- Là thành viên chính thức hoặc tình nguyện viên chương trình giao lưu quốc tế.

Cấp Thành phố:
- Tham gia tích cực ít nhất 01 hoạt động về hội nhập do cấp Trường tổ chức trở lên.

Nếu tài liệu là minh chứng hoạt động hội nhập, trả thêm hoiNhapEvidenceType:
- "international_exchange" nếu là hoạt động giao lưu quốc tế/hội nghị/hội thảo quốc tế.
- "integration_competition_khoa_or_above" nếu là cuộc thi tìm hiểu văn hóa/hội nhập từ cấp Khoa trở lên.
- "integration_competition_award_truong_or_above" nếu là giải Ba trở lên cuộc thi kiến thức hội nhập từ cấp Trường trở lên.
- "foreign_language_academic_competition_award_truong_or_above" nếu là giải Ba trở lên cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.
- "official_international_program_member" nếu là thành viên chính thức chương trình giao lưu/hợp tác quốc tế.
- "international_program_volunteer" nếu là tình nguyện viên chương trình giao lưu/hợp tác quốc tế.
- "integration_activity_truong_or_above" nếu là hoạt động hội nhập do cấp Trường tổ chức trở lên.
- "unknown" nếu không xác định được.

Quy tắc riêng cho AI:
- Chọn đúng 01 subCriteria phù hợp nhất: "ngoaiNgu", "kyNang", "hoiNhap".
- Nếu tài liệu có thể thuộc nhiều nhóm, chọn nhóm rõ nhất và ghi nhóm còn lại trong matchedEvidence.
- Nếu thiếu cấp tổ chức, thiếu thời hạn chứng chỉ, thiếu điểm/số hiệu chứng chỉ, thiếu xác nhận hoặc thiếu tên sinh viên, đưa vào missingInfo.
- Không tự suy đoán cấp tổ chức hoặc giá trị chứng chỉ nếu file không thể hiện rõ.

Quy tắc phân loại riêng cho nhóm Ngoại ngữ:
- Nếu là chứng chỉ ngoại ngữ, foreignLanguageEvidenceType = "language_certificate".
- Nếu là điểm học phần ngoại ngữ, foreignLanguageEvidenceType = "course_score".
- Nếu là giấy chứng nhận tham gia hoạt động giao lưu quốc tế, foreignLanguageEvidenceType = "international_exchange".
- Nếu là giải Ba trở lên cuộc thi kiến thức hội nhập, foreignLanguageEvidenceType = "integration_competition_award".
- Nếu là giải Ba trở lên cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên, foreignLanguageEvidenceType = "foreign_language_academic_competition_award".
- Nếu không xác định được loại minh chứng ngoại ngữ, foreignLanguageEvidenceType = "unknown".
- Nếu tài liệu là giải thưởng, phải cố gắng xác định awardRank và organizerLevel.
- Nếu tài liệu là giải thưởng nhưng thiếu hạng giải hoặc cấp tổ chức, thêm thông tin còn thiếu vào missingInfo.
${
  isDhqgLevel
    ? `- Riêng cấp ĐHQG-HCM: Nếu tài liệu thuộc nhóm Ngoại ngữ nhưng có các cụm như "thi thử", "kỳ thi thử", "mock test", "practice test", "trial test", "placement test thử", "kiểm tra thử", "chứng nhận thử", "kết quả thi thử", thì trả isValid = false, subCriteria = "ngoaiNgu", confidence tối thiểu 80 nếu thông tin rõ, và giải thích rằng cấp ĐHQG-HCM không chấp nhận chứng nhận trong các đợt thi thử.`
    : ""
}

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "subCriteria": "ngoaiNgu hoặc kyNang hoặc hoiNhap hoặc chuỗi rỗng",
  "matchedType": "loại minh chứng hội nhập khớp",
  "foreignLanguageEvidenceType": "language_certificate hoặc course_score hoặc international_exchange hoặc integration_competition_award hoặc foreign_language_academic_competition_award hoặc unknown hoặc chuỗi rỗng",
  "awardRank": "nhat hoặc nhi hoặc ba hoặc khuyen_khich hoặc chuỗi rỗng",
  "organizerLevel": "khoa hoặc truong hoặc dhqg hoặc thanh hoặc quoc_gia hoặc quoc_te hoặc chuỗi rỗng",
  "kyNangEvidenceType": "skill_course hoặc skill_competition_award_khoa_or_above hoặc skill_competition_award_truong_or_above hoặc skill_reporter_khoa_or_above hoặc skill_reporter_truong_or_above hoặc union_association_award_truong_or_above hoặc student_leader_competition_finalist_truong_or_above hoặc unknown hoặc chuỗi rỗng",
  "hoiNhapEvidenceType": "international_exchange hoặc integration_competition_khoa_or_above hoặc integration_competition_award_truong_or_above hoặc foreign_language_academic_competition_award_truong_or_above hoặc official_international_program_member hoặc international_program_volunteer hoặc integration_activity_truong_or_above hoặc unknown hoặc chuỗi rỗng",
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu nếu có"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}
`;
}

function buildKhacPrompt(contentDescription) {
  return `Đây là minh chứng thuộc tab "Khác" trong hồ sơ Sinh viên 5 tốt cấp Trường.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Chỉ xác định các giấy chứng nhận hoặc bằng khen liên quan trực tiếp đến danh hiệu "Sinh viên 5 tốt" ở các năm trước.
- Không dùng minh chứng này để hoàn thành 5 tiêu chí chính.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

CHỈ CHẤP NHẬN các loại minh chứng sau:
[1] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp Khoa trong các năm trước.
[2] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp Trường trong các năm trước.
[3] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp ĐHQG-HCM.
[4] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp Thành phố.
[5] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp Trung ương.
[6] Minh chứng thể hiện sinh viên đạt Sinh viên 5 tốt cấp Khoa hoặc cấp Trường 2 năm liền.
[7] Minh chứng thể hiện sinh viên đạt Sinh viên 5 tốt cấp Khoa hoặc cấp Trường 3 năm liền.
[8] Bằng khen của Giám đốc ĐHQG-HCM cho Sinh viên 5 tốt tiêu biểu.

KHÔNG CHẤP NHẬN:
- Giấy chứng nhận tham gia hoạt động thông thường.
- Giấy chứng nhận tình nguyện, thể thao, học thuật, kỹ năng, hội nhập nếu không ghi rõ đạt danh hiệu Sinh viên 5 tốt.
- Bảng điểm, chứng chỉ ngoại ngữ, giấy xác nhận hoạt động đơn lẻ.
- Giấy chứng nhận không có cụm "Sinh viên 5 tốt".
- Minh chứng không liên quan đến danh hiệu Sinh viên 5 tốt.

Quy tắc phân loại:
- Nếu có "Sinh viên 5 tốt" và "cấp Khoa" và "2 năm liền", matchedType = "sv5t_khoa_2_nam_lien", sv5tHistoryLevel = "khoa", consecutiveYears = 2.
- Nếu có "Sinh viên 5 tốt" và "cấp Khoa" và "3 năm liền", matchedType = "sv5t_khoa_3_nam_lien", sv5tHistoryLevel = "khoa", consecutiveYears = 3.
- Nếu có "Sinh viên 5 tốt" và "cấp Trường" và "2 năm liền", matchedType = "sv5t_truong_2_nam_lien", sv5tHistoryLevel = "truong", consecutiveYears = 2.
- Nếu có "Sinh viên 5 tốt" và "cấp Trường" và "3 năm liền", matchedType = "sv5t_truong_3_nam_lien", sv5tHistoryLevel = "truong", consecutiveYears = 3.
- Nếu chỉ thể hiện đạt Sinh viên 5 tốt cấp Khoa, matchedType = "sv5t_khoa", sv5tHistoryLevel = "khoa".
- Nếu chỉ thể hiện đạt Sinh viên 5 tốt cấp Trường, matchedType = "sv5t_truong", sv5tHistoryLevel = "truong".
- Nếu thể hiện đạt Sinh viên 5 tốt cấp ĐHQG-HCM, matchedType = "sv5t_dhqg", sv5tHistoryLevel = "dhqg".
- Nếu thể hiện đạt Sinh viên 5 tốt cấp Thành phố, matchedType = "sv5t_thanh", sv5tHistoryLevel = "thanh".
- Nếu thể hiện đạt Sinh viên 5 tốt cấp Trung ương, matchedType = "sv5t_trung_uong", sv5tHistoryLevel = "trung_uong".
- Nếu có "Giám đốc ĐHQG" hoặc "Giám đốc Đại học Quốc gia" và "Sinh viên 5 tốt tiêu biểu", matchedType = "bang_khen_giam_doc_dhqg_sv5t_tieu_bieu", sv5tHistoryLevel = "dhqg".
- Nếu không thấy rõ cụm "Sinh viên 5 tốt" hoặc không phải giấy chứng nhận/bằng khen SV5T, trả isValid = false, matchedType = "unknown".

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "sv5t_khoa hoặc sv5t_truong hoặc sv5t_khoa_2_nam_lien hoặc sv5t_khoa_3_nam_lien hoặc sv5t_truong_2_nam_lien hoặc sv5t_truong_3_nam_lien hoặc sv5t_dhqg hoặc sv5t_thanh hoặc sv5t_trung_uong hoặc bang_khen_giam_doc_dhqg_sv5t_tieu_bieu hoặc unknown",
  "sv5tHistoryType": "giống matchedType",
  "sv5tHistoryLevel": "khoa hoặc truong hoặc dhqg hoặc thanh hoặc trung_uong hoặc unknown",
  "sv5tHistoryYears": ["2023", "2024"],
  "consecutiveYears": 0 hoặc 2 hoặc 3,
  "issuer": "đơn vị cấp giấy chứng nhận hoặc bằng khen nếu có",
  "awardTitle": "tên giấy chứng nhận hoặc bằng khen nếu có",
  "extractedText": "tóm tắt nội dung OCR quan trọng",
  "matchedEvidence": ["các cụm từ trong văn bản giúp xác định"],
  "missingInfo": ["thông tin còn thiếu nếu chưa đủ"],
  "reason": "giải thích ngắn gọn bằng tiếng Việt"
}`;
}

function containsMockTestKeyword(text) {
  const normalized = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const mockKeywords = [
    "thi thu",
    "ky thi thu",
    "kiem tra thu",
    "chung nhan thu",
    "ket qua thi thu",
    "mock test",
    "practice test",
    "trial test",
    "placement test thu"
  ];

  return mockKeywords.some((keyword) => normalized.includes(keyword));
}

function buildPrompt(category, contentDescription, awardLevel = "truong") {
  if (category === "hocTapTot") {
    return buildHocTapPrompt(contentDescription, awardLevel);
  }

  if (category === "theLucTot") {
    return buildTheLucPrompt(contentDescription, awardLevel);
  }

  if (category === "tinhNguyenTot") {
    return buildTinhNguyenPrompt(contentDescription, awardLevel);
  }

  if (category === "hoiNhapTot") {
    return buildHoiNhapPrompt(contentDescription, awardLevel);
  }

  if (category === "khac") {
    return buildKhacPrompt(contentDescription);
  }

  return null;
}

async function analyzeEvidenceWithAI(filePath, fileType, category, awardLevel = "truong") {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return getEmptyAiResult("AI chưa được cấu hình. Cần admin kiểm tra thủ công.");
    }

    let parts = [];

    if (fileType === "image/png" || fileType === "image/jpeg") {
      const imageData = fs.readFileSync(filePath);
      const base64Image = imageData.toString("base64");

      const prompt = buildPrompt(
        category,
        "Hãy đọc toàn bộ nội dung văn bản trong ảnh OCR và phân tích tài liệu:",
        awardLevel
      );

      if (!prompt) return null;

      parts = [
        {
          inline_data: {
            mime_type: fileType,
            data: base64Image
          }
        },
        {
          text: prompt
        }
      ];
    } else {
      const extractedText = await extractTextFromFile(filePath, fileType);

      if (!extractedText || extractedText.length < 20) {
        return getEmptyAiResult(
          "File không có nội dung text hoặc không đọc được nội dung. Cần admin xem xét thủ công."
        );
      }

      const textToSend =
        extractedText.length > 3000
          ? extractedText.substring(0, 3000) + "\n...(nội dung đã rút gọn)"
          : extractedText;

      const prompt = buildPrompt(
        category,
        `Nội dung file:\n---\n${textToSend}\n---`,
        awardLevel
      );

      if (!prompt) return null;

      parts = [
        {
          text: prompt
        }
      ];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      return getEmptyAiResult(
        `Gemini API lỗi ${response.status}. Cần admin kiểm tra thủ công.`
      );
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      return JSON.parse(clean);
    } catch (jsonError) {
      console.error("Gemini JSON parse error:", jsonError.message);

      return {
        ...getEmptyAiResult(
          "AI đã phản hồi nhưng không đúng định dạng JSON. Cần admin kiểm tra thủ công."
        ),
        extractedText: text
      };
    }
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

      await archiveEvidenceToR2(evidence);
      await recomputeHocTapProgress(studentId);
      return;
    }

    if (aiResult.isValid === null && aiResult.confidence >= 70) {
      const type = aiResult.academicEvidenceType || "";
      const count = Number(aiResult.academicActivityCount || 0);

      if (type === "hocThuat_3_activities" && count > 0) {
        evidence.status = "partial_valid";
        await evidence.save();

        await archiveEvidenceToR2(evidence);
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
      await archiveEvidenceToR2(evidence);
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
      await archiveEvidenceToR2(evidence);
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

    await archiveEvidenceToR2(evidence);
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
    await archiveEvidenceToR2(evidence);
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

router.get("/test-gemini", requireAdminAuth, requireSuperAdmin, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Thiếu GEMINI_API_KEY trong file .env"
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Trả lời đúng JSON: {\"success\":true,\"message\":\"Gemini hoạt động\"}"
                }
              ]
            }
          ]
        })
      }
    );

    const rawText = await response.text();

    if (!response.ok) {
      return res.status(500).json({
        success: false,
        message: "Gemini API lỗi",
        status: response.status,
        rawText
      });
    }

    res.json({
      success: true,
      message: "Kết nối Gemini API thành công",
      rawText
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không gọi được Gemini API",
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

      analyzeEvidenceWithAI(req.file.path, req.file.mimetype, category, awardLevel)
        .then(async (rawAiResult) => {
          const aiResult = normalizeAiResult(rawAiResult);

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

          evidence.aiResult = aiResult;

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
const PROMPT_VERSION = "sv5t_evidence_ai_v2.0";

// Khoảng thời gian hợp lệ của minh chứng (năm học 2025–2026)
const EVIDENCE_PERIOD_START = new Date("2025-09-15T00:00:00+07:00");
const EVIDENCE_PERIOD_END   = new Date("2026-08-31T23:59:59+07:00");

/**
 * Parse ngày từ chuỗi linh hoạt (dd/mm/yyyy, yyyy-mm-dd, tháng chữ, v.v.)
 * Trả về Date hoặc null nếu không parse được.
 */
function parseIssueDateFlexible(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();

  // dd/mm/yyyy hoặc d/m/yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`);

  // yyyy-mm-dd hoặc yyyy/mm/dd
  const ymd = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymd) return new Date(`${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`);

  // "tháng 9 năm 2025" hoặc "tháng 09/2025"
  const viMonth = s.match(/tháng\s*(\d{1,2})[\s\/,]*năm\s*(\d{4})/i);
  if (viMonth) return new Date(`${viMonth[2]}-${viMonth[1].padStart(2, "0")}-01`);

  // mm/yyyy hoặc mm-yyyy (chỉ tháng/năm)
  const my = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (my) return new Date(`${my[2]}-${my[1].padStart(2, "0")}-01`);

  // yyyy (chỉ năm)
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return new Date(`${yearOnly[1]}-01-01`);

  // Thử Date.parse làm fallback (handles "September 15, 2025" etc.)
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

const AI_CONFIDENCE_RULES = {
  hocTapTot: {
    autoValid: 88,
    manualReview: 55
  },

  theLucTot: {
    autoValid: 85,
    manualReview: 50
  },

  tinhNguyenTot: {
    autoValid: 90,
    manualReview: 60
  },

  hoiNhapTot: {
    autoValid: 88,
    manualReview: 55
  },

  khac: {
    autoValid: 85,
    manualReview: 55
  },

  default: {
    autoValid: 85,
    manualReview: 50
  }
};

function toPercentConfidence(value) {
  const num = Number(value || 0);

  if (Number.isNaN(num)) return 0;

  // Nếu AI trả 0.85 thì đổi thành 85
  if (num > 0 && num <= 1) {
    return Math.round(num * 100);
  }

  // Nếu AI trả 85 thì giữ nguyên
  return Math.max(0, Math.min(100, Math.round(num)));
}

function buildStudentContext(student) {
  return {
    studentId: student?.studentId || "",
    fullName: student?.fullName || "",
    className: student?.className || "",
    faculty: "Khoa Hóa học",
    university: "Trường Đại học Khoa học tự nhiên, ĐHQG-HCM"
  };
}

function normalizeMatchValue(value) {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return "unknown";
}

function normalizeAiV2Result(aiResult, category, awardLevel, studentContext) {
  const confidence = toPercentConfidence(aiResult?.confidence);

  const extractedInfo = {
    studentName: aiResult?.extractedInfo?.studentName || "",
    studentId: aiResult?.extractedInfo?.studentId || "",
    className: aiResult?.extractedInfo?.className || "",
    faculty: aiResult?.extractedInfo?.faculty || "",
    university: aiResult?.extractedInfo?.university || "",
    activityName: aiResult?.extractedInfo?.activityName || "",
    organizer: aiResult?.extractedInfo?.organizer || "",
    issueDate: aiResult?.extractedInfo?.issueDate || "",
    semester: aiResult?.extractedInfo?.semester || "",
    academicYear: aiResult?.extractedInfo?.academicYear || "",
    score: aiResult?.extractedInfo?.score || "",
    volunteerDays: Number(aiResult?.extractedInfo?.volunteerDays || aiResult?.volunteerDays || 0),
    achievement: aiResult?.extractedInfo?.achievement || ""
  };

  const verification = {
    hasStudentIdentity: aiResult?.verification?.hasStudentIdentity === true,
    hasOrganizer: aiResult?.verification?.hasOrganizer === true,
    hasDate: aiResult?.verification?.hasDate === true,
    hasAchievement: aiResult?.verification?.hasAchievement === true,
    matchesCurrentStudent: normalizeMatchValue(
      aiResult?.verification?.matchesCurrentStudent
    )
  };

  const warningFlags = Array.isArray(aiResult?.warningFlags)
    ? aiResult.warningFlags
    : [];

  const missingInfo = Array.isArray(aiResult?.missingInfo)
    ? aiResult.missingInfo
    : [];

  const matchedSubCriteria = Array.isArray(aiResult?.matchedSubCriteria)
    ? aiResult.matchedSubCriteria
    : aiResult?.subCriteria
    ? [aiResult.subCriteria]
    : [];

  return {
    ...aiResult,

    promptVersion: aiResult?.promptVersion || PROMPT_VERSION,

    confidence,

    evidenceType: aiResult?.evidenceType || aiResult?.matchedType || "",
    matchedCategory: aiResult?.matchedCategory || category || "",
    matchedSubCriteria,

    extractedInfo,
    verification,

    decision: aiResult?.decision || "",
    warningFlags,
    missingInfo,

    reason:
      aiResult?.reason ||
      "AI đã xử lý nhưng không trả lý do cụ thể. Cần admin kiểm tra thủ công.",

    _studentContext: studentContext || null,
    _awardLevel: awardLevel || "truong"
  };
}

function applyAiSafetyRules(aiResult, category) {
  const result = {
    ...aiResult,
    confidence: toPercentConfidence(aiResult?.confidence),
    missingInfo: Array.isArray(aiResult?.missingInfo) ? [...aiResult.missingInfo] : [],
    warningFlags: Array.isArray(aiResult?.warningFlags) ? [...aiResult.warningFlags] : []
  };

  const rules = AI_CONFIDENCE_RULES[category] || AI_CONFIDENCE_RULES.default;
  const match = result?.verification?.matchesCurrentStudent || "unknown";

  // Rule quan trọng nhất:
  // Nếu AI xác định minh chứng thuộc về sinh viên khác thì không auto valid.
  if (match === "false") {
    result.isValid = null;
    result.decision = "manual_review";

    result.warningFlags.push("student_identity_mismatch");

    result.missingInfo.push(
      "AI phát hiện tên/MSSV trên minh chứng không khớp với sinh viên đang upload. Cần admin kiểm tra thủ công."
    );

    result.reason =
      `${result.reason || ""} Minh chứng có dấu hiệu không thuộc về sinh viên hiện tại nên không được tự động công nhận.`;

    return result;
  }

  // Nếu không thấy tên/MSSV, không reject nhưng cũng không nên quá tự tin.
  if (match === "unknown") {
    result.warningFlags.push("student_identity_unknown");

    if (!result.missingInfo.includes("Minh chứng chưa thể hiện rõ tên hoặc MSSV của sinh viên.")) {
      result.missingInfo.push("Minh chứng chưa thể hiện rõ tên hoặc MSSV của sinh viên.");
    }

    if (result.confidence >= rules.autoValid) {
      result.confidence = Math.min(result.confidence, rules.autoValid - 1);
    }

    if (result.isValid === true) {
      result.decision = "manual_review";
    }
  }

  // Kiểm tra ngày cấp nằm trong khoảng hợp lệ (15/9/2025 – 31/8/2026)
  const issueDateStr = result?.extractedInfo?.issueDate;
  if (issueDateStr) {
    const issueDate = parseIssueDateFlexible(issueDateStr);
    if (issueDate && !isNaN(issueDate.getTime())) {
      const outOfPeriod = issueDate < EVIDENCE_PERIOD_START || issueDate > EVIDENCE_PERIOD_END;
      if (outOfPeriod) {
        if (!result.warningFlags.includes("date_out_of_period")) {
          result.warningFlags.push("date_out_of_period");
        }
        result.missingInfo.push(
          `Ngày cấp minh chứng (${issueDateStr}) nằm ngoài khoảng thời gian hợp lệ của năm học 2025–2026 (15/09/2025 – 31/08/2026).`
        );
        result.isValid = null;
        result.decision = "manual_review";
        result.reason =
          `${result.reason ? result.reason + " " : ""}Minh chứng có ngày cấp ngoài năm học 2025–2026 nên không được tự động công nhận.`;
        return result;
      }
    }
  }

  if (result.isValid === true && result.confidence >= rules.autoValid) {
    result.decision = result.decision || "auto_valid";
    return result;
  }

  if (result.isValid === false && result.confidence >= 80) {
    result.decision = result.decision || "reject_suggested";
    return result;
  }

  result.decision = result.decision || "manual_review";
  return result;
}

module.exports = {
  PROMPT_VERSION,
  AI_CONFIDENCE_RULES,
  EVIDENCE_PERIOD_START,
  EVIDENCE_PERIOD_END,
  toPercentConfidence,
  buildStudentContext,
  normalizeAiV2Result,
  applyAiSafetyRules,
  parseIssueDateFlexible
};
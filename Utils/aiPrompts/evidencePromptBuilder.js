const { buildHocTapPrompt } = require("./hocTapPrompt");
const { buildTheLucPrompt } = require("./theLucPrompt");
const { buildTinhNguyenPrompt } = require("./tinhNguyenPrompt");
const { buildHoiNhapPrompt } = require("./hoiNhapPrompt");
const { buildKhacPrompt } = require("./khacPrompt");

const { PROMPT_VERSION } = require("../aiDecisionEngine");

function buildStudentContextBlock(studentContext = {}) {
  return `
THÔNG TIN SINH VIÊN ĐANG UPLOAD:
- Họ tên: ${studentContext.fullName || "Không rõ"}
- MSSV: ${studentContext.studentId || "Không rõ"}
- chi Hội: ${studentContext.className || "Không rõ"}
- Khoa: ${studentContext.faculty || "Khoa Hóa học"}
- Trường: ${studentContext.university || "Trường Đại học Khoa học tự nhiên, ĐHQG-HCM"}

YÊU CẦU KIỂM TRA DANH TÍNH:
- Nếu minh chứng có tên hoặc MSSV, hãy so sánh với sinh viên đang upload.
- Nếu tên/MSSV khớp, verification.matchesCurrentStudent = "true".
- Nếu tên/MSSV không khớp, verification.matchesCurrentStudent = "false".
- Nếu minh chứng không có đủ tên/MSSV để kết luận, verification.matchesCurrentStudent = "unknown".
- Không được tự suy đoán danh tính nếu tài liệu không thể hiện rõ.
`;
}

function buildUniversalEvidenceSchema({
  category,
  awardLevel,
  studentContext = {}
}) {
  return `
${buildStudentContextBlock(studentContext)}

PHIÊN BẢN PROMPT:
${PROMPT_VERSION}

TIÊU CHÍ ĐANG XÉT:
- category: ${category}
- awardLevel: ${awardLevel}

NHIỆM VỤ:
Bạn đang kiểm tra một minh chứng Sinh viên 5 tốt.
Hãy đọc nội dung minh chứng, xác định loại minh chứng, kiểm tra mức độ phù hợp với tiêu chí đang xét, kiểm tra danh tính sinh viên, và đề xuất hướng xử lý an toàn.

BẮT BUỘC:
- Chỉ trả về JSON hợp lệ.
- Không thêm giải thích ngoài JSON.
- Không dùng markdown.
- Không bịa thông tin không có trong tài liệu.
- Nếu không đủ dữ liệu, dùng isValid = null và decision = "manual_review".

JSON schema bắt buộc:
{
  "promptVersion": "${PROMPT_VERSION}",
  "isValid": true | false | null,
  "confidence": 0-100,
  "decision": "auto_valid" | "manual_review" | "reject_suggested" | "partial_valid",

  "evidenceType": "",
  "matchedType": "",
  "matchedCategory": "${category}",
  "matchedSubCriteria": [],

  "subCriteria": "",
  "academicEvidenceType": "",
  "academicActivityCount": 0,

  "volunteerDays": 0,
  "volunteerActivityName": "",
  "hasVolunteerAward": false,

  "foreignLanguageEvidenceType": "",
  "kyNangEvidenceType": "",
  "hoiNhapEvidenceType": "",
  "awardRank": "",
  "organizerLevel": "",

  "sv5tHistoryType": "",
  "sv5tHistoryLevel": "",
  "sv5tHistoryYears": [],
  "consecutiveYears": 0,
  "issuer": "",
  "awardTitle": "",

  "extractedInfo": {
    "studentName": "",
    "studentId": "",
    "className": "",
    "faculty": "",
    "university": "",
    "activityName": "",
    "organizer": "",
    "issueDate": "",
    "semester": "",
    "academicYear": "",
    "score": "",
    "volunteerDays": 0,
    "achievement": ""
  },

  "verification": {
    "hasStudentIdentity": true | false,
    "hasOrganizer": true | false,
    "hasDate": true | false,
    "hasAchievement": true | false,
    "matchesCurrentStudent": "true" | "false" | "unknown"
  },

  "matchedEvidence": [],
  "missingInfo": [],
  "warningFlags": [],
  "reason": ""
}

THỜI GIAN HỢP LỆ CỦA MINH CHỨNG:
- Minh chứng chỉ được tính nếu ngày cấp (issueDate) nằm trong khoảng từ 15/09/2025 đến 31/08/2026 (năm học 2025–2026).
- Nếu xác định được issueDate và ngày đó nằm NGOÀI khoảng trên, thêm "date_out_of_period" vào warningFlags và ghi rõ vào reason.
- Nếu không xác định được ngày cấp, hasDate = false, KHÔNG thêm "date_out_of_period".

QUY TẮC RA QUYẾT ĐỊNH:
- Nếu minh chứng rõ ràng hợp lệ, đúng sinh viên, đủ thông tin, confidence cao: decision = "auto_valid".
- Nếu minh chứng có vẻ hợp lệ nhưng thiếu tên, MSSV, ngày, đơn vị cấp, hoặc thông tin quan trọng: decision = "manual_review".
- Nếu minh chứng không liên quan tiêu chí đang xét: isValid = false, decision = "reject_suggested".
- Nếu tên/MSSV không khớp sinh viên đang upload: isValid = null, decision = "manual_review", warningFlags thêm "student_identity_mismatch".
- Nếu không xác định được danh tính sinh viên: verification.matchesCurrentStudent = "unknown", warningFlags thêm "student_identity_unknown".
- Nếu ngày cấp nằm ngoài 15/09/2025 – 31/08/2026: isValid = null, decision = "manual_review", warningFlags thêm "date_out_of_period".
- confidence phải là số từ 0 đến 100.
`;
}

function buildEvidencePrompt({
  category,
  contentDescription,
  awardLevel = "truong",
  studentContext = {}
}) {
  let basePrompt = null;

  switch (category) {
    case "hocTapTot":
      basePrompt = buildHocTapPrompt(contentDescription, awardLevel);
      break;

    case "theLucTot":
      basePrompt = buildTheLucPrompt(contentDescription, awardLevel);
      break;

    case "tinhNguyenTot":
      basePrompt = buildTinhNguyenPrompt(contentDescription, awardLevel);
      break;

    case "hoiNhapTot":
      basePrompt = buildHoiNhapPrompt(contentDescription, awardLevel);
      break;

    case "khac":
      basePrompt = buildKhacPrompt(contentDescription, awardLevel);
      break;

    default:
      return null;
  }

  return `
${basePrompt}

${buildUniversalEvidenceSchema({
  category,
  awardLevel,
  studentContext
})}
`;
}

module.exports = {
  buildEvidencePrompt,
  buildUniversalEvidenceSchema
};
function compactJson(data) {
  try {
    return JSON.stringify(data || {}, null, 2);
  } catch {
    return "{}";
  }
}

function buildSuggestionSystemPrompt() {
  return `
Bạn là AI gợi ý hành động cho dashboard Sinh viên 5 tốt.

NHIỆM VỤ:
- Dựa trên tiến độ hồ sơ của sinh viên, gợi ý các việc cần làm tiếp theo.
- Chỉ gợi ý cho các tiêu chí còn thiếu hoặc cần chú ý.
- Không gợi ý cho tiêu chí đã hoàn thành chắc chắn.
- Không bịa hoạt động cụ thể nếu dữ liệu hoạt động không được cung cấp.
- Trả về JSON array hợp lệ, không thêm chữ ngoài JSON.

MỖI GỢI Ý CÓ DẠNG:
{
  "category": "daoDucTot | hocTapTot | theLucTot | tinhNguyenTot | hoiNhapTot",
  "title": "",
  "priority": "high | medium | low",
  "reason": "",
  "actions": [],
  "cta": ""
}

QUY TẮC:
- Tối đa 1 gợi ý cho mỗi tiêu chí.
- Tối đa 5 gợi ý tổng cộng.
- Nếu không có gì cần gợi ý, trả về [].
- action phải cụ thể, ngắn, dễ làm.
- Không được nói sinh viên chắc chắn đạt nếu dữ liệu chưa được admin duyệt.
`;
}

function buildSuggestionUserPrompt({
  studentContext = {},
  missingCategories = [],
  progressSummary = {},
  evidenceSummary = [],
  activitySummary = [],
  regulationContext = ""
}) {
  return `
THÔNG TIN SINH VIÊN:
${compactJson(studentContext)}

CÁC TIÊU CHÍ CÒN THIẾU HOẶC CẦN CHÚ Ý:
${compactJson(missingCategories)}

TIẾN ĐỘ HỒ SƠ:
${compactJson(progressSummary)}

MINH CHỨNG ĐÃ NỘP:
${compactJson(evidenceSummary)}

HOẠT ĐỘNG ĐÃ GHI NHẬN:
${compactJson(activitySummary)}

QUY CHẾ LIÊN QUAN:
${regulationContext || "Không có quy chế liên quan trong context."}

YÊU CẦU:
Hãy trả về JSON array gợi ý hành động cho sinh viên.
Không thêm giải thích ngoài JSON.
`;
}

function buildSuggestionPrompt(args) {
  return {
    systemPrompt: buildSuggestionSystemPrompt(),
    userPrompt: buildSuggestionUserPrompt(args)
  };
}

module.exports = {
  buildSuggestionPrompt,
  buildSuggestionSystemPrompt,
  buildSuggestionUserPrompt
};
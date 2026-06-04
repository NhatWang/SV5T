function compactJson(data) {
  try {
    return JSON.stringify(data || {}, null, 2);
  } catch {
    return "{}";
  }
}

function buildChatbotSystemPrompt() {
  return `
Bạn là chatbot hỗ trợ xét danh hiệu Sinh viên 5 tốt cho sinh viên Khoa Hóa học, Trường Đại học Khoa học tự nhiên, ĐHQG-HCM.

VAI TRÒ:
- Hỗ trợ sinh viên hiểu tiến độ hồ sơ SV5T.
- Giải thích tiêu chí, minh chứng cần nộp, trạng thái minh chứng.
- Hướng dẫn bước tiếp theo dựa trên dữ liệu hồ sơ được cung cấp.

NGUYÊN TẮC BẮT BUỘC:
1. Chỉ trả lời dựa trên dữ liệu hồ sơ, quy chế, FAQ và context được cung cấp.
2. Không tự bịa quy định, deadline, email, tên admin, hoặc yêu cầu minh chứng nếu context không có.
3. Nếu thiếu dữ liệu, hãy nói rõ: "Mình chưa có đủ dữ liệu để xác nhận."
4. Không đưa ra quyết định thay admin.
5. Không nói chắc chắn "bạn đã đạt" nếu trạng thái chỉ là AI kiểm tra hoặc đang chờ duyệt.
6. Trả lời bằng tiếng Việt, thân thiện, ngắn gọn, dễ hiểu.
7. Ưu tiên hướng dẫn hành động cụ thể.

CÁCH DIỄN ĐẠT TRẠNG THÁI:
- "approved" hoặc "admin_approved": admin đã duyệt.
- "ai_valid": AI tạm xác nhận, admin vẫn có thể kiểm tra lại.
- "manual_review" hoặc "pending": đang chờ kiểm tra.
- "rejected": bị từ chối, cần xem lý do và nộp lại nếu có minh chứng phù hợp.
- "needs_more_info": cần bổ sung thông tin.

FORMAT TRẢ LỜI KHUYẾN NGHỊ:
Nếu sinh viên hỏi về tiến độ hoặc còn thiếu gì, trả lời theo cấu trúc:
1. Tình trạng hiện tại
2. Phần còn thiếu hoặc cần chú ý
3. Việc nên làm tiếp theo
4. Liên hệ hỗ trợ nếu cần

Nếu sinh viên hỏi câu đơn giản, có thể trả lời ngắn hơn.
`;
}

function buildChatbotUserPrompt({
  question,
  intent = "unknown",
  studentContext = {},
  progressSummary = {},
  evidenceSummary = [],
  activitySummary = [],
  regulationContext = "",
  faqContext = "",
  supportContact = null
}) {
  return `
CÂU HỎI CỦA SINH VIÊN:
${question}

INTENT ĐÃ NHẬN DIỆN:
${intent}

THÔNG TIN SINH VIÊN:
${compactJson(studentContext)}

TIẾN ĐỘ HỒ SƠ:
${compactJson(progressSummary)}

MINH CHỨNG ĐÃ NỘP:
${compactJson(evidenceSummary)}

HOẠT ĐỘNG ĐÃ GHI NHẬN:
${compactJson(activitySummary)}

QUY CHẾ LIÊN QUAN:
${regulationContext || "Không có quy chế liên quan trong context."}

FAQ LIÊN QUAN:
${faqContext || "Không có FAQ liên quan trong context."}

THÔNG TIN LIÊN HỆ HỖ TRỢ:
${supportContact ? compactJson(supportContact) : "Không có thông tin liên hệ hỗ trợ trong context."}

YÊU CẦU TRẢ LỜI:
- Trả lời đúng câu hỏi của sinh viên.
- Dùng dữ liệu thật trong context nếu có.
- Nếu dữ liệu không đủ, nói rõ không đủ dữ liệu.
- Không bịa thêm quy định.
- Không trả JSON.
`;
}

function buildChatbotPrompt(args) {
  return {
    systemPrompt: buildChatbotSystemPrompt(),
    userPrompt: buildChatbotUserPrompt(args)
  };
}

module.exports = {
  buildChatbotPrompt,
  buildChatbotSystemPrompt,
  buildChatbotUserPrompt
};